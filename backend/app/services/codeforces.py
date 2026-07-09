import asyncio
import logging
from datetime import datetime
import cloudscraper
from bs4 import BeautifulSoup
from bson import ObjectId
from app.database import get_database
from app.services.rating_system import compute_rating_and_stars

logger = logging.getLogger(__name__)

# Initialize cloudscraper
scraper = cloudscraper.create_scraper()

def extract_pre_content(pre):
    if not pre:
        return ""
    divs = pre.find_all('div', class_='test-example-line')
    if divs:
        return '\n'.join(d.get_text() for d in divs)
    
    # Clone and replace br tags
    for br in pre.find_all('br'):
        br.replace_with('\n')
    return pre.get_text()

def scrape_problem_data_sync(contest_id: int, problem_index: str) -> dict:
    """
    Synchronous function to scrape sample test cases and problem statement from Codeforces.
    """
    url = f"https://codeforces.com/contest/{contest_id}/problem/{problem_index}"
    result = {
        "test_cases": [], 
        "editorial_url": f"https://codeforces.com/contest/{contest_id}",
        "description_html": ""
    }
    
    try:
        r = scraper.get(url, timeout=15)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            
            # Scrape full problem statement HTML
            problem_statement = soup.find('div', class_='problem-statement')
            if problem_statement:
                # Clean up relative image URLs
                for img in problem_statement.find_all('img'):
                    src = img.get('src')
                    if src and src.startswith('/'):
                        img['src'] = f"https://codeforces.com{src}"
                    elif src and src.startswith('//'):
                        img['src'] = f"https:{src}"
                result["description_html"] = str(problem_statement)
                
            sample_tests = soup.find('div', class_='sample-tests')
            if sample_tests:
                inputs_divs = sample_tests.find_all('div', class_='input')
                outputs_divs = sample_tests.find_all('div', class_='output')
                
                for inp_div, out_div in zip(inputs_divs, outputs_divs):
                    pre_in = inp_div.find('pre')
                    pre_out = out_div.find('pre')
                    
                    inp_text = extract_pre_content(pre_in).strip() if pre_in else ""
                    out_text = extract_pre_content(pre_out).strip() if pre_out else ""
                    
                    if inp_text or out_text:
                        result["test_cases"].append({
                            "input": inp_text,
                            "output": out_text
                        })
            
            # Look for editorial link in the sidebar if available
            sidebar = soup.find('div', id='sidebar')
            if sidebar:
                for link in sidebar.find_all('a'):
                    if 'editorial' in link.get_text().lower() or 'разбор' in link.get_text().lower():
                        href = link.get('href')
                        if href:
                            if href.startswith('http'):
                                result["editorial_url"] = href
                            else:
                                result["editorial_url"] = f"https://codeforces.com{href}"
                            break
    except Exception as e:
        logger.error(f"Error scraping problem details for {contest_id}{problem_index}: {e}")
        
    return result

GITHUB_SOLUTIONS_CACHE = None

def load_github_solutions_cache():
    global GITHUB_SOLUTIONS_CACHE
    if GITHUB_SOLUTIONS_CACHE is not None:
        return GITHUB_SOLUTIONS_CACHE
        
    logger.info("Loading GitHub solutions cache from DionysiosB/CodeForces...")
    try:
        url = "https://api.github.com/repos/DionysiosB/CodeForces/git/trees/master?recursive=1"
        headers = {"User-Agent": "Mozilla/5.0"}
        r = scraper.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            tree = r.json().get("tree", [])
            GITHUB_SOLUTIONS_CACHE = [f["path"] for f in tree if f.get("type") == "blob" and f.get("path", "").endswith(".cpp")]
            logger.info(f"Loaded {len(GITHUB_SOLUTIONS_CACHE)} solutions into cache.")
        else:
            logger.warning(f"Failed to load GitHub solutions cache: Status {r.status_code}")
            GITHUB_SOLUTIONS_CACHE = []
    except Exception as e:
        logger.error(f"Error loading GitHub solutions cache: {e}")
        GITHUB_SOLUTIONS_CACHE = []
        
    return GITHUB_SOLUTIONS_CACHE

