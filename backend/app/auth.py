from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt as pyjwt # PyJWT
from passlib.context import CryptContext
from bson import ObjectId
from app.config import settings
from app.database import get_database

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

async def create_session(user_id: str, db) -> tuple[str, str]:
    """
    Creates a session in the database and returns (token, session_id).
    """
    session_id = str(ObjectId())
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Payload for JWT
    payload = {
        "sub": user_id,
        "sid": session_id,
        "exp": expire
    }
    
    token = pyjwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    
    # Store session in DB
    session_doc = {
        "_id": ObjectId(session_id),
        "user_id": ObjectId(user_id),
        "token": token,
        "expires_at": expire,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.sessions.insert_one(session_doc)
    
    return token, session_id

async def invalidate_session(session_id: str, db):
    """
    Invalidates a session in the database.
    """
    try:
        await db.sessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"is_active": False}}
        )
    except Exception:
        pass

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency to fetch the authenticated user and validate their session.
    """
    token = credentials.credentials
    db = get_database()
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decode the token
        payload = pyjwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        session_id: str = payload.get("sid")
        if user_id is None or session_id is None:
            raise credentials_exception
    except pyjwt.PyJWTError:
        raise credentials_exception
        
    # Verify session in database
    session = await db.sessions.find_one({
        "_id": ObjectId(session_id),
        "is_active": True
    })
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or been terminated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Check if expired
    if session["expires_at"] < datetime.utcnow():
        await invalidate_session(session_id, db)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Fetch User
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception
        
    # Append session_id to user dictionary so routes can log out/invalidate session
    user["session_id"] = session_id
    return user
