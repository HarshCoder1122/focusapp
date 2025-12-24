from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import uuid
from pathlib import Path
from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

# Load .env file if it exists (for local development)
ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'
if env_path.exists():
    load_dotenv(env_path)

# Supabase connection
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Lazy initialization for serverless
supabase = None

def get_supabase():
    global supabase
    if supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(status_code=500, detail="Database not configured")
        from supabase import create_client, Client
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_KEY)
    return supabase

# Separate client with anon key for OAuth token verification
# OAuth tokens from the browser are signed for the anon key, not service key
supabase_anon = None

def get_supabase_anon():
    global supabase_anon
    if supabase_anon is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(status_code=500, detail="Database not configured")
        from supabase import create_client, Client
        supabase_anon = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase_anon

# Gemini Config - lazy initialization
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
gemini_model = None

def get_gemini_model():
    global gemini_model
    if gemini_model is None and GEMINI_API_KEY:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel('gemini-2.5-flash')
    return gemini_model

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

class OnboardingData(BaseModel):
    class_level: str
    subjects: List[str]
    daily_target_minutes: int
    theme: str = "dark"

class StudySessionCreate(BaseModel):
    subject: str
    duration_minutes: int
    focus_score: float
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

class AITipRequest(BaseModel):
    context: str = "general"
    subject: Optional[str] = None

