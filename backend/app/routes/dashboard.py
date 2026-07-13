import random
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from bson import ObjectId
from app.database import get_database
from app.auth import get_current_user
from app.routes.contests import QuestionSummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Profile"])

class DailyActivity(BaseModel):
    date: str
    count: int

class PlatformBreakdown(BaseModel):
    codeforces: int = 0
    leetcode: int = 0
    codechef: int = 0
    atcoder: int = 0

class DashboardStats(BaseModel):
    total_questions: int
    solved_questions: int
    completion_rate: float
    favorite_count: int
    favorites: List[QuestionSummary]
    daily_activities: List[DailyActivity] = []
    platform_breakdown: PlatformBreakdown = PlatformBreakdown()

class ToggleFavoriteRequest(BaseModel):
    is_favorite: bool

class ToggleCompleteRequest(BaseModel):
    is_solved: bool

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["_id"]
    
    # 1. Get total questions
    total_questions = await db.questions.count_documents({})
    
    # 2. Get solved questions count
    solved_questions = await db.user_progress.count_documents({
        "user_id": user_id,
        "status": "solved"
    })
    
    # 3. Calculate completion rate
    completion_rate = 0.0
    if total_questions > 0:
        completion_rate = round((solved_questions / total_questions) * 100, 2)
        
    # 4. Fetch favorite questions
    favorites_cursor = db.user_progress.find({
        "user_id": user_id,
        "is_favorite": True
    })
    
    fav_q_ids = []
    async for f in favorites_cursor:
        fav_q_ids.append(f["question_id"])
        
    favorite_count = len(fav_q_ids)
    
    favorites = []
    if fav_q_ids:
        q_cursor = db.questions.find({"_id": {"$in": fav_q_ids}})
        async for q in q_cursor:
            q["id"] = q["_id"]
            q["is_solved"] = False  # will fetch solver status in frontend or join here
            q["is_favorite"] = True
            
            # Check solved status
            solved_doc = await db.user_progress.find_one({
                "user_id": user_id,
                "question_id": q["_id"],
                "status": "solved"
            })
            q["is_solved"] = solved_doc is not None
            favorites.append(q)
            
    # 5. Fetch daily solve dates
    activities_cursor = db.user_progress.find({
        "user_id": user_id,
        "status": "solved",
        "solved_at": {"$ne": None}
    }, {"solved_at": 1})
    
    activity_counts = {}
    async for doc in activities_cursor:
        solved_at = doc.get("solved_at")
        if solved_at:
            date_str = solved_at.strftime("%Y-%m-%d")
            activity_counts[date_str] = activity_counts.get(date_str, 0) + 1
            
    daily_activities = [{"date": d, "count": c} for d, c in activity_counts.items()]
            
    # 6. Fetch platform breakdowns
    platform_breakdown = {}
    for slug in ["codeforces", "leetcode", "codechef", "atcoder"]:
        q_cursor = db.questions.find({"platform": slug}, {"_id": 1})
        q_ids = [doc["_id"] for doc in await q_cursor.to_list(length=2000)]
        solved_count = 0
        if q_ids:
            solved_count = await db.user_progress.count_documents({
                "user_id": user_id,
                "question_id": {"$in": q_ids},
                "status": "solved"
            })
        platform_breakdown[slug] = solved_count

    return {
        "total_questions": total_questions,
        "solved_questions": solved_questions,
        "completion_rate": completion_rate,
        "favorite_count": favorite_count,
        "favorites": favorites,
        "daily_activities": daily_activities,
        "platform_breakdown": platform_breakdown
    }

@router.get("/choose-for-me")
async def choose_unsolved_question(current_user: dict = Depends(get_current_user)):
    db = get_database()
    user_id = current_user["_id"]
    
    # Get solved question ids
    solved_cursor = db.user_progress.find({
        "user_id": user_id,
        "status": "solved"
    }, {"question_id": 1})
    
    solved_ids = [doc["question_id"] for doc in await solved_cursor.to_list(length=1000)]
    
    # Get unsolved questions
    query = {}
    if solved_ids:
        query["_id"] = {"$nin": solved_ids}
        
    questions_cursor = db.questions.find(query, {"_id": 1})
    unsolved_ids = [doc["_id"] for doc in await questions_cursor.to_list(length=1000)]
    
    if not unsolved_ids:
        # If all solved, return any random question
        all_q_cursor = db.questions.find({}, {"_id": 1})
        unsolved_ids = [doc["_id"] for doc in await all_q_cursor.to_list(length=1000)]
        
    if not unsolved_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No questions available in the database yet. Trigger sync."
        )
        
    chosen_id = random.choice(unsolved_ids)
    return {"question_id": chosen_id}

@router.post("/questions/{question_id}/favorite")
async def toggle_favorite(
    question_id: str,
    req: ToggleFavoriteRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    user_id = current_user["_id"]
    
    # Check if question exists
    q = await db.questions.find_one({"_id": question_id})
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    # Update progress document
    await db.user_progress.update_one(
        {"user_id": user_id, "question_id": question_id},
        {"$set": {
            "is_favorite": req.is_favorite,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    return {"detail": "Favorite status updated", "is_favorite": req.is_favorite}

@router.post("/questions/{question_id}/complete")
async def toggle_complete(
    question_id: str,
    req: ToggleCompleteRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    user_id = current_user["_id"]
    
    # Check if question exists
    q = await db.questions.find_one({"_id": question_id})
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    status_str = "solved" if req.is_solved else "in_progress"
    
    # Update progress document
    await db.user_progress.update_one(
        {"user_id": user_id, "question_id": question_id},
        {"$set": {
            "status": status_str,
            "solved_at": datetime.utcnow() if req.is_solved else None,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    return {"detail": "Completion status updated", "is_solved": req.is_solved}