def scrape_submission_code_sync(contest_id: int, problem_index: str) -> str:
    """
    Synchronous function to fetch successful C++ submission code for a problem.
    """
    fallback_template = """#include <iostream>
using namespace std;

int main() {
    // Write your code here
    return 0;
}
"""
    # 1. Try finding in DionysiosB/CodeForces GitHub archive
    try:
        cache = load_github_solutions_cache()
        prefix = f"{contest_id}{problem_index}"
        target_file = None
        for path in cache:
            name = path.split('/')[-1]
            if name.lower().startswith(prefix.lower()):
                rem = name[len(prefix):]
                if rem.startswith('-') or rem.startswith('.'):
                    target_file = path
                    break
        
        if target_file:
            raw_url = f"https://raw.githubusercontent.com/DionysiosB/CodeForces/master/{target_file}"
            logger.info(f"Fetching solution from GitHub archive: {raw_url}")
            r = scraper.get(raw_url, timeout=10)
            if r.status_code == 200:
                logger.info(f"Successfully retrieved C++ solution for {contest_id}{problem_index} from GitHub!")
                return r.text
    except Exception as e:
        logger.error(f"Error fetching from GitHub solutions archive: {e}")

    # 2. Fallback to Codeforces Status page scraping
    status_url = f"https://codeforces.com/api/contest.status?contestId={contest_id}&from=1&count=150"
    try:
        r = scraper.get(status_url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "OK":
                submissions = data.get("result", [])
                target_sub_id = None
                for sub in submissions:
                    prob = sub.get("problem", {})
                    if (prob.get("index") == problem_index and 
                        sub.get("verdict") == "OK" and 
                        "C++" in sub.get("programmingLanguage", "")):
                        target_sub_id = sub["id"]
                        break
                
                if target_sub_id:
                    sub_url = f"https://codeforces.com/contest/{contest_id}/submission/{target_sub_id}"
                    # 2. Scrape code page
                    r_sub = scraper.get(sub_url, timeout=15)
                    if r_sub.status_code == 200:
                        soup = BeautifulSoup(r_sub.text, 'html.parser')
                        code_pre = soup.find('pre', id='program-source-text')
                        if code_pre:
                            return code_pre.get_text()
    except Exception as e:
        logger.error(f"Error scraping C++ solution for {contest_id}{problem_index}: {e}")
        
    return fallback_template

async def sync_codeforces_data():
    """
    Main orchestrator called by scheduler to sync the latest 5 contests and their questions.
    """
    db = get_database()
    loop = asyncio.get_event_loop()
    
    logger.info("Starting Codeforces synchronization...")
    print("Starting Codeforces synchronization...")
    
    # 1. Fetch contest list
    contest_list_url = "https://codeforces.com/api/contest.list?gym=false"
    try:
        r = await loop.run_in_executor(None, lambda: scraper.get(contest_list_url, timeout=10))
        if r.status_code != 200:
            logger.error(f"Failed to fetch contest list: Status {r.status_code}")
            return
        
        data = r.json()
        if data.get("status") != "OK":
            logger.error("Codeforces API contest.list status not OK")
            return
        
        contests = data.get("result", [])
        # Filter completed contests
        finished_contests = [c for c in contests if c.get("phase") == "FINISHED"]
        # Sort by startTimeSeconds desc
        finished_contests.sort(key=lambda x: x.get("startTimeSeconds", 0), reverse=True)
        # Take latest 5
        latest_5_contests = finished_contests[:5]
        
        # Include contest 1989 for rated demonstration if not already present
        if not any(c.get("id") == 1989 for c in latest_5_contests):
            contest_1989 = next((c for c in finished_contests if c.get("id") == 1989), None)
            if contest_1989:
                latest_5_contests.append(contest_1989)
        
        for contest in latest_5_contests:
            contest_id = str(contest["id"])
            logger.info(f"Syncing contest: {contest['name']} ({contest_id})")
            print(f"Syncing contest: {contest['name']} ({contest_id})")
            
            # Save contest to DB
            await db.contests.update_one(
                {"_id": contest_id},
                {"$set": {
                    "name": contest["name"],
                    "type": contest["type"],
                    "phase": contest["phase"],
                    "duration_seconds": contest["durationSeconds"],
                    "start_time_seconds": contest["startTimeSeconds"],
                    "synced_at": datetime.utcnow()
                }},
                upsert=True
            )
            
            # 2. Fetch problems for this contest from standings
            standings_url = f"https://codeforces.com/api/contest.standings?contestId={contest_id}"
            r_standings = await loop.run_in_executor(None, lambda: scraper.get(standings_url, timeout=10))
            if r_standings.status_code != 200:
                logger.error(f"Failed to fetch standings for contest {contest_id}")
                continue
                
            standings_data = r_standings.json()
            if standings_data.get("status") != "OK":
                continue
                
            problems = standings_data.get("result", {}).get("problems", [])
            for prob in problems:
                prob_index = prob.get("index")
                q_id = f"{contest_id}{prob_index}"
                
                # Check if question exists
                existing_q = await db.questions.find_one({"_id": q_id})
                
                # Only scrape heavy HTML if missing or template is fallback
                has_valid_solution = existing_q and existing_q.get("solution_cpp") and "Write your code here" not in existing_q.get("solution_cpp", "")
                needs_scrape = not existing_q or not existing_q.get("test_cases") or not has_valid_solution or not existing_q.get("description_html")
                
                if needs_scrape:
                    logger.info(f"Scraping details for {q_id}...")
                    print(f"Scraping details for {q_id}...")
                    
                    # Scrape problem statement (test cases and editorial link)
                    prob_details = await loop.run_in_executor(
                        None, scrape_problem_data_sync, int(contest_id), prob_index
                    )
                    
                    # Scrape solution
                    sol_code = await loop.run_in_executor(
                        None, scrape_submission_code_sync, int(contest_id), prob_index
                    )
                    
                    test_cases = prob_details["test_cases"]
                    editorial_url = prob_details["editorial_url"]
                    description_html = prob_details.get("description_html", "")
                    
                    # Sleep to be gentle to Codeforces servers when scraping
                    await asyncio.sleep(1.0)
                else:
                    logger.info(f"Details for {q_id} already synced. Skipping HTML scrape.")
                    test_cases = existing_q["test_cases"]
                    editorial_url = existing_q.get("editorial_url", f"https://codeforces.com/contest/{contest_id}")
                    sol_code = existing_q["solution_cpp"]
                    description_html = existing_q.get("description_html", "")
                
                # Save and always update fields that can change (like rating, tags, name)
                cf_rating = prob.get("rating") or 800
                rs = compute_rating_and_stars('codeforces', rating=cf_rating)
                await db.questions.update_one(
                    {"_id": q_id},
                    {"$set": {
                        "contest_id": contest_id,
                        "index": prob_index,
                        "name": prob.get("name"),
                        "rating": rs['rating'],
                        "stars": rs['stars'],
                        "tags": prob.get("tags", []),
                        "points": prob.get("points"),
                        "editorial_url": editorial_url,
                        "solution_cpp": sol_code,
                        "test_cases": test_cases,
                        "description_html": description_html,
                        "synced_at": datetime.utcnow()
                    }},
                    upsert=True
                )
                
        logger.info("Codeforces synchronization completed successfully!")
        print("Codeforces synchronization completed successfully!")
    except Exception as e:
        logger.error(f"Error during Codeforces sync: {e}")
        print(f"Error during Codeforces sync: {e}")