class AITipResponse(BaseModel):
    tip: str
    category: str

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> dict:
    # Check cookies first, then Authorization header
    token = request.cookies.get("sb_access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Verify token with Supabase
        user_response = get_supabase().auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_id = user_response.user.id
        
        # Fetch detailed user profile from 'users' table
        profile_response = get_supabase().table("users").select("*").eq("user_id", user_id).single().execute()
        
        if profile_response.data:
            return profile_response.data
        else:
            # Should not happen if triggers are set up, but let's handle it
            raise HTTPException(status_code=404, detail="User profile not found")
            
    except Exception as e:
        print(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Session expired or invalid")

# ==================== COIN CALCULATION ====================

def calculate_coins(duration_minutes: int, focus_score: float, was_interrupted: bool) -> int:
    base_coins = 0
    if duration_minutes >= 25: base_coins = 20
    if duration_minutes >= 50: base_coins = 50
    if duration_minutes >= 90: base_coins = 100
    
    multiplier = 0.5 + (focus_score / 100)
    coins = int(base_coins * multiplier)
    
    if was_interrupted:
        coins = int(coins * 0.7)
    
    return max(coins, 0)

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    try:
        # Sign up with Supabase Auth
        auth_response = get_supabase().auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "full_name": user_data.name
                }
            }
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Registration failed")
            
        user_id = auth_response.user.id
        
        # Create user profile in 'users' table
        # We manually insert here to ensure the fields match our app schema
        user_doc = {
            "user_id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "coins": 0,
            "current_streak": 0,
            "total_study_time": 0,
            "onboarding_completed": False,
            "daily_target_minutes": 120,
            "theme": "dark"
        }
        
        get_supabase().table("users").insert(user_doc).execute()
        
        # Set cookie if session exists (auto-login usually happens on signup)
        if auth_response.session:
            response.set_cookie(
                key="sb_access_token",
                value=auth_response.session.access_token,
                httponly=True,
                secure=True,
                samesite="none",
                max_age=3600 * 24 * 7,
                path="/"
            )
            return {"user": user_doc, "token": auth_response.session.access_token}
            
        return {"message": "Registration successful. Please check your email if confirmation is enabled."}
        
    except Exception as e:
        # Handle specific Supabase errors if possible
        if "User already registered" in str(e):
             raise HTTPException(status_code=400, detail="Email already registered")
        print(f"Register Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    try:
        auth_response = get_supabase().auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        
        if not auth_response.user or not auth_response.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        # Get user profile
        user_id = auth_response.user.id
        profile_response = get_supabase().table("users").select("*").eq("user_id", user_id).single().execute()
        
        if not profile_response.data:
            # Need to create profile if it doesn't exist (e.g. if created via dashboard)
            user_doc = {
                "user_id": user_id,
                "email": credentials.email,
                "name": auth_response.user.user_metadata.get("full_name", "Student"),
                "coins": 0,
                "current_streak": 0,
                "onboarding_completed": False
            }
            get_supabase().table("users").insert(user_doc).execute()
            user_response = user_doc
        else:
            user_response = profile_response.data
            
        response.set_cookie(
            key="sb_access_token",
            value=auth_response.session.access_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=3600 * 24 * 7,
            path="/"
        )
        
        return {"user": user_response, "token": auth_response.session.access_token}
        
    except Exception as e:
        print(f"Login Error: {e}")
        raise HTTPException(status_code=400, detail="Invalid login credentials")

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("sb_access_token")
    if token:
        try:
            get_supabase().auth.sign_out()
        except:
            pass
    
    response.delete_cookie(key="sb_access_token", path="/")
    return {"message": "Logged out successfully"}

# Google OAuth callback - verify access token and return user
class GoogleCallbackData(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None

@api_router.post("/auth/google/callback")
async def google_oauth_callback(data: GoogleCallbackData, response: Response):
    try:
        # Log incoming token info for debugging (not the actual token)
        print(f"OAuth callback received - token length: {len(data.access_token) if data.access_token else 0}")
        
        if not data.access_token:
            raise HTTPException(status_code=400, detail="No access token provided")
        
        # For OAuth tokens, we need to set the session first, then get the user
        # This is the correct approach for the Supabase Python library
        try:
            # Get the anon client
            anon_client = get_supabase_anon()
            
            # Set the session using the tokens from the OAuth callback
            # refresh_token might be None but that's okay for verification
            session_response = anon_client.auth.set_session(
                access_token=data.access_token,
                refresh_token=data.refresh_token or ""
            )
            
            if not session_response or not session_response.user:
                raise HTTPException(status_code=401, detail="Invalid session - could not set session")
            
            user_response_user = session_response.user
            
        except Exception as auth_error:
            print(f"Supabase set_session error: {type(auth_error).__name__}: {auth_error}")
            raise HTTPException(status_code=401, detail=f"Token verification failed: {str(auth_error)}")
        
        if not user_response_user:
            raise HTTPException(status_code=401, detail="Invalid access token - no user returned")
        
        user_id = user_response_user.id
        user_email = user_response_user.email
        user_name = user_response_user.user_metadata.get("full_name") or user_response_user.user_metadata.get("name") or "Student"
        
        print(f"OAuth user verified: {user_email}")
        
        # Check if user profile exists
        profile_response = get_supabase().table("users").select("*").eq("user_id", user_id).execute()
        
        if profile_response.data and len(profile_response.data) > 0:
            user_profile = profile_response.data[0]
        else:
            # Create new user profile for OAuth user
            user_doc = {
                "user_id": user_id,
                "email": user_email,
                "name": user_name,
                "coins": 0,
                "current_streak": 0,
                "total_study_time": 0,
                "onboarding_completed": False,
                "daily_target_minutes": 120,
                "theme": "dark"
            }
            get_supabase().table("users").insert(user_doc).execute()
            user_profile = user_doc
        
        # Set auth cookie
        response.set_cookie(
            key="sb_access_token",
            value=data.access_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=3600 * 24 * 7,
            path="/"
        )
        
        return {"user": user_profile, "token": data.access_token}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Google OAuth callback unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== ONBOARDING ====================

@api_router.post("/onboarding")
async def complete_onboarding(data: OnboardingData, user: dict = Depends(get_current_user)):
    update_data = {
        "class_level": data.class_level,
        "subjects": data.subjects, # Supabase handles arrays
        "daily_target_minutes": data.daily_target_minutes,
        "theme": data.theme,
        "onboarding_completed": True
    }
    
    get_supabase().table("users").update(update_data).eq("user_id", user["user_id"]).execute()
    
    # Return updated user
    updated = get_supabase().table("users").select("*").eq("user_id", user["user_id"]).single().execute()
    return updated.data

# ==================== STUDY SESSIONS ====================

@api_router.post("/study/session", response_model=StudySessionResponse)
async def create_study_session(session_data: StudySessionCreate, user: dict = Depends(get_current_user)):
    coins_earned = calculate_coins(
        session_data.duration_minutes,
        session_data.focus_score,
        session_data.was_interrupted
    )
    
    session_id = str(uuid.uuid4())
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
    
    get_supabase().table("study_sessions").insert(session_doc).execute()
    
    # Update user stats
    new_coins = user.get("coins", 0) + coins_earned
    new_total_time = user.get("total_study_time", 0) + session_data.duration_minutes
    
    get_supabase().table("users").update({
        "coins": new_coins,
        "total_study_time": new_total_time
    }).eq("user_id", user["user_id"]).execute()
    
    # Add transaction
    if coins_earned > 0:
        get_supabase().table("coin_transactions").insert({
            "transaction_id": str(uuid.uuid4()),
            "user_id": user["user_id"],
            "amount": coins_earned,
            "reason": f"Study session: {session_data.subject} ({session_data.duration_minutes} min)",
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
    return StudySessionResponse(**session_doc)

@api_router.get("/study/stats")
async def get_study_stats(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    
    # Calculate dates
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    
    # Check if streaks need update
    # In a real app we might do this slightly differently, but let's just fetch streak from users table
    # We might need to fetch sessions for calculation if stats not stored, but we store stats in user profile
    
    # Retrieve today's sessions manually to sum up
    today_resp = get_supabase().table("study_sessions").select("duration_minutes, coins_earned").eq("user_id", user_id).gte("created_at", today_start.isoformat()).execute()
    today_sessions = today_resp.data
    
    today_minutes = sum(s["duration_minutes"] for s in today_sessions)
    today_coins = sum(s["coins_earned"] for s in today_sessions)
    
    # Retrieve week sessions
    week_resp = get_supabase().table("study_sessions").select("duration_minutes, coins_earned, created_at").eq("user_id", user_id).gte("created_at", week_start.isoformat()).execute()
    week_sessions = week_resp.data
    
    week_minutes = sum(s["duration_minutes"] for s in week_sessions)
    
    daily_breakdown = {}
    for s in week_sessions:
        # isoformat includes T, e.g. 2023-10-10T10:10...
        date = s["created_at"].split('T')[0]
        if date not in daily_breakdown:
            daily_breakdown[date] = {"minutes": 0, "coins": 0}
        daily_breakdown[date]["minutes"] += s["duration_minutes"]
        daily_breakdown[date]["coins"] += s["coins_earned"]
        
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

# ==================== STREAK ====================

@api_router.get("/streak/calendar")
async def get_streak_calendar(user: dict = Depends(get_current_user)):
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    resp = get_supabase().table("study_sessions").select("duration_minutes, created_at")\
        .eq("user_id", user["user_id"])\
        .gte("created_at", thirty_days_ago.isoformat())\
        .execute()
        
    calendar = {}
    for s in resp.data:
        date = s["created_at"].split('T')[0]
        if date not in calendar: calendar[date] = 0
        calendar[date] += s["duration_minutes"]
        
    return {
        "calendar": calendar,
        "daily_target": user.get("daily_target_minutes", 120),
        "current_streak": user.get("current_streak", 0)
    }

@api_router.post("/streak/update")
async def update_streak(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    today = datetime.now(timezone.utc).date()
    
    # Fetch streak record
    resp = get_supabase().table("streaks").select("*").eq("user_id", user_id).execute()
    streak_record = resp.data[0] if resp.data else None
    
    current = user.get("current_streak", 0)
    longest = user.get("longest_streak", 0)
    
    new_streak = 1
    if streak_record and streak_record.get("last_update"):
        last_update = datetime.fromisoformat(streak_record["last_update"]).date()
        diff = (today - last_update).days
        if diff == 0:
            return {"current_streak": current} # Already done
        elif diff == 1:
            new_streak = current + 1
        else:
            new_streak = 1
    
    longest = max(longest, new_streak)
    
    # Upsert streak
    get_supabase().table("streaks").upsert({
        "user_id": user_id,
        "last_update": today.isoformat(),
        "current_streak": new_streak
    }).execute()
    
    # Update user
    get_supabase().table("users").update({
        "current_streak": new_streak,
        "longest_streak": longest
    }).eq("user_id", user_id).execute()
    
    # Bonus logic
    bonus = 0
    reason = ""
    if new_streak > 0 and new_streak % 7 == 0:
        bonus = 100
        reason = f"{new_streak}-day streak bonus"
        
    if bonus > 0:
         get_supabase().table("users").update({"coins": user["coins"] + bonus}).eq("user_id", user_id).execute()
         get_supabase().table("coin_transactions").insert({
             "transaction_id": str(uuid.uuid4()),
             "user_id": user_id,
             "amount": bonus,
             "reason": reason,
             "created_at": datetime.now(timezone.utc).isoformat()
         }).execute()
         
    return {"current_streak": new_streak, "bonus_coins": bonus}

# ==================== TASKS ====================

@api_router.post("/tasks", response_model=TaskResponse)
async def create_task(task: TaskCreate, user: dict = Depends(get_current_user)):
    task_id = str(uuid.uuid4())
    task_doc = {
        "task_id": task_id,
        "user_id": user["user_id"],
        "title": task.title,
        "subject": task.subject,
        "estimated_minutes": task.estimated_minutes,
        "completed": False,
        "due_date": task.due_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    get_supabase().table("tasks").insert(task_doc).execute()
    return TaskResponse(**task_doc)

@api_router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(user: dict = Depends(get_current_user)):
    resp = get_supabase().table("tasks").select("*")\
        .eq("user_id", user["user_id"])\
        .order("created_at", desc=True)\
        .limit(100)\
        .execute()
    return [TaskResponse(**t) for t in resp.data]

@api_router.patch("/tasks/{task_id}")
async def complete_task(task_id: str, user: dict = Depends(get_current_user)):
    # Verify ownership and update
    resp = get_supabase().table("tasks").update({"completed": True})\
        .eq("task_id", task_id)\
        .eq("user_id", user["user_id"])\
        .execute()
        
    if not resp.data:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Award coins
    bonus = 10
    get_supabase().table("users").update({"coins": user["coins"] + bonus}).eq("user_id", user["user_id"]).execute()
    get_supabase().table("coin_transactions").insert({
        "transaction_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "amount": bonus,
        "reason": "Task completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    
    return {"coins_earned": bonus}

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    get_supabase().table("tasks").delete().eq("task_id", task_id).eq("user_id", user["user_id"]).execute()
    return {"message": "Deleted"}

# ==================== WALLET & BADGES ====================

@api_router.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user)):
    # Transactions
    t_resp = get_supabase().table("coin_transactions").select("*")\
        .eq("user_id", user["user_id"])\
        .order("created_at", desc=True)\
        .limit(20)\
        .execute()
        
    # Today's coins
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    td_resp = get_supabase().table("coin_transactions").select("amount")\
        .eq("user_id", user["user_id"])\
        .gte("created_at", today_start.isoformat())\
        .execute()
    
    today_coins = sum(t["amount"] for t in td_resp.data)
    
    return {
        "total_coins": user.get("coins", 0),
        "today_coins": today_coins,
        "transactions": t_resp.data
    }

@api_router.get("/badges")
async def get_badges(user: dict = Depends(get_current_user)):
    # Badges logic remains same, just reading user dict
    badges = [
        {"badge_id": "first_session", "name": "First Step", "description": "Complete your first study session", "icon": "star", "coins_required": 0, "check": user.get("total_study_time", 0) > 0},
        {"badge_id": "hour_hero", "name": "Hour Hero", "description": "Study for 1 hour total", "icon": "clock", "coins_required": 0, "check": user.get("total_study_time", 0) >= 60},
        {"badge_id": "coin_collector", "name": "Coin Collector", "description": "Earn 1,000 coins", "icon": "coins", "coins_required": 1000, "check": user.get("coins", 0) >= 1000},
    ]
    # Simplified list for brevity, can expand
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
        {"milestone_id": "silver", "name": "Silver Scholar", "description": "Reach 5,000 coins", "coins_required": 5000, "reward_description": "Certificate"},
        {"milestone_id": "gold", "name": "Gold Scholar", "description": "Reach 10,000 coins", "coins_required": 10000, "reward_description": "Rewards Eligible"}
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

# ==================== AI TIPS (GEMINI) ====================

@api_router.post("/ai/tip", response_model=AITipResponse)
async def get_ai_tip(request: AITipRequest, user: dict = Depends(get_current_user)):
    if not get_gemini_model():
        return AITipResponse(tip="Stay consistent! Add GEMINI_API_KEY to enable AI tips.", category="system")
    
    prompts = {
        "general": f"Brief study tip for student with {user.get('current_streak', 0)} day streak.",
        "motivation": f"Motivate a student who has {user.get('coins', 0)} coins.",
        "study_tip": "One short effective study technique."
    }
    
    try:
        prompt = prompts.get(request.context, prompts["general"])
        response = get_gemini_model().generate_content(prompt)
        text = response.text.strip()
        # Ensure it's not too long
        if len(text) > 200: text = text[:200] + "..."
        return AITipResponse(tip=text, category=request.context)
    except Exception as e:
        print(f"Gemini Error: {e}")
        return AITipResponse(tip="Focus on your goals. You've got this!", category="fallback")

class StudyPlanRequest(BaseModel):
    focus_areas: Optional[List[str]] = None
    available_hours: Optional[int] = 2

@api_router.post("/ai/study-plan")
async def generate_study_plan(request: StudyPlanRequest, user: dict = Depends(get_current_user)):
    """Generate a personalized AI study plan based on user's data"""
    if not get_gemini_model():
        return {"plan": "Enable GEMINI_API_KEY for AI-powered study plans.", "generated": False}
    
    # Gather user context
    user_name = user.get("name", "Student")
    subjects = user.get("subjects", ["General"])
    daily_target = user.get("daily_target_minutes", 120)
    current_streak = user.get("current_streak", 0)
    total_time = user.get("total_study_time", 0)
    class_level = user.get("class_level", "Unknown")
    
    # Get recent tasks
    tasks_resp = get_supabase().table("tasks").select("title, subject, estimated_minutes, completed")\
        .eq("user_id", user["user_id"])\
        .eq("completed", False)\
        .limit(10)\
        .execute()
    pending_tasks = tasks_resp.data
    
    # Get recent study sessions for pattern analysis
    week_start = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    sessions_resp = get_supabase().table("study_sessions").select("subject, duration_minutes, focus_score, created_at")\
        .eq("user_id", user["user_id"])\
        .gte("created_at", week_start)\
        .execute()
    recent_sessions = sessions_resp.data
    
    # Calculate subject performance
    subject_stats = {}
    for s in recent_sessions:
        subj = s["subject"]
        if subj not in subject_stats:
            subject_stats[subj] = {"time": 0, "focus_avg": [], "sessions": 0}
        subject_stats[subj]["time"] += s["duration_minutes"]
        subject_stats[subj]["focus_avg"].append(s["focus_score"])
        subject_stats[subj]["sessions"] += 1
    
    for subj in subject_stats:
        scores = subject_stats[subj]["focus_avg"]
        subject_stats[subj]["focus_avg"] = sum(scores) / len(scores) if scores else 0
    
    # Calculate time per subject (divide daily target among subjects)
    num_subjects = len(subjects) if subjects else 3
    time_per_subject = daily_target // num_subjects
    
    # Build rich prompt with timetable focus
    prompt = f"""You are RevealIQ AI, a personalized study coach. Create a DETAILED TIMETABLE for {user_name}.

STUDENT PROFILE:
- Name: {user_name}
- Class/Level: {class_level}
- ALL Subjects: {', '.join(subjects) if subjects else 'General Studies'}
- Daily study target: {daily_target} minutes ({daily_target // 60}h {daily_target % 60}m)
- Suggested time per subject: ~{time_per_subject} minutes each
- Current streak: {current_streak} days
- Total lifetime study: {total_time} minutes

PENDING TASKS ({len(pending_tasks)} tasks):
{chr(10).join([f"- {t['title']} ({t['subject']}, ~{t['estimated_minutes']} min)" for t in pending_tasks]) if pending_tasks else "No pending tasks - focus on revision"}

RECENT PERFORMANCE (Last 7 days):
{chr(10).join([f"- {subj}: {stats['time']} min studied, {stats['focus_avg']:.0f}% focus" for subj, stats in subject_stats.items()]) if subject_stats else "No recent sessions - starting fresh!"}
Subjects NOT studied recently: {', '.join([s for s in subjects if s not in subject_stats]) if subjects else 'None'}

CREATE A TIMETABLE:
📋 Generate a structured study schedule that:
1. INCLUDES ALL SUBJECTS: {', '.join(subjects) if subjects else 'General revision topics'}
2. Divides the {daily_target} minutes across ALL subjects proportionally
3. Prioritizes subjects not studied recently or with lower focus scores
4. Uses the Pomodoro technique (25 min study + 5 min break)
5. Starts from current time and schedules realistically

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
---
📚 **{user_name}'s Study Timetable**

⏰ **Schedule:**
| Time | Subject | Task | Duration |
|------|---------|------|----------|
| 9:00 AM | Mathematics | [specific task] | 25 min |
| 9:25 AM | ☕ Break | Stretch & hydrate | 5 min |
| 9:30 AM | [Next Subject] | [task] | 25 min |
... (continue for all subjects)

💡 **Focus Tips:**
- [1-2 personalized tips based on their data]

🔥 **Motivation:**
- [Encouraging message about their {current_streak} day streak]
---

Keep total study time around {daily_target} minutes. Include ALL {num_subjects} subjects!"""

    try:
        response = get_gemini_model().generate_content(prompt)
        plan_text = response.text.strip()
        
        return {
            "plan": plan_text,
            "generated": True,
            "context": {
                "pending_tasks": len(pending_tasks),
                "subjects_analyzed": list(subject_stats.keys()),
                "streak": current_streak
            }
        }
    except Exception as e:
        print(f"Gemini Study Plan Error: {e}")
        return {
            "plan": f"Hi {user_name}! Focus on your pending tasks today. Start with the most challenging subject when your energy is highest. Take a 5-minute break every 25 minutes. You've got this! 💪",
            "generated": False
        }

@api_router.get("/ai/progress-insights")
async def get_progress_insights(user: dict = Depends(get_current_user)):
    """Generate AI-powered progress insights and recommendations"""
    if not get_gemini_model():
        return {"insights": "Enable GEMINI_API_KEY for AI insights.", "generated": False}
    
    user_name = user.get("name", "Student")
    coins = user.get("coins", 0)
    streak = user.get("current_streak", 0)
    longest_streak = user.get("longest_streak", 0)
    total_time = user.get("total_study_time", 0)
    daily_target = user.get("daily_target_minutes", 120)
    
    # Get last 30 days of sessions
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    sessions_resp = get_supabase().table("study_sessions").select("subject, duration_minutes, focus_score, was_interrupted, created_at")\
        .eq("user_id", user["user_id"])\
        .gte("created_at", thirty_days_ago)\
        .execute()
    sessions = sessions_resp.data
    
    # Calculate trends
    total_sessions = len(sessions)
    total_minutes = sum(s["duration_minutes"] for s in sessions)
    avg_focus = sum(s["focus_score"] for s in sessions) / total_sessions if total_sessions else 0
    interrupted_count = sum(1 for s in sessions if s["was_interrupted"])
    
    # Subject breakdown
    subject_time = {}
    for s in sessions:
        subj = s["subject"]
        subject_time[subj] = subject_time.get(subj, 0) + s["duration_minutes"]
    
    # Daily completion rate
    study_days = set(s["created_at"].split("T")[0] for s in sessions)
    days_in_period = min(30, (datetime.now(timezone.utc) - datetime.fromisoformat(thirty_days_ago.replace("Z", "+00:00"))).days + 1)
    completion_rate = (len(study_days) / days_in_period) * 100 if days_in_period else 0
    
    prompt = f"""You are RevealIQ AI, an encouraging study analytics coach. Analyze this student's progress and provide insights.

STUDENT: {user_name}
STATS (Last 30 Days):
- Total study sessions: {total_sessions}
- Total study time: {total_minutes} minutes ({total_minutes // 60} hours)
- Average focus score: {avg_focus:.1f}%
- Sessions with interruptions: {interrupted_count} ({(interrupted_count/total_sessions*100) if total_sessions else 0:.0f}%)
- Study consistency: {completion_rate:.0f}% (studied on {len(study_days)}/{days_in_period} days)
- Current streak: {streak} days (best: {longest_streak} days)
- Coins earned: {coins}

SUBJECT DISTRIBUTION:
{chr(10).join([f"- {subj}: {mins} mins ({(mins/total_minutes*100) if total_minutes else 0:.0f}%)" for subj, mins in sorted(subject_time.items(), key=lambda x: -x[1])]) if subject_time else "No data"}

INSTRUCTIONS:
1. Provide 3-4 key insights about their study patterns
2. Highlight strengths (be encouraging!)
3. Identify ONE area for improvement with actionable advice
4. Compare their streak to their best and motivate accordingly
5. Use emojis for visual appeal
6. Keep response under 250 words
7. Be warm and personalized

Format with clear bullet points."""

    try:
        response = get_gemini_model().generate_content(prompt)
        insights_text = response.text.strip()
        
        return {
            "insights": insights_text,
            "generated": True,
            "stats": {
                "total_sessions": total_sessions,
                "total_minutes": total_minutes,
                "avg_focus": round(avg_focus, 1),
                "completion_rate": round(completion_rate, 1),
                "subject_distribution": subject_time,
                "current_streak": streak,
                "longest_streak": longest_streak
            }
        }
    except Exception as e:
        print(f"Gemini Insights Error: {e}")
        return {
            "insights": f"Great progress, {user_name}! You've studied {total_minutes} minutes this month. Keep building that streak! 🔥",
            "generated": False,
            "stats": {
                "total_sessions": total_sessions,
                "total_minutes": total_minutes,
                "avg_focus": round(avg_focus, 1),
                "completion_rate": round(completion_rate, 1)
            }
        }

# ==================== SETTINGS ====================

@api_router.patch("/user/settings")
async def update_settings(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    allowed = ["theme", "daily_target_minutes", "subjects"]
    data = {k: v for k, v in body.items() if k in allowed}
    if data:
        get_supabase().table("users").update(data).eq("user_id", user["user_id"]).execute()
    return {"message": "Updated"}

# ==================== PUSH NOTIFICATIONS ====================

# VAPID keys for WebPush - Generate your own at https://vapidkeys.com/
# Store these in .env for production
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "BE9eWgzkOIjiTHQX53MjKtc2hJ6J7AllWNFMGbOWox0U3KNgeZrrrhNSW-2J2i4bsBnJALKsEGEKSNVUUgL6OPY")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_CLAIMS = {"sub": "mailto:support@revealiq.com"}

class PushSubscription(BaseModel):
    endpoint: str
    keys: Dict[str, str]

@api_router.get("/notifications/vapid-key")
async def get_vapid_key():
    """Return the public VAPID key for frontend subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}

@api_router.post("/notifications/subscribe")
async def subscribe_push(subscription: PushSubscription, user: dict = Depends(get_current_user)):
    """Save user's push subscription"""
    user_id = user["user_id"]
    
    # Store subscription in database (we'll add this to users table)
    try:
        get_supabase().table("users").update({
            "push_subscription": {
                "endpoint": subscription.endpoint,
                "keys": subscription.keys
            }
        }).eq("user_id", user_id).execute()
        
        return {"message": "Subscribed to notifications", "success": True}
    except Exception as e:
        print(f"Push subscription error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save subscription")

@api_router.delete("/notifications/unsubscribe")
async def unsubscribe_push(user: dict = Depends(get_current_user)):
    """Remove user's push subscription"""
    get_supabase().table("users").update({
        "push_subscription": None
    }).eq("user_id", user["user_id"]).execute()
    return {"message": "Unsubscribed from notifications"}

@api_router.post("/notifications/send-motivation")
async def send_motivation_notification(user: dict = Depends(get_current_user)):
    """Send a motivational push notification to the user"""
    subscription_data = user.get("push_subscription")
    
    if not subscription_data:
        raise HTTPException(status_code=400, detail="No push subscription found. Enable notifications first.")
    
    if not VAPID_PRIVATE_KEY:
        raise HTTPException(status_code=500, detail="VAPID_PRIVATE_KEY not configured on server")
    
    # Generate motivational message with Gemini if available
    message_body = "Time to study! Your goals are waiting. 📚"
    
    if gemini_model:
        try:
            streak = user.get("current_streak", 0)
            prompt = f"Write a short (under 100 chars) motivational study reminder for a student with a {streak} day streak. Be encouraging and use 1 emoji."
            response = get_gemini_model().generate_content(prompt)
            message_body = response.text.strip()[:100]
        except:
            pass
    
    notification_data = {
        "title": "📖 RevealIQ Study Reminder",
        "body": message_body,
        "icon": "/logo192.png",
        "badge": "/logo192.png",
        "tag": "motivation",
        "data": {"url": "/focus"}
    }
    
    try:
        from pywebpush import webpush, WebPushException
        
        webpush(
            subscription_info={
                "endpoint": subscription_data["endpoint"],
                "keys": subscription_data["keys"]
            },
            data=str(notification_data).replace("'", '"'),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        
        return {"message": "Notification sent!", "body": message_body}
    except WebPushException as e:
        print(f"WebPush error: {e}")
        if e.response and e.response.status_code == 410:
            # Subscription expired, remove it
            get_supabase().table("users").update({"push_subscription": None}).eq("user_id", user["user_id"]).execute()
            raise HTTPException(status_code=410, detail="Push subscription expired")
        raise HTTPException(status_code=500, detail="Failed to send notification")
    except ImportError:
        raise HTTPException(status_code=500, detail="pywebpush not installed. Run: pip install pywebpush")

# Include router and cors
app.include_router(api_router)

# CORS - Allow frontend origins
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://studycompanion-two.vercel.app",
    "https://studycompanion.vercel.app",
    "https://studycompanion-bckejstvk-harsh-vardhans-projects-688a35a0.vercel.app",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
