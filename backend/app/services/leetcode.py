import asyncio
import logging
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from app.database import get_database
from app.services.rating_system import compute_rating_and_stars
import re

logger = logging.getLogger(__name__)

def parse_leetcode_samples(content_html: str) -> list:
    """
    Parses example input/output test cases from LeetCode problem description HTML.
    Handles both old format (<pre> with Input:/Output:) and new format (<div class="example-block">).
    """
    test_cases = []
    if not content_html:
        return test_cases
        
    try:
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # ── Strategy 1: Old format — <pre> tags containing "Input:" and "Output:" ──
        pre_tags = soup.find_all('pre')
        for pre in pre_tags:
            text = pre.get_text()
            if "input" in text.lower() and "output" in text.lower():
                inp_match = re.search(r'Input:\s*(.*?)\s*Output:', text, re.DOTALL | re.IGNORECASE)
                out_match = re.search(r'Output:\s*(.*?)(?:\s*Explanation:|\s*Example|\s*$|$)', text, re.DOTALL | re.IGNORECASE)
                inp_val = inp_match.group(1).strip() if inp_match else ""
                out_val = out_match.group(1).strip() if out_match else ""
                if inp_val or out_val:
                    test_cases.append({"input": inp_val, "output": out_val})
        
        # ── Strategy 2: New format — <div class="example-block"> ──
        if not test_cases:
            example_blocks = soup.find_all('div', class_='example-block')
            for block in example_blocks:
                text = block.get_text()
                inp_match = re.search(r'Input:\s*(.*?)\s*Output:', text, re.DOTALL | re.IGNORECASE)
                out_match = re.search(r'Output:\s*(.*?)(?:\s*Explanation:|\s*$|$)', text, re.DOTALL | re.IGNORECASE)
                inp_val = inp_match.group(1).strip() if inp_match else ""
                out_val = out_match.group(1).strip() if out_match else ""
                if inp_val or out_val:
                    test_cases.append({"input": inp_val, "output": out_val})
        
        # ── Strategy 3: Regex fallback on raw HTML text ──
        if not test_cases:
            full_text = soup.get_text()
            pairs = re.findall(
                r'Input:\s*(.*?)\s*Output:\s*(.*?)(?:\s*Explanation:|\s*Example\s*\d|\s*Constraints|\s*$)',
                full_text, re.DOTALL | re.IGNORECASE
            )
            for inp_val, out_val in pairs:
                inp_val = inp_val.strip()
                out_val = out_val.strip()
                if inp_val or out_val:
                    test_cases.append({"input": inp_val, "output": out_val})
                    
    except Exception as e:
        logger.error(f"Error parsing LeetCode samples: {e}")
        
    return test_cases

def get_leetcode_solution_github(slug: str) -> str:
    """
    Fetches C++ solution for LeetCode problem from kamyu104/LeetCode-Solutions.
    """
    fallback_template = """#include <iostream>
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    // Write your LeetCode solution here
};
"""
    url = f"https://raw.githubusercontent.com/kamyu104/LeetCode-Solutions/master/C++/{slug}.cpp"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            logger.info(f"Successfully retrieved LeetCode solution for slug: {slug}")
            return r.text
    except Exception as e:
        logger.error(f"Error fetching LeetCode solution for {slug} from GitHub: {e}")
        
    return fallback_template

