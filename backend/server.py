from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'REMOVED_SECRET')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 168  # 7 days

# Create the main app
app = FastAPI(title="RevealIQ Study Companion API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    coins: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    total_study_time: int = 0
    onboarding_completed: bool = False
    created_at: str

class OnboardingData(BaseModel):
    class_level: str  # "8", "9", "10", "11", "12", "college"
    subjects: List[str]
    daily_target_minutes: int
    theme: str = "dark"

class StudySessionCreate(BaseModel):
    subject: str
    duration_minutes: int
    focus_score: float  # 0-100, based on anti-cheat detection
    was_interrupted: bool = False
    interruption_count: int = 0

class StudySessionResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    subject: str
    duration_minutes: int
    coins_earned: int
    focus_score: float
    was_interrupted: bool
    created_at: str

class TaskCreate(BaseModel):
    title: str
    subject: str
    estimated_minutes: int = 30
    due_date: Optional[str] = None

class TaskResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    task_id: str
    user_id: str
    title: str
    subject: str
    estimated_minutes: int
    completed: bool
    due_date: Optional[str]
    created_at: str

class CoinTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str
    user_id: str
    amount: int
    reason: str
    created_at: str

class BadgeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    badge_id: str
    name: str
    description: str
    icon: str
    coins_required: int
    unlocked: bool = False
    unlocked_at: Optional[str] = None

class MilestoneResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    milestone_id: str
    name: str
    description: str
    coins_required: int
    reward_description: str
    achieved: bool = False
    achieved_at: Optional[str] = None

class AITipRequest(BaseModel):
    context: str = "general"  # general, motivation, study_tip, subject_specific
    subject: Optional[str] = None

class AITipResponse(BaseModel):
    tip: str
    category: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_jwt_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    # Check cookies first, then Authorization header
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Try JWT token first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id:
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            if user:
                return user
    except jwt.ExpiredSignatureError:
        pass
    except jwt.InvalidTokenError:
        pass
    
    # Try session token (Google OAuth)
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        expires_at = session.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
        if user:
            return user
    
    raise HTTPException(status_code=401, detail="Invalid token")

# ==================== COIN CALCULATION ====================

def calculate_coins(duration_minutes: int, focus_score: float, was_interrupted: bool) -> int:
    """Calculate coins earned based on study session"""
    base_coins = 0
    
    # Base coins for duration
    if duration_minutes >= 25:
        base_coins = 20
    if duration_minutes >= 50:
        base_coins = 50
    if duration_minutes >= 90:
        base_coins = 100
    
    # Apply focus score multiplier (0.5x to 1.5x)
    multiplier = 0.5 + (focus_score / 100)
    coins = int(base_coins * multiplier)
    
    # Penalty for interruptions
    if was_interrupted:
        coins = int(coins * 0.7)
    
    return max(coins, 0)

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user_data: UserCreate, response: Response):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(user_data.password)
    
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hashed_pw,
        "picture": None,
        "coins": 0,
        "current_streak": 0,
        "longest_streak": 0,
        "total_study_time": 0,
        "onboarding_completed": False,
        "class_level": None,
        "subjects": [],
        "daily_target_minutes": 120,
        "theme": "dark",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_jwt_token(user_id)
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_HOURS * 3600,
        path="/"
    )
    
    del user_doc["password"]
    del user_doc["_id"] if "_id" in user_doc else None
    
    return {"user": user_doc, "token": token}

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin, response: Response):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["user_id"])
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=JWT_EXPIRATION_HOURS * 3600,
        path="/"
    )
    
    user_response = {k: v for k, v in user.items() if k not in ["password", "_id"]}
    return {"user": user_response, "token": token}

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
@api_router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    """Exchange Google OAuth session_id for user data"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        oauth_data = resp.json()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": oauth_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": oauth_data.get("name", existing_user.get("name")),
                "picture": oauth_data.get("picture")
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": oauth_data["email"],
            "name": oauth_data.get("name", "Student"),
            "picture": oauth_data.get("picture"),
            "coins": 100,  # Welcome bonus
            "current_streak": 0,
            "longest_streak": 0,
            "total_study_time": 0,
            "onboarding_completed": False,
            "class_level": None,
            "subjects": [],
            "daily_target_minutes": 120,
            "theme": "dark",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
        
        # Add welcome bonus transaction
        await db.coin_transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "amount": 100,
            "reason": "Welcome bonus",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Store session
    session_token = oauth_data.get("session_token")
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 3600,
        path="/"
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    return {"user": user, "token": session_token}

@api_router.get("/auth/me", response_model=dict)
async def get_me(user: dict = Depends(get_current_user)):
    user_data = {k: v for k, v in user.items() if k != "password"}
    return user_data

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== ONBOARDING ROUTES ====================

@api_router.post("/onboarding", response_model=dict)
async def complete_onboarding(data: OnboardingData, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "class_level": data.class_level,
            "subjects": data.subjects,
            "daily_target_minutes": data.daily_target_minutes,
            "theme": data.theme,
            "onboarding_completed": True
        }}
    )
    
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password": 0})
    return updated_user

# ==================== STUDY SESSION ROUTES ====================

@api_router.post("/study/session", response_model=StudySessionResponse)
async def create_study_session(session_data: StudySessionCreate, user: dict = Depends(get_current_user)):
    coins_earned = calculate_coins(
        session_data.duration_minutes,
        session_data.focus_score,
        session_data.was_interrupted
    )
    
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    session_doc = {
        "session_id": session_id,
        "user_id": user["user_id"],
        "subject": session_data.subject,
        "duration_minutes": session_data.duration_minutes,
        "coins_earned": coins_earned,
        "focus_score": session_data.focus_score,
        "was_interrupted": session_data.was_interrupted,
        "interruption_count": session_data.interruption_count,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.study_sessions.insert_one(session_doc)
    
    # Update user stats
    new_coins = user.get("coins", 0) + coins_earned
    new_total_time = user.get("total_study_time", 0) + session_data.duration_minutes
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "coins": new_coins,
            "total_study_time": new_total_time
        }}
    )
    
    # Add coin transaction
    if coins_earned > 0:
        await db.coin_transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "amount": coins_earned,
            "reason": f"Study session: {session_data.subject} ({session_data.duration_minutes} min)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    del session_doc["_id"] if "_id" in session_doc else None
    return StudySessionResponse(**session_doc)

@api_router.get("/study/sessions", response_model=List[StudySessionResponse])
async def get_study_sessions(user: dict = Depends(get_current_user), limit: int = 20):
    sessions = await db.study_sessions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [StudySessionResponse(**s) for s in sessions]

@api_router.get("/study/stats")
async def get_study_stats(user: dict = Depends(get_current_user)):
    # Get today's sessions
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    today_sessions = await db.study_sessions.find({
        "user_id": user["user_id"],
        "created_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    today_minutes = sum(s.get("duration_minutes", 0) for s in today_sessions)
    today_coins = sum(s.get("coins_earned", 0) for s in today_sessions)
    
    # Get this week's sessions
    week_start = today_start - timedelta(days=today_start.weekday())
    week_sessions = await db.study_sessions.find({
        "user_id": user["user_id"],
        "created_at": {"$gte": week_start.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    week_minutes = sum(s.get("duration_minutes", 0) for s in week_sessions)
    
    # Daily breakdown for the week
    daily_breakdown = {}
    for s in week_sessions:
        date = s.get("created_at", "")[:10]
        if date not in daily_breakdown:
            daily_breakdown[date] = {"minutes": 0, "coins": 0}
        daily_breakdown[date]["minutes"] += s.get("duration_minutes", 0)
        daily_breakdown[date]["coins"] += s.get("coins_earned", 0)
    
    return {
        "today_minutes": today_minutes,
        "today_coins": today_coins,
        "week_minutes": week_minutes,
        "daily_target": user.get("daily_target_minutes", 120),
        "daily_breakdown": daily_breakdown,
        "total_study_time": user.get("total_study_time", 0),
        "current_streak": user.get("current_streak", 0),
        "longest_streak": user.get("longest_streak", 0)
    }

# ==================== STREAK ROUTES ====================

@api_router.post("/streak/update")
async def update_streak(user: dict = Depends(get_current_user)):
    """Call this after completing daily goal to update streak"""
    today = datetime.now(timezone.utc).date()
    
    # Get last streak update
    streak_doc = await db.streaks.find_one({"user_id": user["user_id"]}, {"_id": 0})
    
    current_streak = user.get("current_streak", 0)
    longest_streak = user.get("longest_streak", 0)
    
    if streak_doc:
        last_update = streak_doc.get("last_update")
        if last_update:
            if isinstance(last_update, str):
                last_date = datetime.fromisoformat(last_update).date()
            else:
                last_date = last_update.date()
            
            days_diff = (today - last_date).days
            
            if days_diff == 0:
                # Already updated today
                return {"current_streak": current_streak, "longest_streak": longest_streak}
            elif days_diff == 1:
                # Consecutive day
                current_streak += 1
            else:
                # Streak broken
                current_streak = 1
    else:
        current_streak = 1
    
    longest_streak = max(longest_streak, current_streak)
    
    # Update streak record
    await db.streaks.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "last_update": today.isoformat(),
            "current_streak": current_streak
        }},
        upsert=True
    )
    
    # Update user
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "current_streak": current_streak,
            "longest_streak": longest_streak
        }}
    )
    
    # Award streak bonuses
    bonus_coins = 0
    bonus_reason = None
    
    if current_streak == 7:
        bonus_coins = 200
        bonus_reason = "7-day streak bonus"
    elif current_streak == 30:
        bonus_coins = 1000
        bonus_reason = "30-day streak bonus"
    elif current_streak % 7 == 0:
        bonus_coins = 100
        bonus_reason = f"{current_streak}-day streak milestone"
    
    if bonus_coins > 0:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"coins": bonus_coins}}
        )
        await db.coin_transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "amount": bonus_coins,
            "reason": bonus_reason,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "bonus_coins": bonus_coins
    }

@api_router.get("/streak/calendar")
async def get_streak_calendar(user: dict = Depends(get_current_user)):
    """Get study activity for the last 30 days"""
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    sessions = await db.study_sessions.find({
        "user_id": user["user_id"],
        "created_at": {"$gte": thirty_days_ago.isoformat()}
    }, {"_id": 0, "created_at": 1, "duration_minutes": 1}).to_list(1000)
    
    calendar = {}
    for s in sessions:
        date = s.get("created_at", "")[:10]
        if date not in calendar:
            calendar[date] = 0
        calendar[date] += s.get("duration_minutes", 0)
    
    daily_target = user.get("daily_target_minutes", 120)
    
    return {
        "calendar": calendar,
        "daily_target": daily_target,
        "current_streak": user.get("current_streak", 0)
    }

# ==================== TASK ROUTES ====================

@api_router.post("/tasks", response_model=TaskResponse)
async def create_task(task_data: TaskCreate, user: dict = Depends(get_current_user)):
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task_doc = {
        "task_id": task_id,
        "user_id": user["user_id"],
        "title": task_data.title,
        "subject": task_data.subject,
        "estimated_minutes": task_data.estimated_minutes,
        "completed": False,
        "due_date": task_data.due_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(task_doc)
    del task_doc["_id"] if "_id" in task_doc else None
    return TaskResponse(**task_doc)

@api_router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(user: dict = Depends(get_current_user), completed: Optional[bool] = None):
    query = {"user_id": user["user_id"]}
    if completed is not None:
        query["completed"] = completed
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [TaskResponse(**t) for t in tasks]

@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, user: dict = Depends(get_current_user)):
    result = await db.tasks.update_one(
        {"task_id": task_id, "user_id": user["user_id"]},
        {"$set": {"completed": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Award bonus coins for completing task
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"coins": 10}}
    )
    
    await db.coin_transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "amount": 10,
        "reason": "Task completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Task completed", "coins_earned": 10}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    result = await db.tasks.delete_one({"task_id": task_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted"}

# ==================== WALLET & REWARDS ROUTES ====================

@api_router.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user)):
    # Get recent transactions
    transactions = await db.coin_transactions.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Get today's coins
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_transactions = await db.coin_transactions.find({
        "user_id": user["user_id"],
        "created_at": {"$gte": today_start.isoformat()}
    }, {"_id": 0}).to_list(100)
    
    today_coins = sum(t.get("amount", 0) for t in today_transactions)
    
    return {
        "total_coins": user.get("coins", 0),
        "today_coins": today_coins,
        "transactions": transactions
    }

@api_router.get("/badges")
async def get_badges(user: dict = Depends(get_current_user)):
    # Define badges
    badges = [
        {"badge_id": "first_session", "name": "First Step", "description": "Complete your first study session", "icon": "star", "coins_required": 0, "check": user.get("total_study_time", 0) > 0},
        {"badge_id": "hour_hero", "name": "Hour Hero", "description": "Study for 1 hour total", "icon": "clock", "coins_required": 0, "check": user.get("total_study_time", 0) >= 60},
        {"badge_id": "streak_starter", "name": "Streak Starter", "description": "Achieve a 3-day streak", "icon": "flame", "coins_required": 0, "check": user.get("current_streak", 0) >= 3 or user.get("longest_streak", 0) >= 3},
        {"badge_id": "week_warrior", "name": "Week Warrior", "description": "Achieve a 7-day streak", "icon": "trophy", "coins_required": 0, "check": user.get("longest_streak", 0) >= 7},
        {"badge_id": "coin_collector", "name": "Coin Collector", "description": "Earn 1,000 coins", "icon": "coins", "coins_required": 1000, "check": user.get("coins", 0) >= 1000},
        {"badge_id": "study_master", "name": "Study Master", "description": "Earn 5,000 coins", "icon": "medal", "coins_required": 5000, "check": user.get("coins", 0) >= 5000},
        {"badge_id": "legend", "name": "Legend", "description": "Earn 10,000 coins", "icon": "crown", "coins_required": 10000, "check": user.get("coins", 0) >= 10000},
        {"badge_id": "month_master", "name": "Month Master", "description": "Achieve a 30-day streak", "icon": "calendar", "coins_required": 0, "check": user.get("longest_streak", 0) >= 30}
    ]
    
    return [{
        "badge_id": b["badge_id"],
        "name": b["name"],
        "description": b["description"],
        "icon": b["icon"],
        "coins_required": b["coins_required"],
        "unlocked": b["check"]
    } for b in badges]

@api_router.get("/milestones")
async def get_milestones(user: dict = Depends(get_current_user)):
    milestones = [
        {"milestone_id": "bronze", "name": "Bronze Scholar", "description": "Reach 1,000 coins", "coins_required": 1000, "reward_description": "Unlock badge"},
        {"milestone_id": "silver", "name": "Silver Scholar", "description": "Reach 5,000 coins", "coins_required": 5000, "reward_description": "Certificate of Achievement"},
        {"milestone_id": "gold", "name": "Gold Scholar", "description": "Reach 10,000 coins", "coins_required": 10000, "reward_description": "Eligible for rewards (₹1,000 value)"}
    ]
    
    user_coins = user.get("coins", 0)
    
    return [{
        "milestone_id": m["milestone_id"],
        "name": m["name"],
        "description": m["description"],
        "coins_required": m["coins_required"],
        "reward_description": m["reward_description"],
        "achieved": user_coins >= m["coins_required"],
        "progress": min(100, int((user_coins / m["coins_required"]) * 100))
    } for m in milestones]

# ==================== AI TIPS ROUTES ====================

@api_router.post("/ai/tip", response_model=AITipResponse)
async def get_ai_tip(request: AITipRequest, user: dict = Depends(get_current_user)):
    """Generate AI-powered study tips"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        # Fallback tips if no API key
        fallback_tips = {
            "general": "Take short breaks every 25 minutes to maintain focus. The Pomodoro technique can boost your productivity!",
            "motivation": f"You've earned {user.get('coins', 0)} coins! Keep up the great work. Every minute of study brings you closer to your goals.",
            "study_tip": "Try teaching what you've learned to someone else. It's one of the best ways to solidify your understanding.",
            "subject_specific": "Focus on understanding concepts rather than memorizing. Use diagrams and mind maps to visualize connections."
        }
        return AITipResponse(
            tip=fallback_tips.get(request.context, fallback_tips["general"]),
            category=request.context
        )
    
    prompts = {
        "general": f"Give a brief, encouraging study tip for a student who has studied for {user.get('total_study_time', 0)} minutes total and has a {user.get('current_streak', 0)}-day streak. Keep it under 2 sentences.",
        "motivation": f"Give a motivational message to a student with {user.get('coins', 0)} coins and {user.get('current_streak', 0)}-day streak. Be encouraging but not cheesy. Keep it under 2 sentences.",
        "study_tip": "Share one specific, actionable study technique that can improve focus and retention. Keep it under 2 sentences.",
        "subject_specific": f"Give a study tip specifically for {request.subject or 'general academics'}. Keep it practical and under 2 sentences."
    }
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"tip_{user['user_id']}_{uuid.uuid4().hex[:8]}",
            system_message="You are a friendly study coach for students. Give brief, practical advice. No emojis."
        ).with_model("openai", "gpt-4o")
        
        message = UserMessage(text=prompts.get(request.context, prompts["general"]))
        response = await chat.send_message(message)
        
        return AITipResponse(tip=response, category=request.context)
    except Exception as e:
        logger.error(f"AI tip generation failed: {e}")
        return AITipResponse(
            tip="Stay consistent with your study routine. Small daily progress leads to big results!",
            category=request.context
        )

# ==================== USER SETTINGS ====================

@api_router.patch("/user/settings")
async def update_settings(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    allowed_fields = ["theme", "daily_target_minutes", "subjects"]
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    
    if update_data:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password": 0})
    return updated_user

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "RevealIQ Study Companion API", "status": "healthy"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
