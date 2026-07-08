from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
import asyncio
from app.services.codeforces import sync_codeforces_data
from app.services.leetcode import sync_leetcode_data
from app.services.codechef import sync_codechef_data
from app.services.atcoder import sync_atcoder_data

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()

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
    logger.info("Scheduler daily sync completed successfully.")

def run_sync_in_thread():
    """
    Helper function to run the async sync coroutine in a background event loop
    since APScheduler runs in a separate thread.
    """
    logger.info("Scheduler thread triggered multi-platform sync...")
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(sync_all_platforms_async())
        loop.close()
    except Exception as e:
        logger.error(f"Error executing scheduled multi-platform sync: {e}")

def start_scheduler():
    """
    Starts the background scheduler to run the synchronization job daily at 5 AM.
    """
    if not scheduler.running:
        scheduler.add_job(
            run_sync_in_thread,
            trigger=CronTrigger(hour=5, minute=0),
            id="multi_platform_sync_daily",
            name="Sync latest 5 contests from all platforms daily at 5 AM",
            replace_existing=True
        )
        scheduler.start()
        logger.info("APScheduler started: Daily sync for all platforms scheduled for 5:00 AM.")
        print("APScheduler started: Daily sync for all platforms scheduled for 5:00 AM.")

def shutdown_scheduler():
    """
    Gracefully shuts down the scheduler.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler shut down.")
