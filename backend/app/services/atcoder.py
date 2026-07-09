import sys
import asyncio
import logging
from datetime import datetime
import cloudscraper
from bs4 import BeautifulSoup
from app.database import get_database
from app.services.rating_system import compute_rating_and_stars
import re

# Fix Windows console encoding for Japanese/Unicode contest names
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

logger = logging.getLogger(__name__)
scraper = cloudscraper.create_scraper()

def get_atcoder_solution_github(contest_id: str, problem_label: str) -> str:
    """
    Attempts to fetch C++ solution for AtCoder from Yuulis/AtcoderSolution on GitHub.
    """
    fallback_template = """#include <iostream>
using namespace std;

int main() {
    // Write your AtCoder C++ code here
    return 0;
}
"""
    cid = contest_id.lower().strip()
    label = problem_label.lower().strip()
    
    contest_type = ""
    if cid.startswith("abc"):
        contest_type = "ABC"
    elif cid.startswith("arc"):
        contest_type = "ARC"
    elif cid.startswith("agc"):
        contest_type = "AGC"
    else:
        return fallback_template
        
    url = f"https://raw.githubusercontent.com/Yuulis/AtcoderSolution/main/{contest_type}/{cid}/{label}/main.cpp"
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        r = scraper.get(url, headers=headers, timeout=8)
        if r.status_code == 200:
            logger.info(f"Successfully fetched AtCoder solution for {cid} {label} from GitHub")
            return r.text
    except Exception as e:
        logger.error(f"Error fetching AtCoder solution for {cid} {label}: {e}")
        
    return fallback_template

def parse_atcoder_problem_sync(contest_id: str, problem_id: str) -> dict:
    """
    Scrapes AtCoder problem page to extract the English statement and example test cases.
    """
    url = f"https://atcoder.jp/contests/{contest_id}/tasks/{problem_id}?lang=en"
    result = {"test_cases": [], "description_html": ""}
    
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        r = scraper.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            span_en = soup.find('span', class_='lang-en')
            if span_en:
                # Clean up relative image URLs
                for img in span_en.find_all('img'):
                    src = img.get('src')
                    if src:
                        if src.startswith('/'):
                            img['src'] = f"https://atcoder.jp{src}"
                        elif src.startswith('//'):
                            img['src'] = f"https:{src}"
                            
                result["description_html"] = str(span_en)
                
                # Parse sample inputs and outputs
                sections = span_en.find_all('section')
                inputs = {}
                outputs = {}
                for sec in sections:
                    h3 = sec.find('h3')
                    if h3:
                        text = h3.get_text()
                        pre = sec.find('pre')
                        if pre:
                            val = pre.get_text().strip()
                            match_in = re.search(r'Sample Input\s+(\d+)', text, re.IGNORECASE)
                            match_out = re.search(r'Sample Output\s+(\d+)', text, re.IGNORECASE)
                            if match_in:
                                num = int(match_in.group(1))
                                inputs[num] = val
                            elif match_out:
                                num = int(match_out.group(1))
                                outputs[num] = val
                                
                for num in sorted(inputs.keys()):
                    if num in outputs:
                        result["test_cases"].append({
                            "input": inputs[num],
                            "output": outputs[num]
                        })
    except Exception as e:
        logger.error(f"Error parsing AtCoder problem {problem_id}: {e}")
        
    return result

