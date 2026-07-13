from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
from app.services.codeforces import sync_codeforces_data
from app.services.leetcode import sync_leetcode_data
from app.services.codechef import sync_codechef_data
from app.services.atcoder import sync_atcoder_data
from app.services.upcoming_contests import sync_upcoming_contests

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

async def sync_all_platforms_async():
    """
    Sequentially syncs all platforms in the async loop.
    """
    logger.info("Scheduler starting daily sync for all platforms...")
    try:
        await sync_codeforces_data()
    except Exception as e:
        logger.error(f"Scheduler CF sync error: {e}")
        
    try:
        await sync_leetcode_data()
    except Exception as e:
        logger.error(f"Scheduler LeetCode sync error: {e}")
        
    try:
        await sync_codechef_data()
    except Exception as e:
        logger.error(f"Scheduler CodeChef sync error: {e}")
        
    try:
        await sync_atcoder_data()
    except Exception as e:
        logger.error(f"Scheduler AtCoder sync error: {e}")

    try:
        await sync_upcoming_contests()
    except Exception as e:
        logger.error(f"Scheduler Upcoming Contests sync error: {e}")

    logger.info("Scheduler daily sync completed successfully.")

def start_scheduler():
    """
    Starts the background scheduler to run the synchronization job daily at 5 AM.
    """
    if not scheduler.running:
        scheduler.add_job(
            sync_all_platforms_async,
            trigger=CronTrigger(hour=5, minute=0, timezone="Asia/Kolkata"),
            id="multi_platform_sync_daily",
            name="Sync latest 5 contests from all platforms daily at 5 AM IST",
            replace_existing=True
        )
        scheduler.start()
        logger.info("APScheduler started: Daily sync for all platforms scheduled for 5:00 AM IST.")
        print("APScheduler started: Daily sync for all platforms scheduled for 5:00 AM IST.")

def shutdown_scheduler():
    """
    Gracefully shuts down the scheduler.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler shut down.")
