from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.scheduler import start_scheduler, shutdown_scheduler
from app.services.codeforces import sync_codeforces_data

# Import routers
from app.routes.auth import router as auth_router
from app.routes.contests import router as contests_router
from app.routes.dashboard import router as dashboard_router
from app.routes.compiler import router as compiler_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Coding Portal API",
    description="FastAPI Backend for Codeforces synchronization and online C++ IDE evaluation",
    version="1.0.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all. Alternatively ["http://localhost:5173"] for React Vite.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register lifecycles
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()
    start_scheduler()
    
    # Check if database is empty to trigger initial sync
    db = get_database()
    try:
        contest_count = await db.contests.count_documents({})
        if contest_count == 0:
            logger.info("Database is empty. Triggering initial Codeforces sync in the background...")
            print("Database is empty. Triggering initial Codeforces sync in the background...")
            # We can run it in a background task so it doesn't block the server startup!
            import asyncio
            asyncio.create_task(sync_codeforces_data())
    except Exception as e:
        logger.error(f"Error checking initial database status: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    shutdown_scheduler()
    await close_mongo_connection()

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(contests_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(compiler_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "status": "online",
        "message": "Welcome to the Coding Portal API. Connect using frontend client.",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
