import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field
from app.database import get_database
from app.auth import get_current_user
from app.services.codeforces import sync_codeforces_data
from app.services.leetcode import sync_leetcode_data
from app.services.codechef import sync_codechef_data
from app.services.atcoder import sync_atcoder_data

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Contests & Questions"])

# ─── Response Models ───────────────────────────────────────────────────────────

class PlatformResponse(BaseModel):
    id: str
    name: str
    slug: str
    color: str
    description: str
    url: str
    contest_count: int = 0

class ContestResponse(BaseModel):
    id: str
    name: str
    type: str
    phase: str
    duration_seconds: int
    start_time_seconds: int
    synced_at: datetime
    platform: str = "codeforces"

class QuestionSummary(BaseModel):
    id: str
    contest_id: str
    index: str
    name: str
    rating: int = 800
    tags: List[str] = []
    points: Optional[float] = None
    is_solved: bool = False
    is_favorite: bool = False
    platform: str = "codeforces"

class TestCaseResponse(BaseModel):
    input: str = ""
    output: str = ""

class QuestionDetailResponse(BaseModel):
    id: str
    contest_id: str
    index: str
    name: str
    rating: int = 800
    tags: List[str] = []
    points: Optional[float] = None
    editorial_url: str = ""
    solution_cpp: str = ""
    test_cases: List[TestCaseResponse] = []
    description_html: Optional[str] = None
    is_solved: bool = False
    is_favorite: bool = False
    last_submission_code: Optional[str] = None
    platform: str = "codeforces"

# ─── Default platform seed data ────────────────────────────────────────────────

DEFAULT_PLATFORMS = [
    {
        "_id": "codeforces",
        "name": "Codeforces",
        "slug": "codeforces",
        "color": "#FF4C4C",
        "description": "Competitive programming platform by Mike Mirzayanov. Hosts Div. 1–4 rounds, Educational rounds, and Global rounds.",
        "url": "https://codeforces.com",
    },
    {
        "_id": "leetcode",
        "name": "LeetCode",
        "slug": "leetcode",
        "color": "#FFA116",
        "description": "The go-to platform for coding interview preparation with Weekly and Biweekly contests.",
        "url": "https://leetcode.com",
    },
    {
        "_id": "codechef",
        "name": "CodeChef",
        "slug": "codechef",
        "color": "#B97D4B",
        "description": "Indian competitive programming platform hosting Starters, Cookoff, and Lunchtime contests.",
        "url": "https://www.codechef.com",
    },
    {
        "_id": "atcoder",
        "name": "AtCoder",
        "slug": "atcoder",
        "color": "#5B8BFF",
        "description": "Japanese competitive programming platform with ABC, ARC, AGC, and AHC contests.",
        "url": "https://atcoder.jp",
    },
]

# ─── Platforms Routes ───────────────────────────────────────────────────────────

@router.get("/platforms", response_model=List[PlatformResponse])
async def get_platforms():
    """
    Returns the list of supported coding platforms.
    Seeds default platforms if the collection is empty.
    """
    db = get_database()
    
    # Seed defaults if empty
    count = await db.coding_platforms.count_documents({})
    if count == 0:
        await db.coding_platforms.insert_many(DEFAULT_PLATFORMS)
        logger.info("Seeded default coding platforms into DB.")

    # Count contests per platform
    platforms = []
    async for p in db.coding_platforms.find():
        p["id"] = p["_id"]
        p["contest_count"] = await db.contests.count_documents({"platform": p["slug"]})
        platforms.append(p)
    return platforms

@router.post("/platforms/seed")
async def seed_platforms():
    """
    Force-seeds platform data into the coding_platforms collection.
    """
    db = get_database()
    for p in DEFAULT_PLATFORMS:
        await db.coding_platforms.update_one(
            {"_id": p["_id"]},
            {"$set": p},
            upsert=True
        )
    return {"detail": f"Seeded {len(DEFAULT_PLATFORMS)} platforms successfully."}

# ─── Contests Routes ────────────────────────────────────────────────────────────

@router.get("/contests", response_model=List[ContestResponse])
async def get_contests():
    db = get_database()
    cursor = db.contests.find().sort("start_time_seconds", -1)
    contests = []
    async for doc in cursor:
        doc["id"] = doc["_id"]
        # Ensure required fields have defaults
        doc.setdefault("type", "Unknown")
        doc.setdefault("phase", "FINISHED")
        doc.setdefault("duration_seconds", 0)
        doc.setdefault("start_time_seconds", 0)
        doc.setdefault("synced_at", datetime.utcnow())
        doc.setdefault("platform", "codeforces")
        contests.append(doc)
    return contests

@router.get("/contests/{contest_id}/questions", response_model=List[QuestionSummary])
async def get_contest_questions(contest_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["_id"]

    # Fetch questions — match by contest_id exactly
    cursor = db.questions.find({"contest_id": contest_id}).sort("index", 1)
    questions = []
    q_ids = []
    async for q in cursor:
        q["id"] = q["_id"]
        # Normalise missing fields so Pydantic doesn't reject them
        q.setdefault("rating", 800)
        q.setdefault("tags", [])
        q.setdefault("platform", "codeforces")
        q.setdefault("index", "?")
        q.setdefault("name", q["id"])
        questions.append(q)
        q_ids.append(q["_id"])

    # Fetch user progress
    progress_map = {}
    if q_ids:
        async for prog in db.user_progress.find({"user_id": user_id, "question_id": {"$in": q_ids}}):
            progress_map[prog["question_id"]] = prog

    for q in questions:
        prog = progress_map.get(q["id"])
        if prog:
            q["is_solved"]   = prog.get("status") == "solved"
            q["is_favorite"] = prog.get("is_favorite", False)

    return questions

@router.get("/questions/{question_id}", response_model=QuestionDetailResponse)
async def get_question_details(question_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["_id"]

    q = await db.questions.find_one({"_id": question_id})
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    q["id"] = q["_id"]
    q.setdefault("rating", 800)
    q.setdefault("tags", [])
    q.setdefault("platform", "codeforces")
    q.setdefault("index", "?")
    q.setdefault("name", q["id"])
    q.setdefault("editorial_url", "")
    q.setdefault("solution_cpp", "")
    q.setdefault("test_cases", [])

    prog = await db.user_progress.find_one({"user_id": user_id, "question_id": question_id})
    if prog:
        q["is_solved"]             = prog.get("status") == "solved"
        q["is_favorite"]           = prog.get("is_favorite", False)
        q["last_submission_code"]  = prog.get("last_submission_code")

    return q

# ─── Sync Routes ────────────────────────────────────────────────────────────────

async def sync_all_platforms():
    """Background worker: syncs all platforms sequentially."""
    logger.info("Starting multi-platform sync...")
    for name, fn in [("Codeforces", sync_codeforces_data), ("LeetCode", sync_leetcode_data),
                     ("CodeChef", sync_codechef_data), ("AtCoder", sync_atcoder_data)]:
        try:
            await fn()
        except Exception as e:
            logger.error(f"{name} sync error: {e}")
    logger.info("Multi-platform sync complete.")

@router.post("/contests/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_sync(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    """Triggers a manual sync for all platforms in the background."""
    background_tasks.add_task(sync_all_platforms)
    return {"detail": "Multi-platform synchronization triggered in the background"}
