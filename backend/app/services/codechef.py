import asyncio
import logging
from datetime import datetime
import cloudscraper
from bs4 import BeautifulSoup
from app.database import get_database
from app.services.rating_system import compute_rating_and_stars
import re

logger = logging.getLogger(__name__)
scraper = cloudscraper.create_scraper()

def parse_codechef_samples(body_html: str) -> list:
    """
    Parses sample input/output test cases from CodeChef problem statement HTML body.
    """
    test_cases = []
    if not body_html:
        return test_cases
        
    try:
        soup = BeautifulSoup(body_html, 'html.parser')
        pre_tags = soup.find_all('pre')
        
        for pre in pre_tags:
            text = pre.get_text().strip()
            # Look for typical CodeChef patterns: "Input\n...\nOutput\n..."
            lines = text.splitlines()
            input_block = []
            output_block = []
            current_mode = None
            
            for line in lines:
                lower_line = line.strip().lower()
                if "input" in lower_line:
                    current_mode = "input"
                    continue
                elif "output" in lower_line:
                    current_mode = "output"
                    continue
                    
                if current_mode == "input":
                    input_block.append(line)
                elif current_mode == "output":
                    output_block.append(line)
            
            if input_block or output_block:
                test_cases.append({
                    "input": "\n".join(input_block).strip(),
                    "output": "\n".join(output_block).strip()
                })
                
        # If the above parser did not find anything, check for structured sample blocks
        if not test_cases:
            # Check for multiple pre tags where one is input and next is output
            for idx, pre in enumerate(pre_tags[:-1]):
                text_curr = pre.get_text().strip()
                text_next = pre_tags[idx+1].get_text().strip()
                # Check siblings
                if "input" in text_curr.lower() and "output" in text_next.lower():
                    # clean labels
                    tc_in = re.sub(r'(?i)input:?', '', text_curr).strip()
                    tc_out = re.sub(r'(?i)output:?', '', text_next).strip()
                    test_cases.append({
                        "input": tc_in,
                        "output": tc_out
                    })
    except Exception as e:
        logger.error(f"Error parsing CodeChef samples: {e}")
        
    return test_cases

