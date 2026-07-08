from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
from app.database import get_database
from app.auth import (
    hash_password,
    verify_password,
    create_session,
    invalidate_session,
    get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserRegister):
    db = get_database()
    
    # Check if username or email already exists
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
        
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    # Hash password and insert user
    new_user = {
        "username": user_data.username,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(new_user)
    user_id = str(result.inserted_id)
    
    # Create JWT session
    token, _ = await create_session(user_id, db)
    
    return {
        "access_token": token,
        "user": {
            "id": user_id,
            "username": new_user["username"],
            "email": new_user["email"],
            "created_at": new_user["created_at"]
        }
    }

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    db = get_database()
    
    # Find user by username or email
    user = await db.users.find_one({
        "$or": [
            {"username": credentials.username},
            {"email": credentials.username}
        ]
    })
    
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
        
    user_id = str(user["_id"])
    
    # Create JWT session
    token, _ = await create_session(user_id, db)
    
    return {
        "access_token": token,
        "user": {
            "id": user_id,
            "username": user["username"],
            "email": user["email"],
            "created_at": user["created_at"]
        }
    }

@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    db = get_database()
    session_id = current_user.get("session_id")
    if session_id:
        await invalidate_session(session_id, db)
    return {"detail": "Successfully logged out"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "username": current_user["username"],
        "email": current_user["email"],
        "created_at": current_user["created_at"]
    }
