import asyncio
import logging
import httpx
from datetime import datetime
from app.database import get_database

logger = logging.getLogger(__name__)

async def fetch_codeforces_upcoming(client: httpx.AsyncClient) -> list:
    url = "https://codeforces.com/api/contest.list?gym=false"
    try:
        r = await client.get(url, timeout=12.0)
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "OK":
                contests = data.get("result", [])
                now = datetime.utcnow().timestamp()
                return [
                    {
                        "id": str(c["id"]),
                        "name": c["name"],
                        "platform": "codeforces",
                        "start_time_seconds": c["startTimeSeconds"],
                        "duration_seconds": c.get("durationSeconds", 7200)
                    }
                    for c in contests
                    if c.get("phase") == "BEFORE" or c.get("startTimeSeconds", 0) > now
                ]
    except Exception as e:
        logger.error(f"Error fetching Codeforces upcoming contests: {e}")
    return []

async def fetch_leetcode_upcoming(client: httpx.AsyncClient) -> list:
    url = "https://leetcode.com/graphql"
    query = """
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
        r = await client.post(url, json={"query": query}, timeout=12.0)
        if r.status_code == 200:
            data = r.json()
            contests = data.get("data", {}).get("allContests", [])
            now = datetime.utcnow().timestamp()
            return [
                {
                    "id": c["titleSlug"],
                    "name": c["title"],
                    "platform": "leetcode",
                    "start_time_seconds": c["startTime"],
                    "duration_seconds": c["duration"]
                }
                for c in contests
                if c.get("startTime", 0) > now
            ]
    except Exception as e:
        logger.error(f"Error fetching LeetCode upcoming contests: {e}")
    return []

async def fetch_codechef_upcoming(client: httpx.AsyncClient) -> list:
    url = "https://www.codechef.com/api/list/contests/all"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = await client.get(url, headers=headers, timeout=12.0)
        if r.status_code == 200:
            data = r.json()
            future_contests = data.get("future_contests", [])
            upcoming = []
            for c in future_contests:
                code = c.get("contest_code", "")
                if code.startswith(("START", "COOK", "LUNCH", "DSAMONDAY")):
                    start_date_str = c.get("contest_start_date", "")
                    try:
                        # e.g., "15 Jul 2026 20:00:00"
                        dt = datetime.strptime(start_date_str, "%d %b %Y %H:%M:%S")
                        start_ts = int(dt.timestamp())
                    except Exception:
                        start_ts = int(datetime.utcnow().timestamp() + 86400)
                    
                    try:
                        dur_mins = int(c.get("contest_duration", "120"))
                    except Exception:
                        dur_mins = 120
                    
                    upcoming.append({
                        "id": code,
                        "name": c.get("contest_name", code),
                        "platform": "codechef",
                        "start_time_seconds": start_ts,
                        "duration_seconds": dur_mins * 60
                    })
            return upcoming
    except Exception as e:
        logger.error(f"Error fetching CodeChef upcoming contests: {e}")
    return []

async def fetch_atcoder_upcoming(client: httpx.AsyncClient) -> list:
    url = "https://kenkoooo.com/atcoder/resources/contests.json"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = await client.get(url, headers=headers, timeout=12.0)
        if r.status_code == 200:
            data = r.json()
            now = datetime.utcnow().timestamp()
            official_prefixes = ("abc", "arc", "agc", "ahc", "apc")
            return [
                {
                    "id": c["id"],
                    "name": c["title"],
                    "platform": "atcoder",
                    "start_time_seconds": c["start_epoch_second"],
                    "duration_seconds": c["duration_second"]
                }
                for c in data
                if c.get("id", "").startswith(official_prefixes) and
                c.get("start_epoch_second", 0) > now
            ]
    except Exception as e:
        logger.error(f"Error fetching AtCoder upcoming contests: {e}")
    return []

async def sync_upcoming_contests():
    """
    Synchronizes upcoming contests for all 4 platforms and stores them in DB.
    Also prunes expired upcoming contests.
    """
    db = get_database()
    logger.info("Syncing upcoming contests from all platforms...")
    print("Syncing upcoming contests from all platforms...")

    async with httpx.AsyncClient() as client:
        tasks = [
            fetch_codeforces_upcoming(client),
            fetch_leetcode_upcoming(client),
            fetch_codechef_upcoming(client),
            fetch_atcoder_upcoming(client)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        flat_list = []
        for res in results:
            if isinstance(res, list):
                flat_list.extend(res)
            elif isinstance(res, Exception):
                logger.error(f"Upcoming sync platform error: {res}")
                
        # Save to DB
        saved_count = 0
        for c in flat_list:
            doc_id = f"{c['platform']}_{c['id']}"
            await db.future_contests.update_one(
                {"_id": doc_id},
                {"$set": {
                    "name": c["name"],
                    "platform": c["platform"],
                    "start_time_seconds": c["start_time_seconds"],
                    "duration_seconds": c["duration_seconds"],
                    "synced_at": datetime.utcnow()
                }},
                upsert=True
            )
            saved_count += 1
            
        # Prune past contests
        now_ts = int(datetime.utcnow().timestamp())
        prune_res = await db.future_contests.delete_many({
            "start_time_seconds": {"$lt": now_ts - 7200}  # prune if started more than 2 hours ago
        })
        
        logger.info(f"Upcoming sync complete: {saved_count} contests upserted, {prune_res.deleted_count} expired pruned.")
        print(f"Upcoming sync complete: {saved_count} contests upserted, {prune_res.deleted_count} expired pruned.")
        return saved_count