async def sync_codechef_data():
    """
    Sync CodeChef latest 5 completed contests and their problems.
    """
    db = get_database()
    loop = asyncio.get_event_loop()
    logger.info("Starting CodeChef synchronization...")
    print("Starting CodeChef synchronization...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # 1. Fetch latest past contests list
    url = "https://www.codechef.com/api/list/contests/all"
    try:
        r = await loop.run_in_executor(None, lambda: scraper.get(url, headers=headers, timeout=15))
        if r.status_code != 200:
            logger.error(f"Failed to fetch CodeChef contests: Status {r.status_code}")
            return
            
        data = r.json()
        past_contests = data.get("past_contests", [])
        # We only want official starters or challenge rounds
        starters = [
            c for c in past_contests 
            if c.get("contest_code", "").startswith(("START", "COOK", "LUNCH", "DSAMONDAY"))
        ]
        
        # Take latest 5
        latest_5 = starters[:5]
        
        for c in latest_5:
            parent_code = c["contest_code"]
            parent_name = c["contest_name"]
            logger.info(f"Syncing CodeChef contest: {parent_name} ({parent_code})")
            print(f"Syncing CodeChef contest: {parent_name} ({parent_code})")
            
            # Fetch parent details to check for divisions
            parent_url = f"https://www.codechef.com/api/contests/{parent_code}"
            r_parent = await loop.run_in_executor(None, lambda: scraper.get(parent_url, headers=headers, timeout=10))
            if r_parent.status_code != 200:
                continue
                
            parent_data = r_parent.json()
            division_contests = []
            
            if parent_data.get("is_a_parent_contest"):
                child_dict = parent_data.get("child_contests", {})
                # Fetch Division 4 and Division 3 codes (contains most solved questions)
                for div_key in ["div_4", "div_3", "div_2", "div_1"]:
                    if div_key in child_dict:
                        division_contests.append((child_dict[div_key]["contest_code"], div_key.upper().replace("_", " ")))
            else:
                division_contests.append((parent_code, "ALL"))
                
            # Sync contest document
            await db.contests.update_one(
                {"_id": parent_code},
                {"$set": {
                    "name": parent_name,
                    "type": "CodeChef " + parent_code,
                    "phase": "FINISHED",
                    "duration_seconds": int(parent_data.get("duration", 180)) * 60,
                    "start_time_seconds": int(datetime.fromisoformat(c["contest_start_date_iso"].replace('Z', '+00:00')).timestamp()),
                    "platform": "codechef",
                    "synced_at": datetime.utcnow()
                }},
                upsert=True
            )
            
            # Loop divisions and sync problems
            all_problems = {}
            for div_code, div_name in division_contests:
                logger.info(f"Fetching problems from CodeChef division: {div_code} ({div_name})...")
                div_url = f"https://www.codechef.com/api/contests/{div_code}"
                r_div = await loop.run_in_executor(None, lambda: scraper.get(div_url, headers=headers, timeout=10))
                if r_div.status_code == 200:
                    div_data = r_div.json()
                    problems_list = div_data.get("problems", {})
                    # Add to list (if list, convert to dict)
                    if isinstance(problems_list, list):
                        for p in problems_list:
                            all_problems[p["code"]] = {
                                "code": p["code"],
                                "name": p["name"],
                                "division": div_name
                            }
                    elif isinstance(problems_list, dict):
                        for p_code, p in problems_list.items():
                            all_problems[p_code] = {
                                "code": p_code,
                                "name": p.get("name"),
                                "division": div_name
                            }
            
            for p_code, p_summary in all_problems.items():
                q_id = f"codechef_{p_code}"
                
                # Check if exists
                existing_q = await db.questions.find_one({"_id": q_id})
                needs_scrape = not existing_q or not existing_q.get("description_html")
                
                if needs_scrape:
                    logger.info(f"Scraping CodeChef problem details for {p_code}...")
                    print(f"Scraping CodeChef problem details for {p_code}...")
                    
                    prob_url = f"https://www.codechef.com/api/contests/{parent_code}/problems/{p_code}"
                    # If division contest is different, try division contest URL first
                    if p_summary.get("division") != "ALL":
                        # E.g. START245D
                        div_code_match = next((code for code, name in division_contests if name == p_summary["division"]), parent_code)
                        prob_url = f"https://www.codechef.com/api/contests/{div_code_match}/problems/{p_code}"
                        
                    r_prob = await loop.run_in_executor(None, lambda: scraper.get(prob_url, headers=headers, timeout=10))
                    if r_prob.status_code == 200:
                        prob_data = r_prob.json()
                        body_html = prob_data.get("body", "")
                        difficulty = int(prob_data.get("difficulty_rating") or 1000)
                        rs = compute_rating_and_stars('codechef', difficulty_rating=difficulty)
                        rating = rs['rating']
                        stars = rs['stars']
                        tags = prob_data.get("computed_tags", []) or prob_data.get("user_tags", []) or ["CodeChef"]
                        test_cases = parse_codechef_samples(body_html)
                        
                        # Fallback test cases if none found
                        if not test_cases:
                            test_cases = [{"input": "1\n", "output": ""}]
                            
                        # Save
                        sol_code = """#include <iostream>
using namespace std;

int main() {
    // Write your CodeChef C++ code here
    return 0;
}
"""
                        
                        # CodeChef HTML can contain script/style tags and inconsistent wrappers.
                        # This normalization keeps rendering consistent in the React app.
                        normalized_body_html = body_html or ""
                        try:
                            soup = BeautifulSoup(normalized_body_html, "html.parser")

                            # Remove script/style tags (security + layout issues)
                            for t in soup.find_all(["script", "style"]):
                                t.decompose()

                            # Drop inline styles that can break our layout
                            for tag in soup.find_all(True):
                                if tag.has_attr("style"):
                                    del tag["style"]

                            # If body contains plain text nodes mixed with HTML, wrap into a single container
                            # so CSS/scoped rendering stays predictable.
                            # (React renders via dangerouslySetInnerHTML anyway.)
                            normalized_body_html = str(soup)
                        except Exception as e:
                            logger.error(f"CodeChef HTML normalization failed for {p_code}: {e}")
                            normalized_body_html = body_html

                        await db.questions.update_one(
                            {"_id": q_id},
                            {"$set": {
                                "contest_id": parent_code,
                                "index": p_code,
                                "name": f"{p_code}. {prob_data.get('problem_name')}",
                                "rating": rating,
                                "stars": stars,
                                "tags": tags,
                                "editorial_url": f"https://www.codechef.com/problems/{p_code}",
                                "solution_cpp": sol_code,
                                "test_cases": test_cases,
                                "description_html": normalized_body_html,
                                "platform": "codechef",
                                "synced_at": datetime.utcnow()
                            }},
                            upsert=True
                        )
                        await asyncio.sleep(1.0)
                else:
                    # Just update rating, tags, name
                    await db.questions.update_one(
                        {"_id": q_id},
                        {"$set": {
                            "contest_id": parent_code,
                            "index": p_code,
                            "platform": "codechef",
                            "synced_at": datetime.utcnow()
                        }}
                    )
                    
        logger.info("CodeChef synchronization completed successfully!")
        print("CodeChef synchronization completed successfully!")
    except Exception as e:
        logger.error(f"Error during CodeChef sync: {e}")
        print(f"Error during CodeChef sync: {e}")
