import asyncio
import logging
import sys
import os
import dns.resolver

# ─── Force Google DNS before any MongoDB import ───────────────────────────────
_r = dns.resolver.Resolver(configure=False)
_r.nameservers = ['8.8.8.8', '8.8.4.4']
dns.resolver.default_resolver = _r

# Adjust path so we can import from backend
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.services.codeforces import sync_codeforces_data
from app.services.leetcode import sync_leetcode_data
from app.services.codechef import sync_codechef_data
from app.services.atcoder import sync_atcoder_data

# Configure logging to stdout
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Verifier")

PLATFORMS = [
    {"_id": "codeforces", "name": "Codeforces", "slug": "codeforces", "color": "#FF4C4C",
     "description": "Competitive programming rounds (Div 1-4, Educational, Global).", "url": "https://codeforces.com"},
    {"_id": "leetcode",   "name": "LeetCode",   "slug": "leetcode",   "color": "#FFA116",
     "description": "Weekly & Biweekly contest problems.",               "url": "https://leetcode.com"},
    {"_id": "codechef",   "name": "CodeChef",   "slug": "codechef",   "color": "#B97D4B",
     "description": "Starters, Cookoff, Lunchtime contests.",           "url": "https://www.codechef.com"},
    {"_id": "atcoder",    "name": "AtCoder",    "slug": "atcoder",    "color": "#5B8BFF",
     "description": "ABC, ARC, AGC, and AHC contests.",                 "url": "https://atcoder.jp"},
]

async def test_full_system():
    logger.info("Initializing system verification...")

    # 1. Connect to MongoDB
    logger.info("Connecting to MongoDB...")
    await connect_to_mongo()
    db = get_database()

    if db is None:
        logger.error("Could not obtain database instance.")
        await close_mongo_connection()
        return

    logger.info("Successfully connected to MongoDB!")

    # 2. Seed coding_platforms collection
    count = await db.coding_platforms.count_documents({})
    if count == 0:
        await db.coding_platforms.insert_many(PLATFORMS)
        logger.info(f"Seeded {len(PLATFORMS)} platforms into coding_platforms collection.")
    else:
        logger.info(f"coding_platforms already has {count} entries — skipping seed.")

    # 3. Sync all platforms
    for platform_name, sync_fn in [
        ("Codeforces", sync_codeforces_data),
        ("LeetCode",   sync_leetcode_data),
        ("CodeChef",   sync_codechef_data),
        ("AtCoder",    sync_atcoder_data),
    ]:
        logger.info(f"Starting {platform_name} sync...")
        try:
            await sync_fn()
            logger.info(f"{platform_name} sync complete.")
        except Exception as e:
            logger.error(f"{platform_name} sync failed: {e}")

    # 4. Print DB Stats
    try:
        contests_count  = await db.contests.count_documents({})
        questions_count = await db.questions.count_documents({})
        platforms_count = await db.coding_platforms.count_documents({})
        logger.info("Database statistics:")
        logger.info(f"  - Platforms in DB : {platforms_count}")
        logger.info(f"  - Contests in DB  : {contests_count}")
        logger.info(f"  - Questions in DB : {questions_count}")

        if contests_count > 0:
            logger.info("Listing contests:")
            async for doc in db.contests.find().sort("start_time_seconds", -1).limit(6):
                logger.info(f"  * [{doc.get('platform','cf')}] {doc['_id']} | {doc['name']}")

        if questions_count > 0:
            q = await db.questions.find_one({})
            logger.info(f"Sample question: {q['_id']} | Rating: {q.get('rating')} | Platform: {q.get('platform','cf')}")
    except Exception as e:
        logger.error(f"Failed to query database stats: {e}")

    # 5. Cleanup
    logger.info("Closing MongoDB connection...")
    await close_mongo_connection()
    logger.info("Verification complete.")

if __name__ == "__main__":
    asyncio.run(test_full_system())