async def sync_leetcode_data():
    """
    Sync LeetCode latest 5 contests and their problems.
    """
    db = get_database()
    loop = asyncio.get_event_loop()
    logger.info("Starting LeetCode synchronization...")
    print("Starting LeetCode synchronization...")
    
    url = "https://leetcode.com/graphql"
    
    # 1. Query contests list
    query_contests = """
    query {
      allContests {
        title
        titleSlug
        startTime
        duration
      }
    }
    """
    
    try:
        r = await loop.run_in_executor(None, lambda: requests.post(url, json={"query": query_contests}, timeout=15))
        if r.status_code != 200:
            logger.error(f"Failed to fetch LeetCode contests list: Status {r.status_code}")
            return
            
        data = r.json()
        contests = data.get("data", {}).get("allContests", [])
        
        # Filter completed contests
        current_time = datetime.utcnow().timestamp()
        finished = [
            c for c in contests 
            if c.get("startTime", 0) + c.get("duration", 0) < current_time
        ]
        
        # Take latest 5
        latest_5 = finished[:5]
        
        for c in latest_5:
            contest_slug = c["titleSlug"]
            contest_name = c["title"]
            logger.info(f"Syncing LeetCode contest: {contest_name} ({contest_slug})")
            print(f"Syncing LeetCode contest: {contest_name} ({contest_slug})")
            
            # Save contest
            await db.contests.update_one(
                {"_id": contest_slug},
                {"$set": {
                    "name": contest_name,
                    "type": "LeetCode " + ("Weekly" if "weekly" in contest_slug else "Biweekly"),
                    "phase": "FINISHED",
                    "duration_seconds": c["duration"],
                    "start_time_seconds": c["startTime"],
                    "platform": "leetcode",
                    "synced_at": datetime.utcnow()
                }},
                upsert=True
            )
            
            # 2. Fetch problems for this contest
            query_problems = """
            query($contestName: String!) {
              contest(titleSlug: $contestName) {
                questions {
                  title
                  titleSlug
                  questionId
                }
              }
            }
            """
            
            r_problems = await loop.run_in_executor(
                None, 
                lambda: requests.post(url, json={"query": query_problems, "variables": {"contestName": contest_slug}}, timeout=10)
            )
            
            if r_problems.status_code != 200:
                continue
                
            problems_data = r_problems.json()
            questions = problems_data.get("data", {}).get("contest", {}).get("questions", [])
            
            for idx, q_summary in enumerate(questions):
                q_slug = q_summary["titleSlug"]
                q_id = f"leetcode_{q_slug}"
                
                # Check if exists
                existing_q = await db.questions.find_one({"_id": q_id})
                needs_scrape = not existing_q or not existing_q.get("description_html")
                
                if needs_scrape:
                    logger.info(f"Syncing LeetCode problem details: {q_slug}...")
                    print(f"Syncing LeetCode problem details: {q_slug}...")
                    
                    query_detail = """
                    query($titleSlug: String!) {
                      question(titleSlug: $titleSlug) {
                        content
                        difficulty
                        topicTags {
                          name
                        }
                      }
                    }
                    """
                    
                    r_detail = await loop.run_in_executor(
                        None,
                        lambda: requests.post(url, json={"query": query_detail, "variables": {"titleSlug": q_slug}}, timeout=10)
                    )
                    
                    if r_detail.status_code == 200:
                        detail_data = r_detail.json()
                        q_data = detail_data.get("data", {}).get("question", {})
                        
                        content = q_data.get("content", "")
                        difficulty_str = q_data.get("difficulty", "Easy")
                        # Compute rating and stars using unified system
                        rs = compute_rating_and_stars('leetcode', difficulty=difficulty_str, problem_index=idx)
                        rating = rs['rating']
                        stars = rs['stars']
                        
                        tags = [t["name"] for t in q_data.get("topicTags", [])]
                        if not tags:
                            tags = ["LeetCode"]
                            
                        test_cases = parse_leetcode_samples(content)
                        if not test_cases:
                            test_cases = [{"input": "", "output": ""}]
                            
                        sol_code = get_leetcode_solution_github(q_slug)
                        
                        # Save
                        await db.questions.update_one(
                            {"_id": q_id},
                            {"$set": {
                                "contest_id": contest_slug,
                                "index": chr(ord('A') + idx), # A, B, C, D
                                "name": f"{chr(ord('A') + idx)}. {q_summary['title']}",
                                "rating": rating,
                                "stars": stars,
                                "tags": tags,
                                "editorial_url": f"https://leetcode.com/problems/{q_slug}",
                                "solution_cpp": sol_code,
                                "test_cases": test_cases,
                                "description_html": content,
                                "platform": "leetcode",
                                "synced_at": datetime.utcnow()
                            }},
                            upsert=True
                        )
                        await asyncio.sleep(1.0)
                else:
                    # Update metadata only
                    await db.questions.update_one(
                        {"_id": q_id},
                        {"$set": {
                            "contest_id": contest_slug,
                            "index": chr(ord('A') + idx),
                            "platform": "leetcode",
                            "synced_at": datetime.utcnow()
                        }}
                    )
                    
        logger.info("LeetCode synchronization completed successfully!")
        print("LeetCode synchronization completed successfully!")
    except Exception as e:
        logger.error(f"Error during LeetCode sync: {e}")
        print(f"Error during LeetCode sync: {e}")