async def sync_atcoder_data():
    """
    Sync AtCoder latest 5 official contests and their problems.
    """
    db = get_database()
    loop = asyncio.get_event_loop()
    logger.info("Starting AtCoder synchronization...")
    print("Starting AtCoder synchronization...")
    
    # 1. Fetch all AtCoder contests from Kenkoooo API
    url = "https://kenkoooo.com/atcoder/resources/contests.json"
    try:
        r = await loop.run_in_executor(None, lambda: scraper.get(url, timeout=15))
        if r.status_code != 200:
            logger.error(f"Failed to fetch AtCoder contests: Status {r.status_code}")
            return
            
        contests = r.json()
        # Filter completed official Beginner, Regular, Grand, and heuristic contests
        official_prefixes = ("abc", "arc", "agc", "ahc", "apc")
        current_time = datetime.utcnow().timestamp()
        finished_official = [
            c for c in contests 
            if c.get("id", "").startswith(official_prefixes) and 
            c.get("start_epoch_second", 0) + c.get("duration_second", 0) < current_time
        ]
        
        # Sort by start epoch descending and take latest 5
        finished_official.sort(key=lambda x: x.get("start_epoch_second", 0), reverse=True)
        latest_5 = finished_official[:5]
        
        for c in latest_5:
            contest_id = c["id"]
            contest_name = c["title"]
            logger.info(f"Syncing AtCoder contest: {contest_name} ({contest_id})")
            print(f"Syncing AtCoder contest: {contest_name} ({contest_id})")
            
            # Save contest
            await db.contests.update_one(
                {"_id": contest_id},
                {"$set": {
                    "name": contest_name,
                    "type": "AtCoder " + contest_id[:3].upper(),
                    "phase": "FINISHED",
                    "duration_seconds": c["duration_second"],
                    "start_time_seconds": c["start_epoch_second"],
                    "platform": "atcoder",
                    "synced_at": datetime.utcnow()
                }},
                upsert=True
            )
            
            # 2. Fetch problems for this contest by scraping the tasks list page
            tasks_url = f"https://atcoder.jp/contests/{contest_id}/tasks?lang=en"
            r_tasks = await loop.run_in_executor(None, lambda: scraper.get(tasks_url, timeout=10))
            if r_tasks.status_code != 200:
                logger.error(f"Failed to fetch tasks for AtCoder contest {contest_id}")
                continue
                
            soup = BeautifulSoup(r_tasks.text, 'html.parser')
            problem_links = []
            for a in soup.find_all('a'):
                href = a.get('href', '')
                if f'/contests/{contest_id}/tasks/' in href and not href.endswith('/tasks'):
                    prob_id = href.split('/')[-1]
                    label = a.get_text().strip()
                    if len(label) == 1 or (len(label) == 2 and label[1].isdigit()): # e.g. A, B, C, F2
                        problem_links.append((prob_id, label))
            
            # De-duplicate links
            problem_links = list(set(problem_links))
            problem_links.sort(key=lambda x: x[1])
            
            for prob_id, label in problem_links:
                q_id = f"atcoder_{prob_id}"
                
                # Check if exists
                existing_q = await db.questions.find_one({"_id": q_id})
                needs_scrape = not existing_q or not existing_q.get("description_html") or not existing_q.get("test_cases")
                
                if needs_scrape:
                    logger.info(f"Scraping AtCoder task details for {prob_id}...")
                    print(f"Scraping AtCoder task details for {prob_id}...")
                    details = await loop.run_in_executor(None, parse_atcoder_problem_sync, contest_id, prob_id)
                    test_cases = details["test_cases"]
                    description_html = details["description_html"]
                    await asyncio.sleep(1.0)
                else:
                    test_cases = existing_q["test_cases"]
                    description_html = existing_q["description_html"]
                
                # Compute rating and stars using unified system
                rs = compute_rating_and_stars('atcoder', problem_label=label)
                rating = rs['rating']
                stars = rs['stars']
                
                # Fetch solution dynamically from GitHub
                sol_code = get_atcoder_solution_github(contest_id, label)
                
                await db.questions.update_one(
                    {"_id": q_id},
                    {"$set": {
                        "contest_id": contest_id,
                        "index": label,
                        "name": f"{label}. {prob_id.replace('_', ' ').title()}",
                        "rating": rating,
                        "stars": stars,
                        "tags": ["AtCoder", contest_id[:3].upper()],
                        "editorial_url": f"https://atcoder.jp/contests/{contest_id}/tasks/{prob_id}",
                        "solution_cpp": sol_code,
                        "test_cases": test_cases,
                        "description_html": description_html,
                        "platform": "atcoder",
                        "synced_at": datetime.utcnow()
                    }},
                    upsert=True
                )
                
        logger.info("AtCoder synchronization completed successfully!")
        print("AtCoder synchronization completed successfully!")
    except Exception as e:
        logger.error(f"Error during AtCoder sync: {e}")
        print(f"Error during AtCoder sync: {e}")
