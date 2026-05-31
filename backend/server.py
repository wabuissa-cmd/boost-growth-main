from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import asyncio
import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=15000,
    connectTimeoutMS=15000,
)
db = client[os.environ['DB_NAME']]

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Boost Growth Portal API")
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())

def create_token(data: dict, hours: int = 24) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + timedelta(hours=hours)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") == "admin":
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    else:
        user = await db.therapists.find_one({"id": payload["sub"]}, {"_id": 0, "pin_hash": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["role"] = payload.get("role", user.get("role", "therapist"))
    return user

async def admin_only(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True,
                        secure=True, samesite="none", max_age=86400, path="/")

# ------------------- Models -------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TherapistPinLogin(BaseModel):
    therapist_id: str
    pin: str

class TherapistEmailLogin(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str

class TherapistIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = "#7A8A6A"
    pin: str

class TherapistUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = None
    pin: Optional[str] = None

class ScheduleCellIn(BaseModel):
    therapist_id: str
    day: int
    time_slot: str
    service_code: Optional[str] = "SS"
    child_name: Optional[str] = None
    note: Optional[str] = None
    custom_time: Optional[str] = None
    state: Optional[str] = "normal"
    color: Optional[str] = None
    duration: Optional[int] = 1  # number of time-slot rows the cell spans (1=single)
    week_start: str

class LocationIn(BaseModel):
    service: str
    address: str

class ClientIn(BaseModel):
    name: str
    file_no: Optional[str] = None
    age: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    package_hours: Optional[float] = 24
    billing_mode: Optional[str] = "hours"   # "hours" (count by hours used) or "weeks" (4-week school cycle)
    cycle_weeks: Optional[int] = 4           # for billing_mode="weeks"
    cycle_start_date: Optional[str] = None   # ISO yyyy-mm-dd; first day of current billing cycle
    package_end_date: Optional[str] = None   # ISO yyyy-mm-dd; package expiry / end-of-cycle date (manual)
    payment_status: Optional[str] = "pending"  # "complete" or "pending"
    package_reset_at: Optional[str] = None    # ISO timestamp; sessions before this are excluded from current cycle (manual reset)
    notes: Optional[str] = None
    main_therapist_id: Optional[str] = None
    co_therapist_ids: Optional[List[str]] = []
    supervisor: Optional[str] = None
    locations: Optional[List[LocationIn]] = []
    color: Optional[str] = None
    drive_url: Optional[str] = None
    schedule_color: Optional[str] = None  # custom color for all schedule cells for this client
    # Optional client status & service type & attachment URLs (Change 4)
    status: Optional[str] = "Active"                  # Active / Inactive
    service_type: Optional[str] = None                # HS / SS / HS+SS / AVC
    address: Optional[str] = None                     # general address (also via locations)
    intake_file_url: Optional[str] = None
    attendance_sheet_url: Optional[str] = None
    progress_reports_url: Optional[str] = None
    case_summary_url: Optional[str] = None

class InvoiceIn(BaseModel):
    invoice_number: str  # manual entry, e.g. "INV 4042"
    notes: Optional[str] = None
    amount: Optional[float] = None
    period_from: Optional[str] = None  # ISO date (cycle start)
    period_to: Optional[str] = None    # ISO date (package end date)
    package_size: Optional[float] = None         # number of sessions or hours
    payment_status: Optional[str] = "pending"    # "complete" | "pending"
    start_date: Optional[str] = None             # ISO date - invoice cycle start (for filtering sessions)
    service_type: Optional[str] = None           # "Home Session" | "School Support"
    is_closed: Optional[bool] = False            # whether the invoice is closed
    close_date: Optional[str] = None             # ISO date when closed

class SessionIn(BaseModel):
    client_id: str
    session_date: str  # ISO date
    start_time: Optional[str] = None  # "14:00"
    end_time: Optional[str] = None
    hours: float = 0
    status: str = "Completed"  # Completed, No Service, Cancelled, No Show
    therapist_ids: List[str] = []
    note: Optional[str] = None
    location: Optional[str] = None  # which location used (HS / SS)

class RequestIn(BaseModel):
    title: str
    description: Optional[str] = ""
    request_type: str = "general"
    priority: str = "normal"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    reward_type: Optional[str] = None
    extra_notes: Optional[str] = None

class RequestStatusUpdate(BaseModel):
    status: str
    admin_note: Optional[str] = None

class DirectoryContactIn(BaseModel):
    name: str
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class IntakeIn(BaseModel):
    child_name: str
    parent_name: Optional[str] = None
    phone: Optional[str] = None
    intake_type: str = "pre"
    notes: Optional[str] = None
    status: Optional[str] = "new"
    intake_date: Optional[str] = None
    age: Optional[str] = None
    service: Optional[str] = None          # HS / SS / HS / SS
    district: Optional[str] = None          # Dis column
    time_pref: Optional[str] = None         # Morning / Evening / Any
    diagnosis: Optional[str] = None
    language: Optional[str] = None          # Post-intake only
    priority: Optional[bool] = False

class ResourceIn(BaseModel):
    title: str
    description: Optional[str] = None
    url: str
    category: Optional[str] = "drive"       # drive / file / link
    visibility: str = "all"                 # all / admin / therapist
    icon: Optional[str] = "Folders"
    bg: Optional[str] = "#E5EBE1"
    color: Optional[str] = "#3D4F35"
    sort_order: Optional[int] = 100

class DirectoryContactUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class LeaveIn(BaseModel):
    therapist_id: str
    start_date: str               # ISO yyyy-mm-dd
    end_date: str
    days: float = 1
    leave_type: Optional[str] = "Annual"   # Annual / Unpaid / Sickleave / Exam / Emergency
    status: Optional[str] = "pending"      # pending / approved / done / rejected / cancelled
    notes: Optional[str] = None
    admin_note: Optional[str] = None

class LeaveStatusUpdate(BaseModel):
    status: str
    admin_note: Optional[str] = None

class MarkAbsentIn(BaseModel):
    cancel_sessions: bool = True

class MarkAbsenceIn(BaseModel):
    therapist_id: str
    date_from: str
    date_to: str
    leave_type: Optional[str] = "Absence"
    notes: Optional[str] = None
    cancel_sessions: bool = True

class LeaveDocumentVerifyIn(BaseModel):
    verified: bool = True

class CancelNotifyIn(BaseModel):
    cell_id: str
    state: Optional[str] = None           # cancel_therapist / cancel_child (optional)
    message: str
    send_email: Optional[bool] = False
    send_in_app: Optional[bool] = True
    recipient_ids: Optional[List[str]] = None
    extra_email: Optional[str] = None     # legacy single email override

class ScheduleNotifyIn(BaseModel):
    cell_id: str
    message: str
    recipient_ids: List[str] = []
    send_email: Optional[bool] = False
    send_in_app: Optional[bool] = True

# ------------------- Auth -------------------
@api.post("/auth/login")
async def admin_login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user["id"], "role": "admin", "email": email})
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": email, "name": user.get("name"), "role": "admin", "token": token}

@api.get("/auth/therapists-list")
async def therapists_list_public():
    return await db.therapists.find({}, {"_id": 0, "pin_hash": 0, "password_hash": 0}).sort("name", 1).to_list(500)

@api.post("/auth/therapist-login")
async def therapist_login(payload: TherapistPinLogin, response: Response):
    t = await db.therapists.find_one({"id": payload.therapist_id})
    if not t or not verify_password(payload.pin, t["pin_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    token = create_token({"sub": t["id"], "role": "therapist", "name": t["name"]})
    set_auth_cookie(response, token)
    return {"id": t["id"], "name": t["name"], "color": t.get("color"), "role": "therapist", "token": token,
            "must_change_password": bool(t.get("must_change_password"))}

@api.post("/auth/therapist-email-login")
async def therapist_email_login(payload: TherapistEmailLogin, response: Response):
    """Login a therapist using their email + password (new flow). PIN flow remains available."""
    email = payload.email.lower().strip()
    t = await db.therapists.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if not t or not t.get("password_hash") or not verify_password(payload.password, t["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token({"sub": t["id"], "role": "therapist", "name": t["name"]})
    set_auth_cookie(response, token)
    return {"id": t["id"], "name": t["name"], "color": t.get("color"), "email": t.get("email"),
            "role": "therapist", "token": token,
            "must_change_password": bool(t.get("must_change_password"))}

@api.post("/auth/change-password")
async def change_password(payload: ChangePasswordIn, user=Depends(get_current_user)):
    """Change password for the currently logged-in user (admin or therapist)."""
    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    if user.get("role") == "admin":
        u = await db.users.find_one({"id": user["id"]})
        if not u or not verify_password(payload.old_password, u["password_hash"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        await db.users.update_one({"id": user["id"]},
                                  {"$set": {"password_hash": hash_password(payload.new_password),
                                            "must_change_password": False}})
    else:
        t = await db.therapists.find_one({"id": user["id"]})
        if not t:
            raise HTTPException(status_code=404, detail="Therapist not found")
        # Allow change with either current password OR current PIN (for first-time migration from PIN)
        ok = False
        if t.get("password_hash") and verify_password(payload.old_password, t["password_hash"]):
            ok = True
        elif t.get("pin_hash") and verify_password(payload.old_password, t["pin_hash"]):
            ok = True
        if not ok:
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        await db.therapists.update_one({"id": user["id"]},
                                       {"$set": {"password_hash": hash_password(payload.new_password),
                                                 "must_change_password": False}})
    return {"ok": True}

@api.post("/therapists/{tid}/reset-password")
async def reset_therapist_password(tid: str, _=Depends(admin_only)):
    """Admin generates a temporary 8-character password for a therapist.
    Therapist must change it on next login."""
    import secrets
    t = await db.therapists.find_one({"id": tid})
    if not t:
        raise HTTPException(status_code=404, detail="Therapist not found")
    temp = secrets.token_urlsafe(6)[:8]
    await db.therapists.update_one({"id": tid}, {"$set": {
        "password_hash": hash_password(temp),
        "must_change_password": True,
    }})
    return {"ok": True, "therapist_id": tid, "email": t.get("email"), "temp_password": temp}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

# ------------------- Therapists -------------------
@api.get("/therapists")
async def list_therapists(user=Depends(get_current_user)):
    return await db.therapists.find({}, {"_id": 0, "pin_hash": 0, "password_hash": 0}).sort("name", 1).to_list(500)

@api.post("/therapists")
async def create_therapist(payload: TherapistIn, _=Depends(admin_only)):
    tid = str(uuid.uuid4())
    doc = {"id": tid, "name": payload.name, "email": payload.email, "phone": payload.phone,
           "color": payload.color or "#7A8A6A", "pin_hash": hash_password(payload.pin),
           "created_at": now_iso()}
    await db.therapists.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "pin_hash")}

@api.put("/therapists/{tid}")
async def update_therapist(tid: str, payload: TherapistUpdate, _=Depends(admin_only)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None and k != "pin"}
    if payload.pin:
        update["pin_hash"] = hash_password(payload.pin)
    if not update:
        raise HTTPException(status_code=400, detail="No fields")
    await db.therapists.update_one({"id": tid}, {"$set": update})
    return await db.therapists.find_one({"id": tid}, {"_id": 0, "pin_hash": 0, "password_hash": 0})

@api.delete("/therapists/{tid}")
async def delete_therapist(tid: str, _=Depends(admin_only)):
    t = await db.therapists.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Therapist not found")
    sc = await db.schedule_cells.delete_many({"therapist_id": tid})
    uc = await db.users.delete_many({"$or": [{"therapist_id": tid}, {"name": t.get("name")}]})
    await db.therapists.delete_one({"id": tid})
    return {
        "ok": True,
        "name": t.get("name"),
        "schedule_cells_deleted": sc.deleted_count,
        "users_deleted": uc.deleted_count,
    }

# ------------------- Full Database Backup (admin only) -------------------
BACKUP_COLLECTIONS = [
    "users", "therapists", "clients", "sessions", "invoices",
    "leaves", "requests", "progress_reports", "schedule_cells",
    "intake_pre", "intake_post", "notifications", "attendance_sheets",
    "email_settings", "email_queue",
]

def _json_safe(obj):
    """Recursively convert BSON / non-JSON-native types to plain JSON values."""
    from bson import ObjectId
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items() if k != "_id"}
    if isinstance(obj, list):
        return [_json_safe(x) for x in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, ObjectId):
        return str(obj)
    return obj

@api.get("/admin/full-backup")
async def full_backup(_=Depends(admin_only)):
    """Return a JSON dump of every collection in the DB. Admin-only.
    Sensitive fields like pin_hash / password_hash are stripped before export."""
    import json
    from fastapi.responses import Response
    SENSITIVE = {"pin_hash", "password_hash"}
    dump = {
        "exported_at": now_iso(),
        "db_name": os.environ.get("DB_NAME"),
        "collections": {},
    }
    for cname in BACKUP_COLLECTIONS:
        try:
            docs = await db[cname].find({}, {"_id": 0}).to_list(10000)
        except Exception:
            docs = []
        clean = []
        for d in docs:
            d2 = _json_safe(d)
            for k in list(d2.keys()):
                if k in SENSITIVE:
                    d2[k] = "[REDACTED]"
            clean.append(d2)
        dump["collections"][cname] = clean
    dump["totals"] = {k: len(v) for k, v in dump["collections"].items()}
    body = json.dumps(dump, ensure_ascii=False, indent=2)
    stamp = now_iso().replace(":", "-")[:19]
    fname = f"boost-growth-backup-{stamp}.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )

class LeaveBalanceIn(BaseModel):
    leave_balance: float

@api.put("/therapists/{tid}/leave-balance")
async def set_leave_balance(tid: str, payload: LeaveBalanceIn, _=Depends(admin_only)):
    await db.therapists.update_one({"id": tid}, {"$set": {"leave_balance": float(payload.leave_balance)}})
    return await db.therapists.find_one({"id": tid}, {"_id": 0, "pin_hash": 0, "password_hash": 0})

# ------------------- Master Data Seed (idempotent) -------------------
# Source of truth for therapists & clients. Idempotent: matches by name-token
# (therapists) and file_no (clients), updates missing fields, never deletes.

MASTER_THERAPISTS = [
    # (key,        first_name_token,  display_email,                    role,        leave_balance, join_date)
    ("msMaha",     "Maha",     "msalthunayan@boostgrowthsa.com",  "therapist", None, None),
    ("msFahda",    "Fahda",    "falghadeeb@boostgrowthsa.com",    "therapist", 19,   None),
    ("msRazan",    "Razan",    "ralshatery@boostgrowthsa.com",    "therapist", 17,   None),
    ("msManal",    "Manal",    "maldosery@boostgrowthsa.com",     "therapist", 7,    None),
    ("msAsma",     "Asma",     "asma@boostgrowthsa.com",          "therapist", None, None),
    ("msHajer",    "Hajer",    "halfulaij@boostgrowthsa.com",     "therapist", 11,   None),
    ("msRahaf",    "Rahaf",    "raljuhani@boostgrowthsa.com",     "therapist", 7,    None),
    ("msShatha",   "Shatha",   "shalhammami@boostgrowthsa.com",   "therapist", 21,   "2025-04-06"),
    ("msAlhanouf", "Alhanouf", "a.alromman@boostgrowthsa.com",    "therapist", 0,    "2025-07-14"),
    ("msWaad",     "Waad",     "walhamed@boostgrowthsa.com",      "therapist", 0,    "2025-08-24"),
    ("msBodoor",   "Bodoor",   "baalkhlifah@boostgrowthsa.com",   "therapist", 28,   "2025-10-21"),
    ("msFatimah",  "Fatimah",  "falkhater@boostgrowthsa.com",     "therapist", 26,   "2025-11-09"),
    ("msShrooq",   "Shrooq",   "shalamri@boostgrowthsa.com",      "therapist", 18,   "2026-02-08"),
    ("msAbeer",    "Abeer",    "a.alshareef@boostgrowthsa.com",   "therapist", 4,    None),
    ("msJenan",    "Jenan",    "jsalmuhaisin@boostgrowthsa.com",  "therapist", None, None),
]

MASTER_CLIENTS = [
    # (file_no, name,                 main_key,  co_keys,                   pkg, supervisor_key, service, address)
    ("009", "Saleh Ahusainy",        "msWaad",     ["msManal", "msFahda"],     24, "msFahda", "SS/HS", "Alnakeel"),
    ("011", "Fahad Alyahya",         "msAlhanouf", ["msFahda"],                24, "msFahda", "HS/SS", "Alyasmin"),
    ("018", "Layan AlSaud",          "msJenan",    [],                         24, "msJenan", "ABA",   "Alaqiq"),
    ("023", "Yahya Alqahtani",       "msHajer",    ["msManal"],                24, "msFahda", "HS",    "Alaarid"),
    ("024", "Abdulaziz Alrasheed",   "msShatha",   ["msManal", "msHajer"],     40, "msFahda", "HS",    "Alnada Bldg 26"),
    ("027", "Mohammed Alaqel",       "msRahaf",    ["msFahda"],                24, "msFahda", "HS",    "AlMalqa"),
    ("030", "Husam Alturaigy",       "msManal",    ["msShatha"],               24, "msFahda", "SS/HS", "Whales daycare"),
    ("034", "Aljouhrah Alduailij",   "msFahda",    [],                         24, "msFahda", "SS",    "Alnakheel Talat"),
    ("035", "Saad Alghamdi",         "msShatha",   ["msHajer", "msFatimah"],   40, "msMaha",  "HS/SS", "Al Aqiq"),
    ("037", "Suzan Alsultan",        "msAsma",     [],                         24, "msMaha",  "SS",    "King Fahad Villa"),
    ("038", "Salman Alrasheed",      "msManal",    ["msFahda"],                24, "msMaha",  "SS/HS", "Stars of Knowledge"),
    ("040", "Abdulaziz AlAbdulwahab","msFatimah",  ["msFahda", "msHajer"],     40, "msMaha",  "HS",    "Alraed"),
    ("041", "Ameerah Alshehri",      "msFahda",    ["msFatimah"],              24, "msMaha",  "HS",    "Roshen"),
    ("042", "Sultan Aldamer",        "msShrooq",   ["msRahaf", "msManal"],     40, "msMaha",  "SS/HS", "Bright Mind"),
    ("047", "Alwaleed Alotaibi",     "msHajer",    ["msAlhanouf"],             20, "msMaha",  "HS/SS", "Alqairawan"),
    ("052", "Sulaiman Alkhurashi",   "msRahaf",    ["msMaha"],                 24, "msMaha",  "HS",    "Alsulaimanyah"),
    ("054", "Omar Alkhurashi",       "msManal",    ["msMaha"],                 16, "msMaha",  "HS",    "Alsulaimanyah"),
    ("060", "Mohammed Albedayea",    "msBodoor",   ["msShatha"],               40, "msMaha",  "HS/SS", "Alyasmin"),
    ("061", "Ibrahim Alnasir",       "msRahaf",    ["msFahda"],                24, "msFahda", "HS/SS", "Alyasmin"),
    ("062", "Lulu Almutair",         "msRazan",    ["msFahda"],                24, "msFahda", "HS/SS", "Almuroj"),
    ("063", "Amani Ghaith",          "msMaha",     [],                         24, "msMaha",  "HS",    "Alnakheel"),
    ("065", "Aser Alharbi",          "msMaha",     ["msMaha"],                 24, "msMaha",  "HS",    "Al Izdihar"),
    ("068", "Abdulrahman Alshawi",   "msRazan",    ["msFahda"],                24, "msFahda", "HS/SS", "AR Rayan"),
    ("070", "Abdulelah Almuhana",    "msAbeer",    ["msMaha"],                 40, "msMaha",  "SS",    "Manarat Riyadh"),
    ("072", "Khalid Bin Shuael",     "msShatha",   ["msFahda"],                24, "msFahda", "HS",    "AlMursalat"),
    ("079", "Fahad Suliman",         "msFahda",    ["msFahda"],                40, "msFahda", "HS",    "Al-Sahafa"),
]

async def _resolve_therapist_id(key_to_id: dict, key: str) -> Optional[str]:
    return key_to_id.get(key)

@api.post("/admin/seed-master-data")
async def seed_master_data(_=Depends(admin_only)):
    """Idempotently seed/update therapists and clients with the canonical master list.
    - Therapists: match by first-name token (case-insensitive) inside existing DB name.
      If found -> update (key, role, leave_balance, join_date) WITHOUT touching name/email.
      If not found -> create new therapist with display_email and default PIN 0000.
    - Clients: match by file_no. If found -> patch missing/new fields. If not found -> create.
    - Never deletes any record. Sessions/invoices remain intact.
    """
    results = {"therapists": {"updated": [], "created": [], "skipped": []},
               "clients": {"updated": [], "created": [], "skipped": []}}

    # 1) Therapists
    existing_ts = await db.therapists.find({}, {"_id": 0}).to_list(500)
    key_to_id: dict = {}
    for (key, first, email, role, leave_balance, join_date) in MASTER_THERAPISTS:
        match = next((t for t in existing_ts if first.lower() in (t.get("name") or "").lower()), None)
        update = {"key": key, "role": role}
        if leave_balance is not None:
            update["leave_balance"] = leave_balance
        if join_date is not None:
            update["join_date"] = join_date
        if match:
            await db.therapists.update_one({"id": match["id"]}, {"$set": update})
            key_to_id[key] = match["id"]
            results["therapists"]["updated"].append({"key": key, "id": match["id"], "name": match.get("name")})
        else:
            tid = str(uuid.uuid4())
            doc = {"id": tid, "name": f"Ms. {first}", "email": email,
                   "color": "#7A8A6A", "pin_hash": hash_password("0000"),
                   "must_change_password": True,
                   "created_at": now_iso(), **update}
            await db.therapists.insert_one(doc)
            key_to_id[key] = tid
            results["therapists"]["created"].append({"key": key, "id": tid, "name": doc["name"]})

    # Build supplementary key->id map by also probing first-name tokens
    # (catches therapists already in DB but not in MASTER_THERAPISTS like msJenan, msWalaa)
    for t in await db.therapists.find({}, {"_id": 0, "id": 1, "name": 1, "key": 1}).to_list(500):
        if t.get("key") and t["key"] not in key_to_id:
            key_to_id[t["key"]] = t["id"]
    # Also probe by first-name match for any keys still missing (e.g. msJenan)
    for client_row in MASTER_CLIENTS:
        for k in [client_row[2]] + list(client_row[3]) + [client_row[5]]:
            if k and k not in key_to_id:
                token = k[2:] if k.startswith("ms") else k
                hit = await db.therapists.find_one({"name": {"$regex": token, "$options": "i"}}, {"_id": 0, "id": 1})
                if hit:
                    key_to_id[k] = hit["id"]
                    await db.therapists.update_one({"id": hit["id"]}, {"$set": {"key": k}})

    # 2) Clients
    for (file_no, name, main_k, co_ks, pkg, sup_k, service, address) in MASTER_CLIENTS:
        match = await db.clients.find_one({"file_no": file_no})
        main_id = key_to_id.get(main_k)
        co_ids = [key_to_id[k] for k in co_ks if k in key_to_id]
        sup_id = key_to_id.get(sup_k)
        sup_name = None
        if sup_id:
            sup_doc = next((t for t in existing_ts if t.get("id") == sup_id), None)
            if not sup_doc:
                sup_doc = await db.clients.database.therapists.find_one({"id": sup_id}, {"_id": 0, "name": 1})
            sup_name = sup_doc.get("name") if sup_doc else sup_k
        update = {
            "name": name,
            "package_hours": pkg,
            "service_type": service,
            "address": address,
        }
        if main_id:
            update["main_therapist_id"] = main_id
        if co_ids:
            update["co_therapist_ids"] = co_ids
        if sup_name:
            update["supervisor"] = sup_name
        if match:
            await db.clients.update_one({"file_no": file_no}, {"$set": update})
            results["clients"]["updated"].append({"file_no": file_no, "name": name})
        else:
            cid = str(uuid.uuid4())
            doc = {"id": cid, "file_no": file_no, "color": "#7A8A6A",
                   "billing_mode": "hours", "payment_status": "pending",
                   "created_at": now_iso(), **update}
            await db.clients.insert_one(doc)
            results["clients"]["created"].append({"file_no": file_no, "name": name, "id": cid})

    return results

# ------------------- Schedule -------------------
@api.get("/schedule/week-status")
async def schedule_week_status(week_start: str, user=Depends(get_current_user)):
    doc = await db.schedule_weeks.find_one({"week_start": week_start}, {"_id": 0})
    status = (doc or {}).get("status") or "published"
    if user.get("role") != "admin" and status == "draft":
        status = "published"
    return {"week_start": week_start, "status": status, "published_at": (doc or {}).get("published_at")}

@api.post("/schedule/publish")
async def publish_schedule_week(body: dict, admin=Depends(admin_only)):
    week_start = (body.get("week_start") or "").strip()
    if not week_start:
        raise HTTPException(status_code=400, detail="week_start required")
    await db.schedule_weeks.update_one(
        {"week_start": week_start},
        {"$set": {"status": "published", "published_at": now_iso(), "published_by": admin.get("name") or "Admin"}},
        upsert=True,
    )
    therapists = await db.therapists.find({"email": {"$exists": True, "$ne": None}}, {"_id": 0, "email": 1, "name": 1}).to_list(200)
    sent = 0
    for t in therapists:
        if t.get("email"):
            r = await _send_email_stub(
                t["email"],
                f"[Boost Growth] New Schedule Published — Week of {week_start}",
                f"Dear {t.get('name', '')},\n\nThe schedule for the week of {week_start} has been published.\nPlease review your sessions for the coming week.\n\n— Boost Growth Portal",
            )
            if r.get("status") == "sent":
                sent += 1
    return {"ok": True, "week_start": week_start, "emails_sent": sent}

@api.post("/schedule/set-draft")
async def set_schedule_draft(body: dict, _=Depends(admin_only)):
    week_start = (body.get("week_start") or "").strip()
    if not week_start:
        raise HTTPException(status_code=400, detail="week_start required")
    await db.schedule_weeks.update_one(
        {"week_start": week_start},
        {"$set": {"status": "draft", "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "week_start": week_start, "status": "draft"}

@api.get("/schedule")
async def list_schedule(week_start: Optional[str] = None, user=Depends(get_current_user)):
    q: dict = {}
    if week_start:
        q["week_start"] = week_start
        meta = await db.schedule_weeks.find_one({"week_start": week_start}, {"_id": 0})
        if meta and meta.get("status") == "draft" and user.get("role") != "admin":
            return []
    cells = await db.schedule_cells.find(q, {"_id": 0}).to_list(5000)
    return cells

async def _notify(user_id: str, ntype: str, title: str, message: str, **extra):
    doc = {
        "id": str(uuid.uuid4()), "user_id": user_id, "type": ntype,
        "title": title, "message": message, "read": False,
        "acknowledged": False, "created_at": now_iso(),
        **extra,
    }
    await db.notifications.insert_one(doc)
    return doc

async def _notify_admins(ntype: str, title: str, message: str):
    """Send notification to all admin users."""
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await _notify(a["id"], ntype, title, message)

@api.post("/schedule")
async def create_schedule_cell(payload: ScheduleCellIn, _=Depends(admin_only)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, **payload.model_dump(), "created_at": now_iso()}
    await db.schedule_cells.insert_one(doc)
    doc.pop("_id", None)
    if doc.get("therapist_id"):
        await _notify(doc["therapist_id"], "schedule", "New session added",
                      f"{doc.get('service_code')} | {doc.get('child_name') or ''} at {doc.get('time_slot')}")
    return doc

@api.put("/schedule/{cid}")
async def update_schedule_cell(cid: str, payload: ScheduleCellIn, _=Depends(admin_only)):
    update = payload.model_dump()
    await db.schedule_cells.update_one({"id": cid}, {"$set": update})
    cell = await db.schedule_cells.find_one({"id": cid}, {"_id": 0})
    if cell and cell.get("therapist_id"):
        title = "Schedule update"
        if cell.get("state") == "cancel_therapist":
            title = "Session marked as Therapist Cancellation"
            await _notify_admins("cancel_alert", "Therapist cancellation",
                                 f"{cell.get('child_name') or '—'} session on day {cell.get('day')} at {cell.get('time_slot')} marked Therapist Cancel")
        elif cell.get("state") == "cancel_child":
            title = "Session marked as Client Cancellation"
            await _notify_admins("cancel_alert", "Client cancellation",
                                 f"{cell.get('child_name') or '—'} session on day {cell.get('day')} at {cell.get('time_slot')} marked Client Cancel")
        await _notify(cell["therapist_id"], "schedule", title,
                      f"{cell.get('service_code')} | {cell.get('child_name') or ''} at {cell.get('time_slot')}")
    return cell

@api.post("/schedule/{cid}/duplicate")
async def duplicate_cell(cid: str, _=Depends(admin_only)):
    cell = await db.schedule_cells.find_one({"id": cid}, {"_id": 0})
    if not cell:
        raise HTTPException(status_code=404, detail="Not found")
    new_cell = {**cell, "id": str(uuid.uuid4()), "created_at": now_iso()}
    await db.schedule_cells.insert_one(new_cell)
    new_cell.pop("_id", None)
    return new_cell

@api.delete("/schedule/{cid}")
async def delete_schedule_cell(cid: str, _=Depends(admin_only)):
    await db.schedule_cells.delete_one({"id": cid})
    return {"ok": True}

@api.post("/schedule/{cid}/notify")
async def notify_schedule(cid: str, body: ScheduleNotifyIn, _=Depends(admin_only)):
    cell = await db.schedule_cells.find_one({"id": cid}, {"_id": 0})
    if not cell:
        raise HTTPException(status_code=404, detail="Schedule cell not found")
    msg = body.message or f"Notice about session: {cell.get('child_name') or ''}"
    recipients = body.recipient_ids or ([cell["therapist_id"]] if cell.get("therapist_id") else [])
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients selected")
    sent = []
    for rid in recipients:
        if body.send_in_app:
            n = await _notify(
                rid, "schedule_alert", "Notice from Admin", msg,
                schedule_cell_id=cid, requires_ack=True,
            )
            sent.append({"user_id": rid, "notification_id": n["id"]})
        if body.send_email:
            therapist = await db.therapists.find_one({"id": rid}, {"_id": 0})
            if therapist and therapist.get("email"):
                subj = "[Boost Growth] Notice from Admin"
                await _send_email_stub(therapist["email"], subj, msg)
    return {"ok": True, "sent": sent}

@api.get("/schedule/{cid}/notification-receipts")
async def schedule_notification_receipts(cid: str, _=Depends(admin_only)):
    items = await db.notifications.find(
        {"schedule_cell_id": cid}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    therapists = {t["id"]: t async for t in db.therapists.find({}, {"_id": 0, "id": 1, "name": 1})}
    out = []
    for n in items:
        tid = n.get("user_id")
        out.append({
            **n,
            "therapist_name": therapists.get(tid, {}).get("name") if tid in therapists else None,
        })
    return out

# ------------------- Clients & Sessions -------------------
@api.get("/clients")
async def list_clients(user=Depends(get_current_user)):
    if _has_full_client_access(user):
        return await db.clients.find({}, {"_id": 0}).sort("file_no", 1).to_list(500)
    # therapist: see only assigned (main or co)
    items = await db.clients.find({}, {"_id": 0}).sort("file_no", 1).to_list(500)
    uid = user["id"]
    return [c for c in items if c.get("main_therapist_id") == uid or uid in (c.get("co_therapist_ids") or [])]

@api.post("/clients")
async def create_client(payload: ClientIn, _=Depends(admin_only)):
    cid = str(uuid.uuid4())
    data = payload.model_dump()
    data["locations"] = [l for l in (data.get("locations") or [])]
    doc = {"id": cid, **data, "created_at": now_iso()}
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/clients/{cid}")
async def update_client(cid: str, payload: ClientIn, _=Depends(admin_only)):
    data = payload.model_dump()
    data["locations"] = [l for l in (data.get("locations") or [])]
    await db.clients.update_one({"id": cid}, {"$set": data})
    return await db.clients.find_one({"id": cid}, {"_id": 0})

class ClientScheduleColorIn(BaseModel):
    color: Optional[str] = None

@api.put("/clients/{cid}/schedule-color")
async def update_client_schedule_color(cid: str, body: ClientScheduleColorIn, _=Depends(admin_only)):
    """Set schedule_color on client and propagate to all schedule cells with matching child_name."""
    client = await db.clients.find_one({"id": cid}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    color = body.color
    await db.clients.update_one({"id": cid}, {"$set": {"schedule_color": color}})
    name = (client.get("name") or "").strip()
    if name:
        await db.schedule_cells.update_many(
            {"child_name": {"$regex": f"^{re.escape(name)}($|\\s)"}},
            {"$set": {"color": color}},
        )
    return {"ok": True, "schedule_color": color, "client_id": cid}

@api.delete("/clients/{cid}")
async def delete_client(cid: str, _=Depends(admin_only)):
    await db.clients.delete_one({"id": cid})
    await db.sessions.delete_many({"client_id": cid})
    await db.invoices.delete_many({"client_id": cid})
    await db.progress_reports.delete_many({"client_id": cid})
    return {"ok": True}

# ------------------- Progress Reports (per client) -------------------
PROGRESS_STATUSES = {"uploaded", "reviewed", "resolved"}

class ProgressReportIn(BaseModel):
    title: str
    url: Optional[str] = None
    status: Optional[str] = "uploaded"   # uploaded | reviewed | resolved
    notes: Optional[str] = None
    report_date: Optional[str] = None    # ISO date when the report was made

class ProgressStatusIn(BaseModel):
    status: str

class ProgressStepsIn(BaseModel):
    uploaded: Optional[bool] = None
    uploaded_by: Optional[str] = None
    uploaded_at: Optional[str] = None
    reviewed: Optional[bool] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    resolved: Optional[bool] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None

class ProgressReportLinkIn(BaseModel):
    url: Optional[str] = None

SUPERVISOR_CLIENT_FILES = {
    "msMaha": ["035", "037", "038", "040", "041", "042", "047", "052", "054", "060", "063", "065", "070"],
    "msFahda": ["009", "011", "018", "023", "024", "027", "030", "034", "061", "062", "068", "072", "079"],
}

FULL_CLIENT_ACCESS_KEYS = frozenset({"mswalaa", "msmaha", "msjenan", "msfahda"})
FULL_CLIENT_NAME_TOKENS = frozenset({"walaa", "maha", "jenan", "fahda"})


def _has_full_client_access(user: dict) -> bool:
    if user.get("role") == "admin":
        return True
    key = (user.get("key") or "").lower()
    if key in FULL_CLIENT_ACCESS_KEYS:
        return True
    name = (user.get("name") or "").lower().replace("ms.", "").replace("ms ", "").strip()
    first = name.split()[0] if name else ""
    return first in FULL_CLIENT_NAME_TOKENS


async def _client_file_no(client_id: str) -> Optional[str]:
    c = await db.clients.find_one({"id": client_id}, {"_id": 0, "file_no": 1})
    if not c or not c.get("file_no"):
        return None
    return str(c["file_no"]).zfill(3)

def _is_supervisor_for_file(user: dict, file_no: str) -> bool:
    key = user.get("key") or ""
    fn = str(file_no or "").zfill(3)
    return fn in (SUPERVISOR_CLIENT_FILES.get(key) or [])

async def _can_edit_progress_step(user: dict, report_id: str, step: str) -> bool:
    if _has_full_client_access(user):
        return True
    if user.get("role") == "admin":
        return True
    doc = await db.progress_reports.find_one({"id": report_id}, {"_id": 0, "client_id": 1})
    if not doc:
        return False
    if step == "uploaded":
        fn = await _client_file_no(doc["client_id"])
        if fn and _is_supervisor_for_file(user, fn):
            return True
        if user.get("role") != "therapist":
            return False
        client = await db.clients.find_one(
            {"id": doc["client_id"]},
            {"_id": 0, "main_therapist_id": 1, "co_therapist_ids": 1},
        )
        if not client:
            return False
        uid = user["id"]
        return client.get("main_therapist_id") == uid or uid in (client.get("co_therapist_ids") or [])
    if step in ("reviewed", "resolved"):
        fn = await _client_file_no(doc["client_id"])
        return bool(fn and _is_supervisor_for_file(user, fn))
    return False

@api.get("/progress-reports/summary")
async def get_progress_reports_summary(user=Depends(get_current_user)):
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$client_id",
            "uploaded": {"$first": "$uploaded"},
            "reviewed": {"$first": "$reviewed"},
            "resolved": {"$first": "$resolved"},
            "count": {"$sum": 1},
        }},
    ]
    results = await db.progress_reports.aggregate(pipeline).to_list(500)
    return {
        r["_id"]: {
            "uploaded": bool(r.get("uploaded")),
            "reviewed": bool(r.get("reviewed")),
            "resolved": bool(r.get("resolved")),
            "count": r.get("count", 0),
        }
        for r in results
    }

@api.get("/clients/{cid}/progress-reports")
async def list_progress_reports(cid: str, user=Depends(get_current_user)):
    if not _has_full_client_access(user):
        client = await db.clients.find_one(
            {"id": cid},
            {"_id": 0, "main_therapist_id": 1, "co_therapist_ids": 1, "file_no": 1},
        )
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        uid = user["id"]
        assigned = client.get("main_therapist_id") == uid or uid in (client.get("co_therapist_ids") or [])
        fn = str(client.get("file_no") or "").strip()
        supervisor = bool(fn and _is_supervisor_for_file(user, fn))
        if not assigned and not supervisor:
            raise HTTPException(status_code=403, detail="Forbidden")
    return await db.progress_reports.find({"client_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(200)

@api.post("/clients/{cid}/progress-reports")
async def create_progress_report(cid: str, payload: ProgressReportIn, user=Depends(get_current_user)):
    rid = str(uuid.uuid4())
    doc = {
        "id": rid,
        "client_id": cid,
        "title": payload.title.strip(),
        "url": (payload.url or "").strip() or None,
        "notes": payload.notes,
        "report_date": payload.report_date,
        "uploaded": False,
        "uploaded_by": None,
        "uploaded_at": None,
        "reviewed": False,
        "reviewed_by": None,
        "reviewed_at": None,
        "resolved": False,
        "resolved_by": None,
        "resolved_at": None,
        "created_by": user.get("name") or user.get("email"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.progress_reports.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/progress-reports/{rid}")
async def update_progress_report(rid: str, payload: ProgressReportIn, _=Depends(admin_only)):
    status = (payload.status or "uploaded").lower()
    if status not in PROGRESS_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of {sorted(PROGRESS_STATUSES)}")
    update = {
        "title": payload.title.strip(),
        "url": (payload.url or "").strip() or None,
        "status": status,
        "notes": payload.notes,
        "report_date": payload.report_date,
        "updated_at": now_iso(),
    }
    await db.progress_reports.update_one({"id": rid}, {"$set": update})
    return await db.progress_reports.find_one({"id": rid}, {"_id": 0})

@api.put("/progress-reports/{rid}/status")
async def set_progress_report_status(rid: str, payload: ProgressStatusIn, _=Depends(admin_only)):
    status = (payload.status or "").lower()
    if status not in PROGRESS_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of {sorted(PROGRESS_STATUSES)}")
    await db.progress_reports.update_one({"id": rid}, {"$set": {"status": status, "updated_at": now_iso()}})
    return await db.progress_reports.find_one({"id": rid}, {"_id": 0})

@api.put("/progress-reports/{rid}/link")
async def update_progress_report_link(rid: str, payload: ProgressReportLinkIn, user=Depends(get_current_user)):
    """Save a Google Drive link to the Word/doc file for editing."""
    report = await db.progress_reports.find_one({"id": rid}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not await _can_access_progress_report(user, report):
        raise HTTPException(status_code=403, detail="Forbidden")
    url = (payload.url or "").strip() or None
    await db.progress_reports.update_one(
        {"id": rid}, {"$set": {"url": url, "updated_at": now_iso()}}
    )
    return await db.progress_reports.find_one({"id": rid}, {"_id": 0})


@api.put("/progress-reports/{rid}/steps")
async def update_progress_report_steps(rid: str, payload: ProgressStepsIn, user=Depends(get_current_user)):
    report = await db.progress_reports.find_one({"id": rid}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    update = {}
    for field in (
        "uploaded", "uploaded_by", "uploaded_at",
        "reviewed", "reviewed_by", "reviewed_at",
        "resolved", "resolved_by", "resolved_at",
    ):
        val = getattr(payload, field, None)
        if val is not None:
            update[field] = val
    for step in ("uploaded", "reviewed", "resolved"):
        if step in update and not await _can_edit_progress_step(user, rid, step):
            raise HTTPException(status_code=403, detail=f"Not allowed to update '{step}'")
    if update:
        update["updated_at"] = now_iso()
        await db.progress_reports.update_one({"id": rid}, {"$set": update})
        if any(k in update for k in ("uploaded", "reviewed", "resolved")):
            client = await db.clients.find_one(
                {"id": report["client_id"]},
                {"_id": 0, "name": 1, "main_therapist_id": 1},
            )
            if client and client.get("main_therapist_id"):
                therapist = await db.therapists.find_one(
                    {"id": client["main_therapist_id"]},
                    {"_id": 0, "email": 1, "name": 1},
                )
                if therapist and therapist.get("email"):
                    steps_changed = [k for k in ("uploaded", "reviewed", "resolved") if k in update]
                    await _send_email_stub(
                        therapist["email"],
                        f"[Boost Growth] Progress report updated — {client.get('name', '')}",
                        f"Hello {therapist.get('name', '')},\n\nProgress report steps updated: {', '.join(steps_changed)}.\n\n— Boost Growth Portal",
                    )
    doc = await db.progress_reports.find_one({"id": rid}, {"_id": 0})
    return doc or {}

@api.delete("/progress-reports/{rid}")
async def delete_progress_report(rid: str, _=Depends(admin_only)):
    report = await db.progress_reports.find_one({"id": rid}, {"_id": 0, "file_path": 1})
    if report and report.get("file_path"):
        fp = UPLOAD_DIR / report["file_path"]
        if fp.exists():
            fp.unlink()
    await db.progress_reports.delete_one({"id": rid})
    return {"ok": True}


async def _can_access_progress_report(user: dict, report: dict) -> bool:
    if _has_full_client_access(user):
        return True
    client = await db.clients.find_one(
        {"id": report["client_id"]},
        {"_id": 0, "main_therapist_id": 1, "co_therapist_ids": 1, "file_no": 1},
    )
    if not client:
        return False
    uid = user["id"]
    if client.get("main_therapist_id") == uid or uid in (client.get("co_therapist_ids") or []):
        return True
    fn = await _client_file_no(report["client_id"])
    return bool(fn and _is_supervisor_for_file(user, fn))


@api.post("/progress-reports/{rid}/file")
async def upload_progress_report_file(rid: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    report = await db.progress_reports.find_one({"id": rid}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not await _can_access_progress_report(user, report):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="File required")
    ext = Path(file.filename).suffix or ".pdf"
    stored = f"pr_{rid}{ext}"
    save_path = UPLOAD_DIR / stored
    if report.get("file_path"):
        old = UPLOAD_DIR / report["file_path"]
        if old.exists() and old.name != stored:
            old.unlink()
    save_path.write_bytes(await file.read())
    await db.progress_reports.update_one({"id": rid}, {"$set": {
        "file_path": stored,
        "file_name": file.filename,
        "file_uploaded_at": now_iso(),
    }})
    return await db.progress_reports.find_one({"id": rid}, {"_id": 0})


@api.get("/progress-reports/{rid}/file")
async def download_progress_report_file(rid: str, user=Depends(get_current_user)):
    report = await db.progress_reports.find_one({"id": rid}, {"_id": 0})
    if not report or not report.get("file_path"):
        raise HTTPException(status_code=404, detail="No file")
    if not await _can_access_progress_report(user, report):
        raise HTTPException(status_code=403, detail="Forbidden")
    fp = UPLOAD_DIR / report["file_path"]
    if not fp.exists():
        raise HTTPException(status_code=404, detail="File missing")
    return FileResponse(str(fp), filename=report.get("file_name") or report["file_path"])


@api.delete("/progress-reports/{rid}/file")
async def delete_progress_report_file(rid: str, user=Depends(get_current_user)):
    report = await db.progress_reports.find_one({"id": rid}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if user.get("role") != "admin" and not await _can_access_progress_report(user, report):
        raise HTTPException(status_code=403, detail="Forbidden")
    if report.get("file_path"):
        fp = UPLOAD_DIR / report["file_path"]
        if fp.exists():
            fp.unlink()
    await db.progress_reports.update_one({"id": rid}, {"$set": {
        "file_path": None, "file_name": None, "file_uploaded_at": None,
    }})
    return {"ok": True}


APR2026_PROGRESS_REPORTS = [
    {"file_no": "009", "title": "009's Progress Report - Apr 2026",
     "url": "https://docs.google.com/document/d/14c29YPvhWaZirB5Qc-_47qP7Q_04-IOZEhpWk76WiU0/edit"},
    {"file_no": "040", "title": "40's Progress Report - Apr 2026",
     "url": "https://docs.google.com/document/d/1uPUgFPz944AqlHXFXT3oVOpar6JETzsQQ3a6rd3XTK8/edit"},
    {"file_no": "042", "title": "042's Progress Report - Apr 2026",
     "url": "https://docs.google.com/document/d/14tyu4xNlG4AmzALpjYwuWwKflwqk_buX-i2rsovxKRY/edit"},
    {"file_no": "047", "title": "047's Progress Report - Apr 2026",
     "url": "https://drive.google.com/file/d/1eD8w2NQ5WCRtZrODhX33RHQYGT2jbHvM/view"},
    {"file_no": "070", "title": "070's Progress Report - Apr 2026",
     "url": "https://drive.google.com/file/d/1tI5z5vrDDVaApSOAsp4HbkcawcDe42ll/view"},
    {"file_no": "072", "title": "072's Progress Report - Apr 2026",
     "url": "https://docs.google.com/document/d/19UY48orOHqV-ItptNFVxUgRyLgWeWgi8gIy--SmbMHA/edit"},
    {"file_no": "024", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "035", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "038", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "041", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "052", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "054", "title": "54's Progress Report - Apr 2026", "url": ""},
    {"file_no": "011", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "034", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "060", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "061", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "062", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "063", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "064", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "068", "title": "Progress Report - Apr 2026", "url": ""},
    {"file_no": "027", "title": "Progress Report - Apr 2026", "url": ""},
]


async def _find_client_by_file_no(file_no: str) -> Optional[dict]:
    raw = str(file_no or "").strip()
    padded = raw.zfill(3)
    for candidate in {raw, padded, raw.lstrip("0") or raw}:
        hit = await db.clients.find_one({"file_no": candidate}, {"_id": 0, "id": 1, "file_no": 1, "name": 1})
        if hit:
            return hit
    return None


@api.post("/admin/seed-progress-reports-apr2026")
async def seed_apr_progress_reports(_=Depends(admin_only)):
    """Idempotently seed April 2026 progress reports with Drive links where available."""
    inserted = 0
    skipped = 0
    missing = []
    report_date = "2026-04-30"
    for item in APR2026_PROGRESS_REPORTS:
        client = await _find_client_by_file_no(item["file_no"])
        if not client:
            missing.append(item["file_no"])
            continue
        cid = client["id"]
        existing = await db.progress_reports.find_one({
            "client_id": cid,
            "title": item["title"],
            "report_date": report_date,
        })
        if existing:
            skipped += 1
            continue
        url = (item.get("url") or "").strip() or None
        await db.progress_reports.insert_one({
            "id": str(uuid.uuid4()),
            "client_id": cid,
            "title": item["title"],
            "report_date": report_date,
            "url": url,
            "notes": "April 2026",
            "uploaded": False,
            "uploaded_by": None,
            "uploaded_at": None,
            "reviewed": False,
            "reviewed_by": None,
            "reviewed_at": None,
            "resolved": False,
            "resolved_by": None,
            "resolved_at": None,
            "file_name": None,
            "file_path": None,
            "file_uploaded_at": None,
            "created_by": "admin-seed",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        inserted += 1
    return {
        "inserted": inserted,
        "skipped": skipped,
        "missing_clients": missing,
        "message": f"Seeded {inserted} progress reports ({skipped} already existed)",
    }


class DeleteClientSessionsIn(BaseModel):
    file_no: str


@api.get("/admin/client-lookup/{file_no}")
async def admin_lookup_client_by_file_no(file_no: str, _=Depends(admin_only)):
    """Preview client name and session/invoice counts before bulk delete."""
    client = await _find_client_by_file_no(file_no)
    if not client:
        raise HTTPException(status_code=404, detail=f"Client file_no {file_no} not found")
    cid = client["id"]
    sessions_count = await db.sessions.count_documents({"client_id": cid})
    invoices_count = await db.invoices.count_documents({"client_id": cid})
    return {
        "client_id": cid,
        "file_no": client.get("file_no"),
        "name": client.get("name"),
        "sessions_count": sessions_count,
        "invoices_count": invoices_count,
    }


@api.post("/admin/delete-client-sessions-invoices")
async def admin_delete_client_sessions_invoices(body: DeleteClientSessionsIn, _=Depends(admin_only)):
    client = await _find_client_by_file_no(body.file_no)
    if not client:
        raise HTTPException(status_code=404, detail=f"Client file_no {body.file_no} not found")
    cid = client["id"]
    s_result = await db.sessions.delete_many({"client_id": cid})
    i_result = await db.invoices.delete_many({"client_id": cid})
    return {
        "client_id": cid,
        "client_name": client.get("name"),
        "file_no": client.get("file_no"),
        "sessions_deleted": s_result.deleted_count,
        "invoices_deleted": i_result.deleted_count,
        "message": f"Deleted {s_result.deleted_count} sessions and {i_result.deleted_count} invoices for {client.get('name')}",
    }


class PurgeTherapistIn(BaseModel):
    name_pattern: str


@api.get("/admin/therapist-search")
async def admin_therapist_search(q: str = "", _=Depends(admin_only)):
    """Find therapists/users matching a name pattern (e.g. naja)."""
    regex = {"$regex": q.strip() or ".", "$options": "i"}
    therapists = await db.therapists.find({"name": regex}, {"_id": 0, "pin_hash": 0, "password_hash": 0}).sort("name", 1).to_list(50)
    users = await db.users.find(
        {"$or": [{"name": regex}, {"username": regex}, {"email": regex}]},
        {"_id": 0, "password_hash": 0, "pin_hash": 0},
    ).to_list(50)
    for t in therapists:
        t["schedule_cells"] = await db.schedule_cells.count_documents({"therapist_id": t["id"]})
    return {"therapists": therapists, "users": users, "query": q}


@api.post("/admin/purge-therapist")
async def admin_purge_therapist(body: PurgeTherapistIn, _=Depends(admin_only)):
    """Delete therapist(s), linked users, and schedule cells by name pattern."""
    pat = body.name_pattern.strip()
    if not pat:
        raise HTTPException(status_code=400, detail="name_pattern required")
    regex = {"$regex": pat, "$options": "i"}
    found = await db.therapists.find({"name": regex}, {"_id": 0}).to_list(50)
    if not found:
        found_users = await db.users.find({"$or": [{"name": regex}, {"username": regex}]}, {"_id": 0}).to_list(50)
        for u in found_users:
            await db.users.delete_one({"id": u["id"]})
        return {"therapists_deleted": 0, "users_deleted": len(found_users), "schedule_cells_deleted": 0, "names": []}
    names, sc_total, u_total = [], 0, 0
    for t in found:
        sc = await db.schedule_cells.delete_many({"therapist_id": t["id"]})
        uc = await db.users.delete_many({"$or": [{"therapist_id": t["id"]}, {"name": t.get("name")}]})
        await db.therapists.delete_one({"id": t["id"]})
        names.append(t.get("name"))
        sc_total += sc.deleted_count
        u_total += uc.deleted_count
    return {
        "therapists_deleted": len(found),
        "users_deleted": u_total,
        "schedule_cells_deleted": sc_total,
        "names": names,
        "message": f"Removed {len(found)} therapist(s): {', '.join(names)}",
    }


class ClearRequestsIn(BaseModel):
    confirm: str


@api.post("/admin/clear-requests")
async def admin_clear_all_requests(body: ClearRequestsIn, _=Depends(admin_only)):
    if body.confirm != "DELETE":
        raise HTTPException(status_code=400, detail='Type "DELETE" to confirm')
    r = await db.requests.delete_many({})
    l = await db.leaves.delete_many({})
    return {
        "requests_deleted": r.deleted_count,
        "leaves_deleted": l.deleted_count,
        "message": f"Deleted {r.deleted_count} requests and {l.deleted_count} leave requests",
    }


# ------------------- Invoices (per client; manual numbers) -------------------
@api.get("/clients/{cid}/invoices")
async def list_invoices(cid: str, service_type: Optional[str] = None, user=Depends(get_current_user)):
    items = await db.invoices.find({"client_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    if service_type:
        code = _normalize_service_type(service_type)
        if code:
            items = [i for i in items if _normalize_service_type(i.get("service_type")) == code]
    return items

# ------------------- Package status (last open invoice) -------------------
def _sort_invoices_by_date(invoices: list) -> list:
    return sorted(
        invoices,
        key=lambda i: (i.get("start_date") or i.get("created_at") or ""),
        reverse=True,
    )


def _last_open_invoice(invoices: list, service_code: str) -> Optional[dict]:
    for inv in _sort_invoices_by_date(invoices):
        if inv.get("is_closed"):
            continue
        if _normalize_service_type(inv.get("service_type")) == service_code:
            return inv
    return None


def _sessions_for_invoice(inv: dict, sessions: list) -> list:
    inv_id = inv.get("id")
    inv_num = (inv.get("invoice_number") or "").strip()
    cid = inv.get("client_id")
    out = []
    for s in sessions:
        if s.get("client_id") != cid:
            continue
        if s.get("invoice_id") == inv_id:
            out.append(s)
        elif inv_num and (s.get("source_invoice") or "").strip() == inv_num:
            out.append(s)
    return out


def _client_service_codes(client: dict, invoices: list) -> list:
    codes = set()
    cst = _normalize_service_type(client.get("service_type"))
    raw = (client.get("service_type") or "").upper()
    if cst == "HS" or "HS" in raw:
        codes.add("HS")
    if cst == "SS" or "SS" in raw:
        codes.add("SS")
    if not codes or cst is None or "HS+SS" in raw or "HS/SS" in raw:
        codes.update({"HS", "SS"})
    for inv in invoices:
        if not inv.get("is_closed"):
            st = _normalize_service_type(inv.get("service_type"))
            if st in ("HS", "SS"):
                codes.add(st)
    return sorted(codes)


def _is_school_day(d: datetime) -> bool:
    """Sun–Thu are school days (Python weekday: Mon=0 … Sun=6)."""
    return d.weekday() in (6, 0, 1, 2, 3)


def _collect_school_days(from_date: datetime, count: int) -> list:
    out = []
    d = from_date
    guard = 0
    while len(out) < count and guard < 400:
        if _is_school_day(d):
            out.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
        guard += 1
    return out


def _school_week_windows(anchor_iso: str, total_weeks: int = 4) -> list:
    if not anchor_iso:
        return []
    try:
        anchor = datetime.fromisoformat(str(anchor_iso)[:10])
    except Exception:
        return []
    school_days = _collect_school_days(anchor, int(total_weeks) * 5)
    windows = []
    for k in range(int(total_weeks)):
        chunk = school_days[k * 5:(k + 1) * 5]
        windows.append({
            "week_number": k + 1,
            "dates": chunk,
            "start": chunk[0] if chunk else None,
            "end": chunk[-1] if chunk else None,
        })
    return windows


def _school_week_for_date(date_iso: str, anchor_iso: str, total_weeks: int = 4) -> Optional[int]:
    if not date_iso or not anchor_iso:
        return None
    d = str(date_iso)[:10]
    for w in _school_week_windows(anchor_iso, total_weeks):
        if d in w["dates"]:
            return w["week_number"]
    return None


def _day_name_from_date(date_iso: str) -> str:
    try:
        return datetime.fromisoformat(str(date_iso)[:10]).strftime("%a")
    except Exception:
        return ""


def _weeks_done_for_invoice(sessions: list, anchor_iso: str, total_weeks: int) -> int:
    """Count completed school weeks (5 Sun–Thu blocks from invoice start)."""
    if not anchor_iso or total_weeks <= 0:
        return 0
    windows = _school_week_windows(anchor_iso, total_weeks)
    completed = [s for s in sessions if s.get("status") == "Completed" and s.get("session_date")]
    done = 0
    for w in windows:
        if not w["dates"]:
            continue
        attended = sum(1 for s in completed if str(s["session_date"])[:10] in w["dates"])
        if attended > 0:
            done += 1
    return done


def _package_status_level_hs(remaining: float, total: float) -> str:
    if total <= 0 or remaining <= 0:
        return "expired"
    pct = (remaining / total) * 100
    if pct <= 10:
        return "critical"
    if pct <= 30:
        return "low"
    return "good"


def _package_status_level_ss_weeks(remaining_weeks: float) -> str:
    if remaining_weeks <= 0:
        return "expired"
    if remaining_weeks <= 1:
        return "critical"
    if remaining_weeks <= 2:
        return "low"
    return "good"


def _package_status_level_ss_sessions(remaining: float, total: float) -> str:
    if total <= 0 or remaining <= 0:
        return "expired"
    pct = (remaining / total) * 100
    if pct < 20:
        return "critical"
    if pct <= 40:
        return "low"
    return "good"


def _compute_package_status_row(client: dict, service_code: str, invoices: list, sessions: list) -> dict:
    inv = _last_open_invoice(invoices, service_code)
    base = {
        "client_id": client["id"],
        "client_name": client.get("name") or "",
        "file_no": client.get("file_no"),
        "service_type": service_code,
        "invoice_id": None,
        "invoice_number": None,
        "package_size": None,
        "used": 0,
        "remaining": 0,
        "remaining_pct": 0,
        "status": "none",
        "unit": "hours" if service_code == "HS" else "weeks",
        "label": "No open invoice",
        "current_week": None,
        "total_weeks": None,
    }
    if not inv:
        return base

    inv_sessions = _sessions_for_invoice(inv, sessions)
    pkg = float(inv.get("package_size") or (24 if service_code == "HS" else 4))

    if service_code == "HS":
        used = sum(
            float(s.get("hours") or 0)
            for s in inv_sessions
            if s.get("status") in ("Completed", "Cancelled")
        )
        remaining = round(pkg - used, 2)
        pct = round((remaining / pkg) * 100, 1) if pkg > 0 else 0
        level = _package_status_level_hs(remaining, pkg)
        if inv.get("is_closed"):
            level = "expired"
        label = f"{int(pkg) if pkg == int(pkg) else pkg}h · {remaining}h left"
        return {
            **base,
            "invoice_id": inv["id"],
            "invoice_number": inv.get("invoice_number"),
            "package_size": pkg,
            "used": round(used, 2),
            "remaining": remaining,
            "remaining_pct": pct,
            "status": level,
            "unit": "hours",
            "label": label,
        }

    # SS — always 4 school weeks per invoice
    total_weeks = 4
    anchor = inv.get("start_date") or client.get("cycle_start_date") or now_iso()[:10]
    weeks_done = _weeks_done_for_invoice(inv_sessions, anchor, total_weeks)
    remaining_w = max(0, total_weeks - weeks_done)
    current_w = min(total_weeks, weeks_done + 1) if weeks_done < total_weeks else total_weeks
    level = _package_status_level_ss_weeks(remaining_w)
    if inv.get("is_closed"):
        level = "expired"
    if remaining_w <= 1 and remaining_w > 0:
        label = "Last week!"
    else:
        label = f"Wk {current_w} of {total_weeks}"
    return {
        **base,
        "invoice_id": inv["id"],
        "invoice_number": inv.get("invoice_number"),
        "package_size": total_weeks,
        "used": weeks_done,
        "remaining": remaining_w,
        "remaining_pct": round((remaining_w / total_weeks) * 100, 1) if total_weeks else 0,
        "status": level,
        "unit": "weeks",
        "label": label,
        "current_week": current_w,
        "total_weeks": total_weeks,
    }


def _package_status_for_client(client: dict, invoices: list, sessions: list) -> list:
    client_invs = [i for i in invoices if i.get("client_id") == client["id"]]
    client_sess = [s for s in sessions if s.get("client_id") == client["id"]]
    codes = _client_service_codes(client, client_invs)
    return [_compute_package_status_row(client, code, client_invs, client_sess) for code in codes]


@api.get("/clients/package-status")
async def list_clients_package_status(user=Depends(get_current_user)):
    clients = await db.clients.find(
        {"status": {"$ne": "Inactive"}}, {"_id": 0}
    ).sort("name", 1).to_list(500)
    if not _has_full_client_access(user):
        uid = user["id"]
        clients = [
            c for c in clients
            if c.get("main_therapist_id") == uid or uid in (c.get("co_therapist_ids") or [])
        ]
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    client_ids = {c["id"] for c in clients}
    sessions = await db.sessions.find(
        {"client_id": {"$in": list(client_ids)}}, {"_id": 0}
    ).to_list(20000) if client_ids else []
    rows = []
    for c in clients:
        rows.extend(_package_status_for_client(c, invoices, sessions))
    order = {"critical": 0, "expired": 1, "low": 2, "good": 3, "none": 4}
    rows.sort(key=lambda r: (order.get(r["status"], 9), r.get("client_name") or ""))
    return rows


@api.get("/clients/{cid}/package-status")
async def get_client_package_status(cid: str, user=Depends(get_current_user)):
    client = await db.clients.find_one({"id": cid}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not _has_full_client_access(user):
        uid = user["id"]
        if client.get("main_therapist_id") != uid and uid not in (client.get("co_therapist_ids") or []):
            fn = str(client.get("file_no") or "").strip()
            if not (fn and _is_supervisor_for_file(user, fn)):
                raise HTTPException(status_code=403, detail="Forbidden")
    invoices = await db.invoices.find({"client_id": cid}, {"_id": 0}).to_list(500)
    sessions = await db.sessions.find({"client_id": cid}, {"_id": 0}).to_list(5000)
    return _package_status_for_client(client, invoices, sessions)


@api.post("/clients/{cid}/invoices")
async def create_invoice(cid: str, payload: InvoiceIn, user=Depends(admin_only)):
    inv_id = str(uuid.uuid4())
    st = _normalize_service_type(payload.service_type)
    pkg_size = payload.package_size
    if st == "SS" and (pkg_size is None or pkg_size > 12):
        pkg_size = 4
    doc = {
        "id": inv_id,
        "client_id": cid,
        "invoice_number": payload.invoice_number.strip(),
        "notes": payload.notes,
        "amount": payload.amount,
        "period_from": payload.period_from,
        "period_to": payload.period_to,
        "package_size": pkg_size,
        "payment_status": payload.payment_status or "pending",
        "start_date": payload.start_date or now_iso()[:10],
        "service_type": _normalize_service_type(payload.service_type),
        "is_closed": bool(payload.is_closed) if payload.is_closed is not None else False,
        "close_date": payload.close_date,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/invoices/{iid}")
async def update_invoice(iid: str, payload: InvoiceIn, _=Depends(admin_only)):
    update = {
        "invoice_number": payload.invoice_number.strip(),
        "notes": payload.notes,
        "amount": payload.amount,
        "period_from": payload.period_from,
        "period_to": payload.period_to,
        "package_size": payload.package_size,
        "payment_status": payload.payment_status,
        "start_date": payload.start_date,
        "service_type": _normalize_service_type(payload.service_type) if payload.service_type is not None else None,
        "is_closed": bool(payload.is_closed) if payload.is_closed is not None else False,
        "close_date": payload.close_date,
    }
    # Don't overwrite stored values with None unless explicitly cleared
    update = {k: v for k, v in update.items() if v is not None or k in ("notes", "amount", "period_from", "period_to", "package_size", "service_type", "close_date")}
    await db.invoices.update_one({"id": iid}, {"$set": update})
    return await db.invoices.find_one({"id": iid}, {"_id": 0})

@api.delete("/invoices/{iid}")
async def delete_invoice(iid: str, _=Depends(admin_only)):
    inv = await db.invoices.find_one({"id": iid}, {"_id": 0, "id": 1, "invoice_number": 1})
    if inv:
        inv_num = (inv.get("invoice_number") or "").strip()
        q = {"invoice_id": iid}
        if inv_num:
            q = {"$or": [{"invoice_id": iid}, {"source_invoice": inv_num}]}
        await db.sessions.delete_many(q)
    await db.invoices.delete_one({"id": iid})
    return {"ok": True}

@api.post("/clients/{cid}/invoices/sync-from-excel")
async def sync_invoices_from_excel(cid: str, file: UploadFile = File(...), user=Depends(admin_only)):
    """Detect invoice sheets dynamically by inspecting an uploaded client workbook (.xlsx).
    Imports BOTH invoices (by sheet name) and the session rows inside each sheet.
    Idempotent: matches invoices by invoice_number, sessions by (client_id, session_date, start_time).
    """
    import openpyxl, io
    client = await db.clients.find_one({"id": cid}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    try:
        content = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {e}")
    return await _ingest_workbook_for_client(cid, client, wb, user["id"], origin="excel-sync")


class SyncFromDriveIn(BaseModel):
    drive_url: str


@api.post("/clients/{cid}/invoices/sync-from-drive")
async def sync_invoices_from_drive(cid: str, payload: SyncFromDriveIn, user=Depends(admin_only)):
    """Fetch a Google Sheets document by URL and import all invoices + sessions.

    The sheet MUST be shared as 'Anyone with the link can view'. We hit the
    public xlsx export endpoint (no OAuth needed): 
        https://docs.google.com/spreadsheets/d/{ID}/export?format=xlsx
    """
    import re as _re
    import io
    import urllib.request
    import openpyxl
    client = await db.clients.find_one({"id": cid}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    url = (payload.drive_url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="drive_url is required")
    m = _re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url) or _re.search(r"[?&]id=([a-zA-Z0-9-_]+)", url)
    if not m:
        raise HTTPException(status_code=400, detail="Could not extract Google Sheets ID from URL. Make sure it is a /spreadsheets/d/<id>/... link.")
    sheet_id = m.group(1)
    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    try:
        req = urllib.request.Request(export_url, headers={"User-Agent": "Mozilla/5.0 BoostGrowthSync/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch sheet from Drive (make sure 'Anyone with the link' has view access): {e}")
    # Persist the source URL on the client for next time.
    await db.clients.update_one({"id": cid}, {"$set": {"attendance_sheet_url": url}})
    return await _ingest_workbook_for_client(cid, client, wb, user["id"], origin="drive-sync")


# ---------- Workbook parser shared by both sync endpoints ----------
import re as _re_top  # for module load

# ---------- Invoice service type (HS / SS) ----------
def _normalize_service_type(val: Optional[str]) -> Optional[str]:
    """Return canonical 'HS', 'SS', or 'AVC', or None if unknown."""
    if not val:
        return None
    s = str(val).strip().lower()
    if s in ("hs", "home session", "home", "home sessions"):
        return "HS"
    if s in ("ss", "school support", "school"):
        return "SS"
    if s in ("avc",):
        return "AVC"
    if "school support" in s:
        return "SS"
    if "home session" in s or "home sessions" in s:
        return "HS"
    if "ss" in s and "hs" not in s:
        return "SS"
    if "hs" in s and "ss" not in s:
        return "HS"
    if "avc" in s:
        return "AVC"
    return None


def _service_type_from_label(text: str) -> Optional[str]:
    """Parse 'Service: Home Sessions' / 'School Support' / 'HS' etc."""
    if not text:
        return None
    raw = str(text).strip()
    s = raw.lower()
    if s.startswith("service:"):
        s = s.split(":", 1)[1].strip()
    if s in ("hs", "ss", "avc"):
        return s.upper()
    if "school" in s:
        return "SS"
    if "home" in s:
        return "HS"
    if "avc" in s:
        return "AVC"
    return _normalize_service_type(raw)


def _session_blob_service_hint(session: dict) -> Optional[str]:
    """Detect HS| or SS| prefix in status / note / location."""
    for field in ("status", "note", "location"):
        raw = (session.get(field) or "").strip()
        if not raw:
            continue
        m = _re_top.match(r"^(HS|SS)\s*\|", raw, _re_top.IGNORECASE)
        if m:
            return m.group(1).upper()
        low = raw.lower()
        if low.startswith("hs ") or low.startswith("hs|"):
            return "HS"
        if low.startswith("ss ") or low.startswith("ss|"):
            return "SS"
    return None


async def _infer_invoice_service_type(inv_id: str, client_id: str, inv_num: str, client: Optional[dict] = None) -> Optional[str]:
    inv_num = (inv_num or "").strip()
    q: dict = {"client_id": client_id, "$or": [{"invoice_id": inv_id}]}
    if inv_num:
        q["$or"].append({"source_invoice": inv_num})
    sessions = await db.sessions.find(q, {"_id": 0, "status": 1, "note": 1, "location": 1}).to_list(1000)
    hs = ss = 0
    for s in sessions:
        hint = _session_blob_service_hint(s)
        if hint == "HS":
            hs += 1
        elif hint == "SS":
            ss += 1
    if ss > hs:
        return "SS"
    if hs > ss:
        return "HS"
    if client:
        cst = _normalize_service_type(client.get("service_type"))
        if cst in ("HS", "SS"):
            return cst
    return None


async def _migrate_invoice_service_types() -> int:
    """Re-infer HS/SS/AVC on invoices from sessions; client profile only when type is missing."""
    migrated = 0
    client_cache: dict = {}
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    for inv in invoices:
        cid = inv.get("client_id") or ""
        if cid not in client_cache:
            client_cache[cid] = await db.clients.find_one(
                {"id": cid}, {"_id": 0, "service_type": 1}
            )
        client = client_cache.get(cid)

        inferred = await _infer_invoice_service_type(
            inv["id"], cid, inv.get("invoice_number", ""), client=None
        )
        if not inferred and not inv.get("service_type") and client:
            cst = _normalize_service_type(client.get("service_type"))
            if cst in ("HS", "SS", "AVC"):
                inferred = cst

        if not inferred:
            normalized = _normalize_service_type(inv.get("service_type"))
            if normalized and inv.get("service_type") != normalized:
                await db.invoices.update_one(
                    {"id": inv["id"]}, {"$set": {"service_type": normalized}}
                )
                migrated += 1
            continue

        if inv.get("service_type") != inferred:
            await db.invoices.update_one(
                {"id": inv["id"]}, {"$set": {"service_type": inferred}}
            )
            migrated += 1
    return migrated


THERAPIST_EMAIL_MIGRATIONS = [
    ("ralshatri@boostgrowthsa.com", "ralshatery@boostgrowthsa.com"),
    ("salhammamy@boostgrowthsa.com", "shalhammami@boostgrowthsa.com"),
    ("aalroman@boostgrowthsa.com", "a.alromman@boostgrowthsa.com"),
    ("salamri@boostgrowthsa.com", "shalamri@boostgrowthsa.com"),
    ("aalshreef@boostgrowthsa.com", "a.alshareef@boostgrowthsa.com"),
    ("naja@boostgrowthsa.com", "nalhamad@boostgrowthsa.com"),
]


async def _migrate_therapist_emails() -> int:
    """Fix therapist emails: rename old→new, then force-sync from MASTER_THERAPISTS by key/name."""
    updated = 0
    for old_email, new_email in THERAPIST_EMAIL_MIGRATIONS:
        old_l = old_email.lower()
        new_l = new_email.lower()
        r1 = await db.therapists.update_many(
            {"email": {"$regex": f"^{re.escape(old_l)}$", "$options": "i"}},
            {"$set": {"email": new_l}},
        )
        r2 = await db.users.update_many(
            {"email": {"$regex": f"^{re.escape(old_l)}$", "$options": "i"}},
            {"$set": {"email": new_l}},
        )
        updated += (r1.modified_count or 0) + (r2.modified_count or 0)

    existing_ts = await db.therapists.find(
        {}, {"_id": 0, "id": 1, "name": 1, "key": 1, "email": 1}
    ).to_list(500)

    for key, first, email, role, leave_balance, join_date in MASTER_THERAPISTS:
        new_l = email.lower()
        match = next((t for t in existing_ts if t.get("key") == key), None)
        if not match:
            match = next(
                (t for t in existing_ts if first.lower() in (t.get("name") or "").lower()),
                None,
            )
        if not match:
            continue
        tid = match["id"]
        old_l = (match.get("email") or "").lower()
        if old_l != new_l:
            await db.therapists.update_one({"id": tid}, {"$set": {"email": new_l}})
            updated += 1
        # users: match by therapist id or any prior email for this person
        for candidate in {old_l, new_l, *(o.lower() for o, n in THERAPIST_EMAIL_MIGRATIONS if n.lower() == new_l)}:
            if not candidate:
                continue
            r = await db.users.update_many({"email": candidate}, {"$set": {"email": new_l}})
            updated += r.modified_count or 0
        r_id = await db.users.update_one({"id": tid}, {"$set": {"email": new_l}})
        if r_id.modified_count:
            updated += r_id.modified_count

    jenan = await db.therapists.find_one({"email": "jsalmuhaisin@boostgrowthsa.com"}, {"_id": 0, "id": 1})
    if not jenan:
        hit = await db.therapists.find_one({"name": {"$regex": "Jenan", "$options": "i"}}, {"_id": 0, "id": 1})
        if hit:
            await db.therapists.update_one({"id": hit["id"]}, {"$set": {"email": "jsalmuhaisin@boostgrowthsa.com"}})
            updated += 1
    return updated


@api.post("/admin/migrate-therapist-emails")
async def admin_migrate_therapist_emails(_=Depends(admin_only)):
    """Manually run therapist email migration (also runs on server startup)."""
    n = await _migrate_therapist_emails()
    return {"ok": True, "records_updated": n}


_INV_SHEET_RE = _re_top.compile(r"^(copy of\s+)?inv[\s\-_]*\d+", _re_top.IGNORECASE)
_HEADER_TOKENS = {"day", "days", "date", "status", "time", "hrs", "hours", "# of hrs", "therapist", "note", "notes"}


def _sheet_has_session_table(ws) -> bool:
    """True if worksheet looks like an invoice session table (Day/Date + Time/Hrs)."""
    for row in ws.iter_rows(min_row=1, max_row=12, values_only=True):
        cells = [str(c).strip().lower() if c is not None else "" for c in (row or [])]
        joined = " ".join(cells)
        if "date" in cells and ("time" in cells or "hrs" in joined or "# of hrs" in joined):
            return True
    return False


def _discover_invoice_sheets(wb, client_file_no: str = None) -> list:
    """Sheets named INV*, matching client file_no, or containing a session table header."""
    out = []
    fn_raw = (client_file_no or "").strip()
    fn_padded = fn_raw.zfill(3) if fn_raw else ""
    fn_stripped = fn_raw.lstrip("0") or fn_raw
    skip_hints = ("summary", "info", "readme", "template", "cover", "index")
    for name in wb.sheetnames:
        sn = name.strip()
        sn_low = sn.lower()
        if any(h in sn_low for h in skip_hints):
            continue
        if _INV_SHEET_RE.match(sn):
            out.append(name)
            continue
        sn_compact = _re_top.sub(r"[\s\-_]+", "", sn)
        if fn_padded and (fn_padded in sn_compact or (fn_stripped and fn_stripped in sn_compact)):
            try:
                if _sheet_has_session_table(wb[name]):
                    out.append(name)
                    continue
            except Exception:
                pass
        try:
            if _sheet_has_session_table(wb[name]):
                out.append(name)
        except Exception:
            continue
    return out


def _parse_invoice_header(ws, sheet_name: str = "") -> dict:
    """Read the header section (rows 1–10) for invoice metadata and service type."""
    sn = (sheet_name or ws.title or "").strip()
    info = {
        "invoice_number": sn,
        "is_closed": False,
        "close_date": None,
        "package_size": None,
        "service_type": None,
    }
    rows: list = []
    for r in ws.iter_rows(min_row=1, max_row=10, values_only=True):
        rows.append([str(c).strip() if c is not None else "" for c in (r or [])])

    # Invoice number — tab name (INV0465) or embedded in rows 1–10
    if _INV_SHEET_RE.match(sn):
        info["invoice_number"] = _re_top.sub(r"[\s\-_]+", "", sn, flags=_re_top.IGNORECASE).upper()
    else:
        for row in rows[:10]:
            joined = " ".join(row)
            m = _re_top.search(r"(inv[\s\-_]*\d+)", joined, _re_top.IGNORECASE)
            if m:
                info["invoice_number"] = _re_top.sub(
                    r"[\s\-_]+", "", m.group(1), flags=_re_top.IGNORECASE
                ).upper()
                break

    flat = " | ".join(" ".join(r) for r in rows).lower()

    # Open / closed status
    if "closed" in flat:
        info["is_closed"] = True
        m = _re_top.search(r"closed[^0-9]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", flat)
        if m:
            try:
                info["close_date"] = _normalize_date(m.group(1))
            except Exception:
                pass

    # Row 5 (or any header row): "Service: Home Sessions" in column A or any cell
    for row in rows:
        for ci, cell in enumerate(row):
            raw = (cell or "").strip()
            if not raw:
                continue
            if raw.lower().startswith("service:"):
                st = _service_type_from_label(raw)
                if st:
                    info["service_type"] = st
                    break
        if info.get("service_type"):
            break

    # Tab / row hints: "INV0465 | SS", standalone HS/SS cells, keywords in header block
    if not info.get("service_type"):
        sn_low = sn.lower()
        if _re_top.search(r"\bss\b|school", sn_low):
            info["service_type"] = "SS"
        elif _re_top.search(r"\bhs\b|home", sn_low):
            info["service_type"] = "HS"
    if not info.get("service_type"):
        for row in rows[:6]:
            for cell in row:
                cu = (cell or "").strip().upper()
                if cu in ("SS", "HS", "AVC"):
                    info["service_type"] = cu
                    break
                st = _service_type_from_label(cell)
                if st:
                    info["service_type"] = st
                    break
            if info.get("service_type"):
                break
    if not info.get("service_type"):
        if _re_top.search(r"school\s*support|\|\s*ss\b|\bss\s*\|", flat):
            info["service_type"] = "SS"
        elif _re_top.search(r"home\s*session|\|\s*hs\b|\bhs\s*\|", flat):
            info["service_type"] = "HS"
        elif _re_top.search(r"\bavc\b", flat):
            info["service_type"] = "AVC"

    if info.get("service_type"):
        info["service_type"] = _normalize_service_type(info["service_type"])

    # Package size — "# Paid SESH.: 24 Hours" (usually row 6)
    m = _re_top.search(r"paid\s+sesh[^0-9]*([\d.]+)", flat)
    if m:
        try:
            info["package_size"] = float(m.group(1))
        except Exception:
            pass
    return info


def _normalize_date(s: str) -> Optional[str]:
    s = (s or "").strip()
    if not s:
        return None
    # Try ISO first
    try:
        d = datetime.fromisoformat(s[:10])
        return d.strftime("%Y-%m-%d")
    except Exception:
        pass
    # Try D/M/YYYY or D-M-YYYY (Boost Growth format)
    for sep in ("/", "-"):
        if sep in s:
            parts = s.split(sep)
            if len(parts) == 3:
                try:
                    d, mo, y = int(parts[0]), int(parts[1]), int(parts[2])
                    if y < 100:
                        y += 2000
                    return datetime(y, mo, d).strftime("%Y-%m-%d")
                except Exception:
                    continue
    return None


def _parse_time_range(s: str) -> tuple:
    """Return (start_HH:MM, end_HH:MM, hours_diff) or ('','',0)."""
    s = (s or "").strip()
    if not s:
        return "", "", 0.0
    m = _re_top.search(r"(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?", s)
    if not m:
        return "", "", 0.0
    h1, m1, h2, m2 = m.group(1), m.group(2) or "00", m.group(3), m.group(4) or "00"
    start = f"{int(h1):02d}:{int(m1):02d}"
    end = f"{int(h2):02d}:{int(m2):02d}"
    diff = ((int(h2) * 60 + int(m2)) - (int(h1) * 60 + int(m1))) / 60.0
    if diff < 0:
        diff += 24
    return start, end, round(diff, 2)


async def _ingest_workbook_for_client(cid: str, client: dict, wb, user_id: str, origin: str = "import") -> dict:
    """Iterate invoice tabs in the workbook, create invoices + sessions idempotently."""
    therapists = await db.therapists.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    # name token (Manal / Hajer / etc.) -> id
    name_to_id = {}
    for t in therapists:
        name = (t.get("name") or "").replace("Ms.", "").replace("ms.", "").strip()
        if not name:
            continue
        first = name.split()[0].lower()
        name_to_id[first] = t["id"]

    def _resolve_therapist_ids(cell: str) -> list:
        s = (cell or "").lower()
        # Split by hyphen, slash, or comma
        parts = [p.strip() for p in _re_top.split(r"[-/,]", s) if p.strip()]
        out = []
        for p in parts:
            tok = p.split()[0]
            if tok in name_to_id and name_to_id[tok] not in out:
                out.append(name_to_id[tok])
        return out

    matched_sheets = _discover_invoice_sheets(wb, client.get("file_no"))
    debug_sheets = []
    all_tabs = list(wb.sheetnames)
    existing_inv = {i["invoice_number"]: i for i in await db.invoices.find(
        {"client_id": cid}, {"_id": 0}
    ).to_list(500)}
    pkg_default = client.get("package_hours") or 24
    existing_sessions = await db.sessions.find(
        {"client_id": cid}, {"_id": 0, "session_date": 1, "start_time": 1, "sync_key": 1}
    ).to_list(5000)
    existing_key = {(s.get("session_date"), s.get("start_time") or "") for s in existing_sessions}
    existing_sync = {s["sync_key"] for s in existing_sessions if s.get("sync_key")}

    invoices_added, invoices_updated, sessions_added, sessions_skipped = [], [], 0, 0

    for tab_idx, name in enumerate(matched_sheets):
        ws = wb[name]
        clean = name.strip()
        header_info = _parse_invoice_header(ws, clean)
        inv_num = header_info.get("invoice_number") or clean
        if not _INV_SHEET_RE.match(inv_num):
            inv_num = f"INV_{cid[:8]}_{tab_idx + 1}"
        header_info["invoice_number"] = inv_num
        sheet_hs = sheet_ss = 0
        debug_sheets.append({"sheet": clean, "invoice_number": inv_num})
        # Upsert invoice — match by invoice_number or legacy tab name
        inv_pkg = header_info.get("package_size") or pkg_default
        existing = existing_inv.get(inv_num) or existing_inv.get(clean)
        if existing:
            update = {
                "is_closed": header_info["is_closed"],
                "close_date": header_info.get("close_date"),
                "package_size": inv_pkg,
                "invoice_number": inv_num,
            }
            detected_st = _normalize_service_type(header_info.get("service_type"))
            if detected_st:
                update["service_type"] = detected_st
            await db.invoices.update_one({"id": existing["id"]}, {"$set": update})
            invoices_updated.append(inv_num)
            inv_doc = {**existing, **update}
            existing_inv[inv_num] = inv_doc
        else:
            inv_doc = {
                "id": str(uuid.uuid4()), "client_id": cid,
                "invoice_number": inv_num, "notes": None, "amount": None,
                "period_from": None, "period_to": header_info.get("close_date"),
                "package_size": inv_pkg,
                "payment_status": "complete" if header_info["is_closed"] else "pending",
                "start_date": now_iso()[:10],
                "service_type": _normalize_service_type(header_info.get("service_type")),
                "is_closed": header_info["is_closed"],
                "close_date": header_info.get("close_date"),
                "source": origin, "source_sheet": clean,
                "created_by": user_id, "created_at": now_iso(),
            }
            await db.invoices.insert_one(inv_doc)
            invoices_added.append(inv_num)
            existing_inv[inv_num] = inv_doc

        # Find header row containing the session columns
        header_row_idx = None
        col_map = {}
        for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=12, values_only=True), start=1):
            cells = [str(c).strip().lower() if c is not None else "" for c in row]
            joined = " ".join(cells)
            if "date" in cells and ("status" in cells or "# of hrs" in joined or "hrs" in joined):
                header_row_idx = r_idx
                for ci, h in enumerate(cells):
                    if h in ("day", "days"):
                        col_map["day"] = ci
                    elif h == "date":
                        col_map["date"] = ci
                    elif h == "status":
                        col_map["status"] = ci
                    elif h == "time":
                        col_map["time"] = ci
                    elif h in ("# of hrs", "hrs", "hours"):
                        col_map["hours"] = ci
                    elif h == "therapist":
                        col_map["therapist"] = ci
                    elif h in ("note", "notes"):
                        col_map["note"] = ci
                break
        if header_row_idx is None or "date" not in col_map:
            continue

        # Earliest session_date for this invoice -> use as start_date
        earliest = None
        # Iterate session rows after the header
        for row_idx, row in enumerate(ws.iter_rows(min_row=header_row_idx + 1, values_only=True), start=header_row_idx + 1):
            if row is None or all((c is None or (isinstance(c, str) and not c.strip())) for c in row):
                continue
            raw_date = row[col_map["date"]] if col_map["date"] < len(row) else None
            # Stop when we hit a totals/footer row
            joined = " ".join(str(c).lower() for c in row if c is not None)
            if "total" in joined and "session" in joined:
                break
            date_iso = None
            if isinstance(raw_date, datetime):
                date_iso = raw_date.strftime("%Y-%m-%d")
            elif raw_date:
                date_iso = _normalize_date(str(raw_date))
            if not date_iso:
                continue
            status_val = (str(row[col_map["status"]]).strip() if "status" in col_map and col_map["status"] < len(row) and row[col_map["status"]] else "").strip()
            # Normalize statuses — strip HS| / SS| service prefix if present
            status_l = status_val.lower()
            svc_hint = _session_blob_service_hint({"status": status_val, "note": "", "location": ""})
            if svc_hint == "HS":
                sheet_hs += 1
            elif svc_hint == "SS":
                sheet_ss += 1
            if _re_top.match(r"^(HS|SS)\s*\|", status_val, _re_top.IGNORECASE):
                status_val = _re_top.sub(r"^(HS|SS)\s*\|\s*", "", status_val, flags=_re_top.IGNORECASE).strip()
                status_l = status_val.lower()
            if status_l in ("completed", "complete", "delivered"):
                status_norm = "Completed"
            elif "no service" in status_l or status_l == "ns":
                status_norm = "No Service"
            elif "cancel" in status_l:
                status_norm = "Cancelled"
            elif "no show" in status_l or "no-show" in status_l:
                status_norm = "No Show"
            else:
                status_norm = status_val.title() if status_val else "Completed"
            time_str = str(row[col_map["time"]]).strip() if "time" in col_map and col_map["time"] < len(row) and row[col_map["time"]] else ""
            start_t, end_t, calc_h = _parse_time_range(time_str)
            hours_val = row[col_map["hours"]] if "hours" in col_map and col_map["hours"] < len(row) else None
            try:
                hours_f = float(hours_val) if hours_val not in (None, "", "—") else calc_h
            except Exception:
                hours_f = calc_h
            ther_cell = str(row[col_map["therapist"]]).strip() if "therapist" in col_map and col_map["therapist"] < len(row) and row[col_map["therapist"]] else ""
            ther_ids = _resolve_therapist_ids(ther_cell)
            note_val = str(row[col_map["note"]]).strip() if "note" in col_map and col_map["note"] < len(row) and row[col_map["note"]] else ""
            nh = _session_blob_service_hint({"note": note_val, "status": "", "location": ""})
            if nh == "HS":
                sheet_hs += 1
            elif nh == "SS":
                sheet_ss += 1

            sync_key = f"{inv_num}|{date_iso}|{row_idx}"
            key = (date_iso, start_t)
            if sync_key in existing_sync or key in existing_key:
                sessions_skipped += 1
                continue
            inv_st = _normalize_service_type(inv_doc.get("service_type") or header_info.get("service_type"))
            sess_doc = {
                "id": str(uuid.uuid4()),
                "client_id": cid,
                "session_date": date_iso,
                "day_name": _day_name_from_date(date_iso),
                "start_time": start_t or None,
                "end_time": end_t or None,
                "hours": hours_f if inv_st != "SS" else None,
                "status": status_norm,
                "therapist_ids": ther_ids,
                "note": note_val or None,
                "service_type": inv_st,
                "week_number": None,
                "source": origin,
                "source_invoice": inv_num,
                "invoice_id": inv_doc.get("id"),
                "sync_key": sync_key,
                "created_at": now_iso(),
            }
            await db.sessions.insert_one(sess_doc)
            existing_key.add(key)
            existing_sync.add(sync_key)
            sessions_added += 1
            if earliest is None or date_iso < earliest:
                earliest = date_iso

        # Stamp invoice start_date with earliest imported session date
        if earliest:
            await db.invoices.update_one({"id": inv_doc["id"]}, {"$set": {"start_date": earliest}})

        # Final service_type: Row 5 header → session majority → client profile
        st = _normalize_service_type(header_info.get("service_type"))
        if not st and sheet_hs > sheet_ss:
            st = "HS"
        elif not st and sheet_ss > sheet_hs:
            st = "SS"
        elif not st:
            client_st = _normalize_service_type(client.get("service_type"))
            if client_st in ("SS", "HS", "AVC"):
                st = client_st
        if st:
            await db.invoices.update_one({"id": inv_doc["id"]}, {"$set": {"service_type": st}})
            inv_doc["service_type"] = st
            # SS package is always 4 weeks
            if st == "SS":
                await db.invoices.update_one({"id": inv_doc["id"]}, {"$set": {"package_size": 4}})
                inv_doc["package_size"] = 4

        # Stamp service_type, day_name, week_number on all sessions for this invoice
        anchor = earliest or inv_doc.get("start_date")
        inv_sessions = await db.sessions.find(
            {"client_id": cid, "$or": [{"invoice_id": inv_doc["id"]}, {"source_invoice": inv_num}]},
            {"_id": 0, "id": 1, "session_date": 1},
        ).to_list(2000)
        for s in inv_sessions:
            sd = str(s.get("session_date") or "")[:10]
            patch = {"day_name": _day_name_from_date(sd), "service_type": st}
            if st == "SS":
                patch["week_number"] = _school_week_for_date(sd, anchor, 4)
                patch["hours"] = None
            elif st == "HS":
                patch["week_number"] = None
            await db.sessions.update_one({"id": s["id"]}, {"$set": patch})

    return {
        "matched_sheets": matched_sheets,
        "workbook_tabs": all_tabs,
        "sheet_details": debug_sheets,
        "invoices_added": invoices_added,
        "invoices_updated": invoices_updated,
        "sessions_added": sessions_added,
        "sessions_skipped_existing": sessions_skipped,
        "warning": (
            None if matched_sheets
            else f"No invoice sheets found. Tabs in file: {', '.join(all_tabs)}"
        ),
    }

# ------------------- Package reset (manual; admin only) -------------------
@api.post("/clients/{cid}/reset-package")
async def reset_package(cid: str, user=Depends(admin_only)):
    """Reset used-hours counter to 0 by stamping `package_reset_at`.
    Existing sessions are kept; the frontend filters out sessions before this timestamp
    when computing used hours for the current cycle. Safe and reversible.
    """
    client = await db.clients.find_one({"id": cid}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    ts = now_iso()
    await db.clients.update_one({"id": cid}, {"$set": {
        "package_reset_at": ts,
        "cycle_start_date": ts[:10],
    }})
    return {"ok": True, "package_reset_at": ts}

# ------------------- Sessions (Attendance log) -------------------
def _sessions_with_day_names(sessions: list) -> list:
    for s in sessions:
        if s.get("session_date"):
            s["day_name"] = _day_name_from_date(s["session_date"])
    return sessions


async def _sessions_for_invoice_query(client_id: str, invoice_id: str) -> list:
    """Match sessions by invoice_id, source_invoice, or date window fallback."""
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        return []
    inv_num = (inv.get("invoice_number") or "").strip()
    q_or = [{"invoice_id": invoice_id}]
    if inv_num:
        q_or.append({"source_invoice": inv_num})
    items = await db.sessions.find(
        {"client_id": client_id, "$or": q_or},
        {"_id": 0},
    ).sort("session_date", 1).to_list(2000)
    if items:
        return items
    start = (inv.get("start_date") or "")[:10]
    if not start:
        return []
    all_invs = await db.invoices.find({"client_id": client_id}, {"_id": 0}).to_list(200)
    inv_st = _normalize_service_type(inv.get("service_type"))
    same_type = [
        i for i in all_invs
        if _normalize_service_type(i.get("service_type")) == inv_st or not inv_st
    ]
    same_type.sort(key=lambda i: (i.get("start_date") or i.get("created_at") or ""))
    end = None
    passed = False
    for i in same_type:
        if i.get("id") == invoice_id:
            passed = True
            continue
        if passed:
            ist = (i.get("start_date") or "")[:10]
            if ist and ist > start:
                end = ist
                break
    date_q = {"client_id": client_id, "session_date": {"$gte": start}}
    if end:
        date_q["session_date"]["$lt"] = end
    return await db.sessions.find(date_q, {"_id": 0}).sort("session_date", 1).to_list(2000)


@api.get("/sessions")
async def list_sessions(client_id: Optional[str] = None, invoice_id: Optional[str] = None, user=Depends(get_current_user)):
    if invoice_id and client_id:
        items = await _sessions_for_invoice_query(client_id, invoice_id)
    else:
        q = {}
        if client_id:
            q["client_id"] = client_id
        if invoice_id:
            inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0, "invoice_number": 1})
            if inv:
                inv_num = (inv.get("invoice_number") or "").strip()
                q["$or"] = [{"invoice_id": invoice_id}, {"source_invoice": inv_num}]
            else:
                q["invoice_id"] = invoice_id
        items = await db.sessions.find(q, {"_id": 0}).sort("session_date", -1).to_list(2000)
    if user.get("role") == "therapist":
        uid = user["id"]
        items = [s for s in items if uid in (s.get("therapist_ids") or [])]
    return _sessions_with_day_names(items)

@api.post("/sessions")
async def create_session(payload: SessionIn, user=Depends(get_current_user)):
    sid = str(uuid.uuid4())
    therapist_ids = payload.therapist_ids or []
    if user.get("role") == "therapist" and user["id"] not in therapist_ids:
        therapist_ids.append(user["id"])
    doc = {"id": sid, **payload.model_dump(), "therapist_ids": therapist_ids,
           "created_by": user["id"], "created_by_role": user["role"],
           "created_at": now_iso()}
    await db.sessions.insert_one(doc)
    doc.pop("_id", None)
    # Admin alerts
    client = await db.clients.find_one({"id": payload.client_id}, {"_id": 0})
    cname = client.get("name") if client else "—"
    if user.get("role") == "therapist":
        await _notify_admins("session_log", f"New session logged ({payload.status})",
                             f"{user.get('name')} logged {payload.status} for {cname} ({payload.hours}h)")
    if payload.status in ("Cancelled", "No Show"):
        await _notify_admins("cancel_alert", f"Session {payload.status}: {cname}",
                             f"On {payload.session_date} ({user.get('name')})")
    # Low-hours alert — scoped to last open HS invoice only
    if client:
        invs = await db.invoices.find({"client_id": payload.client_id}, {"_id": 0}).to_list(200)
        open_hs = _last_open_invoice(invs, "HS")
        if open_hs and payload.status == "Completed":
            inv_sessions = await db.sessions.find(
                {"client_id": payload.client_id}, {"_id": 0}
            ).to_list(5000)
            matched = _sessions_for_invoice(open_hs, inv_sessions)
            used_h = sum(
                float(s.get("hours") or 0)
                for s in matched
                if s.get("status") in ("Completed", "Cancelled")
            )
            pkg_h = float(open_hs.get("package_size") or client.get("package_hours") or 24)
            rem = pkg_h - used_h
            inv_label = open_hs.get("invoice_number") or "invoice"
            if 0 < rem <= 4:
                await _notify_admins("low_hours", f"⚠️ {cname} has only {rem}h left ({inv_label})",
                                     f"Pkg {pkg_h}h, used {used_h}h on {inv_label}. Consider package renewal.")
            elif rem <= 0:
                await _notify_admins("low_hours", f"🔴 {cname} package exhausted ({inv_label})",
                                     f"Used {used_h}h of {pkg_h}h on {inv_label}.")
    return doc

@api.put("/sessions/{sid}")
async def update_session(sid: str, payload: SessionIn, user=Depends(get_current_user)):
    sess = await db.sessions.find_one({"id": sid})
    if not sess:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and user["id"] not in (sess.get("therapist_ids") or []):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.sessions.update_one({"id": sid}, {"$set": payload.model_dump()})
    return await db.sessions.find_one({"id": sid}, {"_id": 0})

@api.delete("/sessions/{sid}")
async def delete_session(sid: str, user=Depends(get_current_user)):
    sess = await db.sessions.find_one({"id": sid})
    if not sess:
        return {"ok": True}
    if user.get("role") != "admin" and user["id"] not in (sess.get("therapist_ids") or []):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.sessions.delete_one({"id": sid})
    return {"ok": True}

# ------------------- Attendance Sheets (file upload, kept for backward compat) -------------------
@api.get("/clients/{cid}/sheets")
async def list_sheets(cid: str, user=Depends(get_current_user)):
    return await db.attendance_sheets.find({"client_id": cid}, {"_id": 0}).sort("page_number", 1).to_list(500)

@api.post("/clients/{cid}/sheets")
async def upload_sheet(cid: str,
                      title: str = Form(...),
                      session_date: str = Form(...),
                      therapist_id: Optional[str] = Form(None),
                      notes: Optional[str] = Form(None),
                      file: Optional[UploadFile] = File(None),
                      _=Depends(admin_only)):
    sid = str(uuid.uuid4())
    file_path = None
    file_name = None
    if file:
        ext = Path(file.filename).suffix
        file_name = file.filename
        save_path = UPLOAD_DIR / f"{sid}{ext}"
        save_path.write_bytes(await file.read())
        file_path = f"{sid}{ext}"
    last = await db.attendance_sheets.find_one({"client_id": cid}, sort=[("page_number", -1)])
    page_number = (last.get("page_number", 0) + 1) if last else 1
    doc = {"id": sid, "client_id": cid, "title": title, "session_date": session_date,
           "therapist_id": therapist_id, "notes": notes, "page_number": page_number,
           "file_name": file_name, "file_path": file_path, "created_at": now_iso()}
    await db.attendance_sheets.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/sheets/{sid}")
async def delete_sheet(sid: str, _=Depends(admin_only)):
    sheet = await db.attendance_sheets.find_one({"id": sid})
    if sheet and sheet.get("file_path"):
        fp = UPLOAD_DIR / sheet["file_path"]
        if fp.exists():
            fp.unlink()
    await db.attendance_sheets.delete_one({"id": sid})
    return {"ok": True}

@api.get("/sheets/{sid}/download")
async def download_sheet(sid: str, user=Depends(get_current_user)):
    sheet = await db.attendance_sheets.find_one({"id": sid}, {"_id": 0})
    if not sheet or not sheet.get("file_path"):
        raise HTTPException(status_code=404, detail="No file")
    fp = UPLOAD_DIR / sheet["file_path"]
    return FileResponse(str(fp), filename=sheet.get("file_name") or sheet["file_path"])

# ------------------- Requests -------------------
@api.get("/requests")
async def list_requests(user=Depends(get_current_user)):
    q = {} if user.get("role") == "admin" else {"therapist_id": user["id"]}
    return await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/requests")
async def create_request(payload: RequestIn, user=Depends(get_current_user)):
    if user.get("role") != "therapist":
        raise HTTPException(status_code=403, detail="Therapist only")
    rid = str(uuid.uuid4())
    doc = {"id": rid, "therapist_id": user["id"], "therapist_name": user.get("name"),
           **payload.model_dump(), "status": "pending", "admin_note": None,
           "created_at": now_iso(), "updated_at": now_iso(),
           "timeline": [{"event": "submitted", "at": now_iso(), "by": user.get("name")}]}
    await db.requests.insert_one(doc)
    doc.pop("_id", None)
    # Notify admins of new request
    await _notify_admins("request_new", f"New {payload.request_type} request",
                         f"{user.get('name')}: {payload.title} (priority: {payload.priority})")
    return doc

@api.put("/requests/{rid}/status")
async def update_request_status(rid: str, payload: RequestStatusUpdate, admin=Depends(admin_only)):
    req = await db.requests.find_one({"id": rid})
    if not req:
        raise HTTPException(status_code=404, detail="Not found")
    timeline = req.get("timeline", [])
    timeline.append({"event": payload.status, "at": now_iso(), "by": admin.get("name") or "Admin",
                     "note": payload.admin_note})
    await db.requests.update_one({"id": rid}, {"$set": {
        "status": payload.status, "admin_note": payload.admin_note,
        "updated_at": now_iso(), "timeline": timeline,
    }})
    status_map = {"pending": "Pending", "in_progress": "In Progress",
                  "approved": "Approved", "rejected": "Rejected", "done": "Completed"}
    await _notify(req["therapist_id"], "request", "Request update",
                  f"Your request '{req['title']}' is now: {status_map.get(payload.status, payload.status)}")
    return await db.requests.find_one({"id": rid}, {"_id": 0})

@api.delete("/requests/{rid}")
async def delete_request(rid: str, user=Depends(get_current_user)):
    req = await db.requests.find_one({"id": rid})
    if not req:
        return {"ok": True}
    if user.get("role") != "admin" and req.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.requests.delete_one({"id": rid})
    return {"ok": True}

# ------------------- Notifications -------------------
@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)

@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/{nid}/acknowledge")
async def acknowledge_notification(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": nid, "user_id": user["id"]},
        {"$set": {"read": True, "acknowledged": True, "acknowledged_at": now_iso()}},
    )
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

# ------------------- Directory -------------------
@api.get("/directory")
async def list_directory(user=Depends(get_current_user)):
    return await db.directory.find({}, {"_id": 0}).to_list(500)

@api.post("/directory")
async def create_contact(payload: DirectoryContactIn, _=Depends(admin_only)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, **payload.model_dump(), "created_at": now_iso()}
    await db.directory.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/directory/{cid}")
async def update_contact(cid: str, payload: DirectoryContactUpdate, _=Depends(admin_only)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields")
    await db.directory.update_one({"id": cid}, {"$set": update})
    return await db.directory.find_one({"id": cid}, {"_id": 0})

@api.delete("/directory/{cid}")
async def delete_contact(cid: str, _=Depends(admin_only)):
    await db.directory.delete_one({"id": cid})
    return {"ok": True}

# ------------------- Resources -------------------
@api.get("/resources")
async def list_resources(user=Depends(get_current_user)):
    items = await db.resources.find({}, {"_id": 0}).sort("sort_order", 1).to_list(500)
    if user.get("role") == "admin":
        return items
    # Therapists see only "therapist" and "all" visibility
    return [r for r in items if r.get("visibility") in ("therapist", "all")]

@api.post("/resources")
async def create_resource(payload: ResourceIn, _=Depends(admin_only)):
    rid = str(uuid.uuid4())
    doc = {"id": rid, **payload.model_dump(), "created_at": now_iso()}
    await db.resources.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/resources/{rid}")
async def update_resource(rid: str, payload: ResourceIn, _=Depends(admin_only)):
    await db.resources.update_one({"id": rid}, {"$set": payload.model_dump()})
    return await db.resources.find_one({"id": rid}, {"_id": 0})

@api.get("/clients/{cid}/billing-progress")
async def client_billing_progress(cid: str, user=Depends(get_current_user)):
    """Returns billing progress: hours-based or weeks-based.
    weeks-based: counts distinct weeks (Sun-Thu) where at least 1 Completed session exists,
                 since cycle_start_date; cycle ends when weeks_completed >= cycle_weeks.
    """
    client = await db.clients.find_one({"id": cid}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Not found")
    sessions = await db.sessions.find({"client_id": cid}, {"_id": 0}).to_list(2000)
    completed = [s for s in sessions if s.get("status") == "Completed"]
    mode = client.get("billing_mode") or "hours"
    if mode == "hours":
        used_h = sum(float(s.get("hours") or 0) for s in completed)
        pkg = float(client.get("package_hours") or 24)
        return {
            "mode": "hours", "used": round(used_h, 1), "package": pkg,
            "remaining": max(0.0, round(pkg - used_h, 1)),
            "percent": min(100, round((used_h / pkg) * 100)) if pkg else 0,
        }
    # weeks-based — 7-day windows from cycle_start_date anchor (same weekday each week)
    cycle_weeks = int(client.get("cycle_weeks") or 4)
    start_iso = client.get("cycle_start_date")
    if not start_iso:
        if completed:
            start_iso = min(s.get("session_date") or "9999" for s in completed)
        else:
            start_iso = datetime.now(timezone.utc).date().isoformat()
    try:
        start_d = datetime.fromisoformat(start_iso).date()
    except Exception:
        start_d = datetime.now(timezone.utc).date()
    weeks_done = 0
    week_breakdown = []
    for k in range(cycle_weeks):
        week_start = start_d + timedelta(days=7 * k)
        week_end = week_start + timedelta(days=7)
        ws_iso = week_start.isoformat()
        we_iso = week_end.isoformat()
        in_week = [s for s in completed if s.get("session_date") and ws_iso <= s.get("session_date") < we_iso]
        has = len(in_week) > 0
        if has:
            weeks_done += 1
        week_breakdown.append({
            "week_number": k + 1,
            "week_start": ws_iso,
            "week_end": we_iso,
            "sessions": len(in_week),
            "completed": has,
        })
    return {
        "mode": "weeks",
        "weeks_completed": weeks_done,
        "cycle_weeks": cycle_weeks,
        "cycle_start_date": start_d.isoformat(),
        "next_cycle_start": (start_d + timedelta(days=7 * cycle_weeks)).isoformat(),
        "remaining_weeks": max(0, cycle_weeks - weeks_done),
        "percent": round((weeks_done / cycle_weeks) * 100) if cycle_weeks else 0,
        "weeks": week_breakdown,
    }

@api.get("/clients/{cid}/sessions/export")
async def export_sessions_excel(cid: str, user=Depends(get_current_user)):
    """Export client's attendance sheet as Excel.
    If the client has invoices, each invoice becomes its own sheet/tab named with
    the invoice number (e.g. INV0451). Sessions in each tab are scoped to that
    invoice's window (>= invoice.start_date and < next invoice.start_date when
    sorted ascending). Otherwise, a single 'Attendance' sheet is produced.
    """
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from io import BytesIO

    client = await db.clients.find_one({"id": cid}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if user.get("role") == "therapist" and user["id"] not in (client.get("co_therapist_ids") or []) + ([client.get("main_therapist_id")] if client.get("main_therapist_id") else []):
        raise HTTPException(status_code=403, detail="Forbidden")

    sessions = await db.sessions.find({"client_id": cid}, {"_id": 0}).sort("session_date", 1).to_list(2000)
    therapists = {t["id"]: t for t in await db.therapists.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)}
    invoices = await db.invoices.find({"client_id": cid}, {"_id": 0}).sort("start_date", 1).to_list(200)

    head_fill = PatternFill("solid", fgColor="7A8A6A")
    head_font = Font(bold=True, color="FFFFFF", size=11)
    sub_fill = PatternFill("solid", fgColor="EFE8D2")
    border = Border(left=Side(style="thin", color="B5B0A0"), right=Side(style="thin", color="B5B0A0"),
                    top=Side(style="thin", color="B5B0A0"), bottom=Side(style="thin", color="B5B0A0"))
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    STATUS_FILLS = {"Completed": "D9EAD3", "Cancelled": "FCE0E8", "No Show": "FFF4C4", "No Service": "ECECEC"}

    def safe_sheet_name(name: str) -> str:
        # Excel limits: 31 chars, no []:*?/\\
        bad = '[]:*?/\\'
        for b in bad:
            name = name.replace(b, "-")
        return name[:31] or "Sheet"

    def write_invoice_sheet(ws, inv: Optional[dict], inv_sessions: list):
        """Write the Boost Growth-style header + session rows on `ws` for the given invoice."""
        pkg = float((inv or {}).get("package_size") or client.get("package_hours") or 24)
        used = sum(float(s.get("hours") or 0) for s in inv_sessions if s.get("status") == "Completed")
        rem = max(0.0, pkg - used)
        no_show = sum(1 for s in inv_sessions if s.get("status") == "No Show")
        no_service = sum(1 for s in inv_sessions if s.get("status") == "No Service")
        completed = sum(1 for s in inv_sessions if s.get("status") == "Completed")
        # Title
        ws.merge_cells("A1:G1")
        inv_label = (inv or {}).get("invoice_number") or "Attendance"
        status_label = "Closed" if (inv or {}).get("is_closed") else "Open"
        ws["A1"] = f"{inv_label} | {status_label}"
        ws["A1"].font = Font(bold=True, size=14, color="2C3625")
        ws["A1"].alignment = center
        ws.row_dimensions[1].height = 26
        # Patient info row 2
        ws["A2"] = "Patient's Name:"; ws["B2"] = client.get("name") or "—"
        ws["C2"] = "File NO.:"; ws["D2"] = client.get("file_no") or "—"
        ws["E2"] = "# Paid SESH.:"; ws["F2"] = f"{pkg}h"
        if (inv or {}).get("service_type"):
            ws["G2"] = (inv or {}).get("service_type")
        for c in "ABCDEFG":
            ws[f"{c}2"].fill = sub_fill
            ws[f"{c}2"].font = Font(bold=True, color="2C3625")
            ws[f"{c}2"].alignment = center
        # Column headers row 4 — matches Drive format
        headers = ["Days", "Date", "Status", "Time", "# of Hrs", "Therapist", "Note"]
        for i, h in enumerate(headers, 1):
            cell = ws.cell(row=4, column=i, value=h)
            cell.fill = head_fill; cell.font = head_font; cell.alignment = center; cell.border = border
        ws.row_dimensions[4].height = 22
        row = 5
        for s in inv_sessions:
            sd = s.get("session_date") or ""
            try:
                dt = datetime.fromisoformat(sd)
                day_label = DAY_NAMES[dt.weekday()]
                date_label = f"{dt.day}/{dt.month}/{dt.year}"
            except Exception:
                day_label = "—"; date_label = sd
            therapist_names = " - ".join(
                ((therapists.get(tid) or {}).get("name", "?") or "?").replace("Ms. ", "")
                for tid in (s.get("therapist_ids") or [])
            )
            time_str = ""
            if s.get("start_time") and s.get("end_time"):
                time_str = f"{s['start_time']}-{s['end_time']}"
            ws.cell(row=row, column=1, value=day_label).alignment = center
            ws.cell(row=row, column=2, value=date_label).alignment = center
            st_cell = ws.cell(row=row, column=3, value=s.get("status") or "—")
            st_cell.alignment = center
            if s.get("status") in STATUS_FILLS:
                st_cell.fill = PatternFill("solid", fgColor=STATUS_FILLS[s["status"]])
            ws.cell(row=row, column=4, value=time_str).alignment = center
            ws.cell(row=row, column=5, value=float(s.get("hours") or 0)).alignment = center
            ws.cell(row=row, column=6, value=therapist_names).alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            ws.cell(row=row, column=7, value=s.get("note") or "").alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
            for col in range(1, 8):
                ws.cell(row=row, column=col).border = border
            row += 1
        # Footer
        foot = row + 1
        ws.cell(row=foot, column=1, value="Total delivered Sessions:").font = Font(bold=True, color="2C3625")
        ws.cell(row=foot, column=2, value=completed)
        ws.cell(row=foot+1, column=1, value="Total NO Service (counted):").font = Font(bold=True, color="2C3625")
        ws.cell(row=foot+1, column=2, value=no_service)
        ws.cell(row=foot+2, column=1, value="Total No-Show:").font = Font(bold=True, color="2C3625")
        ws.cell(row=foot+2, column=2, value=no_show)
        ws.cell(row=foot+3, column=1, value="Total Counted Sessions:").font = Font(bold=True, color="2C3625")
        ws.cell(row=foot+3, column=2, value=completed + no_show)
        ws.cell(row=foot+4, column=1, value="Hours Remaining:").font = Font(bold=True, color="2C3625")
        ws.cell(row=foot+4, column=2, value=round(rem, 2))
        ws.cell(row=foot+5, column=1, value="Payment Status:").font = Font(bold=True, color="2C3625")
        ws.cell(row=foot+5, column=2, value="Paid" if (inv or {}).get("payment_status") == "complete" else "Payment Pending")
        # Column widths
        widths = [8, 12, 14, 14, 10, 24, 32]
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[chr(64 + i)].width = w

    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    if invoices:
        # Build windows: each invoice covers [start_date, next_start) ; last invoice covers until end of time.
        sorted_inv = sorted(invoices, key=lambda i: (i.get("start_date") or "0000-00-00"))
        for idx, inv in enumerate(sorted_inv):
            start = inv.get("start_date") or "0000-00-00"
            end = sorted_inv[idx + 1]["start_date"] if (idx + 1 < len(sorted_inv) and sorted_inv[idx + 1].get("start_date")) else None
            inv_sessions = [s for s in sessions if (s.get("session_date") or "") >= start and (end is None or (s.get("session_date") or "") < end)]
            ws = wb.create_sheet(safe_sheet_name(inv.get("invoice_number") or f"INV-{idx+1}"))
            write_invoice_sheet(ws, inv, inv_sessions)
    else:
        ws = wb.create_sheet("Attendance")
        write_invoice_sheet(ws, None, sessions)

    out = BytesIO()
    wb.save(out)
    out.seek(0)
    from fastapi.responses import Response
    fname = f"attendance_{client.get('file_no') or 'client'}_{client.get('name','').replace(' ','_')}.xlsx"
    return Response(content=out.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename={fname}"})

# ------------------- Email Settings (admin) -------------------
class EmailSettingsIn(BaseModel):
    resend_api_key: Optional[str] = None
    brevo_api_key: Optional[str] = None
    from_email: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_provider: Optional[str] = None  # auto | brevo | resend | smtp

def _apply_email_settings(doc: dict) -> None:
    """Load persisted email settings into process env."""
    if not doc:
        return
    if doc.get("resend_api_key"):
        os.environ["RESEND_API_KEY"] = doc["resend_api_key"]
    if doc.get("brevo_api_key"):
        os.environ["BREVO_API_KEY"] = doc["brevo_api_key"]
    if doc.get("from_email"):
        os.environ["EMAIL_FROM"] = doc["from_email"]
    if doc.get("smtp_host"):
        os.environ["SMTP_HOST"] = doc["smtp_host"]
    if doc.get("smtp_port"):
        os.environ["SMTP_PORT"] = str(doc["smtp_port"])
    if doc.get("smtp_user"):
        os.environ["SMTP_USER"] = doc["smtp_user"]
    if doc.get("smtp_password"):
        os.environ["SMTP_PASSWORD"] = str(doc["smtp_password"]).replace(" ", "")
    if doc.get("email_provider"):
        os.environ["EMAIL_PROVIDER"] = doc["email_provider"]

async def _reload_email_settings_from_db() -> None:
    doc = await db.settings.find_one({"key": "email"}, {"_id": 0})
    _apply_email_settings(doc or {})

def _parse_from_address() -> tuple:
    raw = _email_from_address()
    if "<" in raw and ">" in raw:
        name = raw.split("<")[0].strip().strip('"').strip() or "Boost Growth"
        email = raw.split("<")[-1].split(">")[0].strip()
        return name, email
    return "Boost Growth", raw.strip()

def _smtp_error_hint(err: str) -> str:
    e = (err or "").lower()
    if "101" in e or "network is unreachable" in e or "network unreachable" in e:
        return "Gmail SMTP محجوب على Railway (مو خطأ منك). استخدمي Brevo — الخيار الأخضر فوق (بدون DNS)."
    if "535" in e or "username and password not accepted" in e:
        return "Gmail رفض الدخول: تأكدي من App Password (16 حرف بدون مسافات)."
    if "534" in e:
        return "Google Workspace قد يكون موقف SMTP — تواصلي مع مدير حساب Google للمنشأة."
    if "550" in e or "relay" in e:
        return "Gmail ما يسمح بالإرسال من هذا العنوان — خلي From Email نفس SMTP User."
    if "connection" in e or "timed out" in e:
        return "تعذر الاتصال بـ SMTP — على Railway استخدمي Brevo بدلاً من Gmail."
    return ""

def _email_from_address() -> str:
    return os.environ.get("EMAIL_FROM") or "Boost Growth <hr@boostgrowthsa.com>"

def _smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"))

def _resend_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY"))

def _brevo_configured() -> bool:
    return bool(os.environ.get("BREVO_API_KEY"))

async def _send_via_brevo(to: str, subject: str, body: str) -> str:
    api_key = os.environ.get("BREVO_API_KEY")
    if not api_key:
        raise ValueError("Brevo API key not configured")
    name, email = _parse_from_address()
    import httpx
    async with httpx.AsyncClient(timeout=30) as cli:
        r = await cli.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": api_key, "Content-Type": "application/json", "accept": "application/json"},
            json={
                "sender": {"name": name, "email": email},
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": f"<p>{body.replace(chr(10), '<br/>')}</p>",
                "textContent": body,
            },
        )
        if r.status_code in (200, 201, 202):
            return r.json().get("messageId") or "ok"
        raise ValueError(r.text[:500])

async def _send_via_resend(to: str, subject: str, body: str) -> str:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise ValueError("Resend API key not configured")
    import httpx
    async with httpx.AsyncClient(timeout=30) as cli:
        r = await cli.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": _email_from_address(), "to": [to], "subject": subject,
                  "html": f"<p>{body.replace(chr(10), '<br/>')}</p>"},
        )
        if r.status_code in (200, 202):
            return r.json().get("id") or "ok"
        raise ValueError(r.text[:500])

def _send_via_smtp_sync(to: str, subject: str, body: str) -> None:
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    host = os.environ.get("SMTP_HOST") or "smtp.gmail.com"
    port = int(os.environ.get("SMTP_PORT") or "587")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    if not user or not password:
        raise ValueError("SMTP user/password not configured")
    password = str(password).replace(" ", "")
    from_addr = _email_from_address()
    # Gmail requires authenticated address to match sender
    if "<" in from_addr and ">" in from_addr:
        display_from = from_addr
        envelope_from = from_addr.split("<")[-1].split(">")[0].strip()
    else:
        display_from = user
        envelope_from = user
    if envelope_from.lower() != user.lower():
        display_from = user
        envelope_from = user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = display_from
    msg["To"] = to
    msg.attach(MIMEText(body, "plain", "utf-8"))
    msg.attach(MIMEText(f"<p>{body.replace(chr(10), '<br/>')}</p>", "html", "utf-8"))
    with smtplib.SMTP(host, port, timeout=30) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(user, password)
        server.sendmail(envelope_from, [to], msg.as_string())

@api.post("/admin/email-test-send")
async def email_test_send(payload: dict, _=Depends(admin_only)):
    """Test send to a target email. Returns clear error if provider rejects."""
    await _reload_email_settings_from_db()
    to = (payload.get("to") or "").strip()
    if not to:
        raise HTTPException(status_code=400, detail="Recipient email required")
    if not _smtp_configured() and not _resend_configured() and not _brevo_configured():
        raise HTTPException(status_code=400, detail="No email provider configured. Save Brevo or Resend API key first.")
    result = await _send_email_stub(to,
        "Boost Growth — Test Email",
        "This is a test email from your Boost Growth Portal.\n\nIf you received this, email notifications are working correctly.\n\n— Boost Growth Portal")
    if result.get("status") == "failed" and result.get("error"):
        hint = _smtp_error_hint(result["error"])
        if hint:
            result["hint_ar"] = hint
    return result

@api.get("/admin/email-settings")
async def get_email_settings(_=Depends(admin_only)):
    doc = await db.settings.find_one({"key": "email"}, {"_id": 0}) or {}
    has_resend = bool(doc.get("resend_api_key") or os.environ.get("RESEND_API_KEY"))
    has_brevo = bool(doc.get("brevo_api_key") or os.environ.get("BREVO_API_KEY"))
    has_smtp = bool(doc.get("smtp_user") and doc.get("smtp_password"))
    provider = doc.get("email_provider") or os.environ.get("EMAIL_PROVIDER") or "auto"
    active = "none"
    if provider == "brevo" and has_brevo:
        active = "brevo"
    elif provider == "smtp" and has_smtp:
        active = "smtp"
    elif provider == "resend" and has_resend:
        active = "resend"
    elif has_brevo:
        active = "brevo"
    elif has_resend:
        active = "resend"
    elif has_smtp:
        active = "smtp"
    return {
        "configured": has_smtp or has_resend or has_brevo,
        "provider": provider,
        "active_provider": active,
        "smtp_configured": has_smtp,
        "resend_configured": has_resend,
        "brevo_configured": has_brevo,
        "from_email": doc.get("from_email") or os.environ.get("EMAIL_FROM") or "Boost Growth <admin@boostgrowthsa.com>",
        "smtp_host": doc.get("smtp_host") or os.environ.get("SMTP_HOST") or "smtp.gmail.com",
        "smtp_port": doc.get("smtp_port") or int(os.environ.get("SMTP_PORT") or "587"),
        "smtp_user": doc.get("smtp_user") or os.environ.get("SMTP_USER") or "",
        "key_preview": (doc.get("resend_api_key") or "")[:8] + "..." if doc.get("resend_api_key") else None,
        "brevo_key_preview": (doc.get("brevo_api_key") or "")[:12] + "..." if doc.get("brevo_api_key") else None,
    }

@api.post("/admin/email-settings")
async def save_email_settings(payload: EmailSettingsIn, _=Depends(admin_only)):
    update = {}
    if payload.resend_api_key and payload.resend_api_key.strip():
        key = payload.resend_api_key.strip()
        if not key.startswith("re_") or len(key) < 30:
            raise HTTPException(status_code=400,
                detail=f"Invalid Resend API key. Keys start with 're_' and are 30+ chars. You provided {len(key)} chars.")
        update["resend_api_key"] = key
    if payload.brevo_api_key and payload.brevo_api_key.strip():
        key = payload.brevo_api_key.strip()
        if key.startswith("xsmtpsib-"):
            raise HTTPException(status_code=400,
                detail="This is a Brevo SMTP key (xsmtpsib-). Use an API key (xkeysib-) from SMTP & API → API Keys.")
        if len(key) < 20:
            raise HTTPException(status_code=400, detail="Invalid Brevo API key (too short).")
        update["brevo_api_key"] = key
    if payload.from_email and payload.from_email.strip():
        update["from_email"] = payload.from_email.strip()
    if payload.smtp_host and payload.smtp_host.strip():
        update["smtp_host"] = payload.smtp_host.strip()
    if payload.smtp_port:
        update["smtp_port"] = int(payload.smtp_port)
    if payload.smtp_user is not None:
        update["smtp_user"] = payload.smtp_user.strip()
    if payload.smtp_password and payload.smtp_password.strip():
        update["smtp_password"] = payload.smtp_password.strip().replace(" ", "")
    if payload.email_provider and payload.email_provider.strip() in ("auto", "brevo", "smtp", "resend"):
        update["email_provider"] = payload.email_provider.strip()
    if not update:
        raise HTTPException(status_code=400, detail="No fields")
    update["updated_at"] = now_iso()
    await db.settings.update_one({"key": "email"}, {"$set": update, "$setOnInsert": {"key": "email"}}, upsert=True)
    doc = await db.settings.find_one({"key": "email"}, {"_id": 0}) or {}
    _apply_email_settings(doc)
    return {"ok": True, "configured": True}

@api.get("/admin/email-queue")
async def list_email_queue(_=Depends(admin_only)):
    return await db.email_queue.find({}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)

@api.delete("/resources/{rid}")
async def delete_resource(rid: str, _=Depends(admin_only)):
    await db.resources.delete_one({"id": rid})
    return {"ok": True}

# ------------------- Leaves / Vacations -------------------
DEFAULT_ANNUAL_BALANCE = 30  # baseline annual leave per year

LEAVE_DOC_TYPES = {"medical", "appointment", "other"}


def _leave_default_fields() -> dict:
    return {
        "document_url": None,
        "document_file_path": None,
        "document_file_name": None,
        "document_type": None,
        "document_verified": False,
        "schedule_impact": [],
    }


def _schedule_day_index(dt: datetime) -> int:
    """0=Sun … 6=Sat (matches frontend Schedule)."""
    return (dt.weekday() + 1) % 7


def _week_start_sunday(iso: str) -> str:
    d = datetime.fromisoformat(str(iso)[:10])
    sun = d - timedelta(days=_schedule_day_index(d))
    return sun.strftime("%Y-%m-%d")


def _iter_dates_in_range(start_iso: str, end_iso: str):
    start = datetime.fromisoformat(str(start_iso)[:10])
    end = datetime.fromisoformat(str(end_iso)[:10])
    d = start
    while d <= end:
        yield d.strftime("%Y-%m-%d"), d
        d += timedelta(days=1)


async def _cancel_schedule_for_therapist(therapist_id: str, start_date: str, end_date: str) -> list:
    """Mark matching schedule cells as cancel_therapist; return impact list."""
    impacted = []
    seen_ids = set()
    for date_iso, d in _iter_dates_in_range(start_date, end_date):
        week_start = _week_start_sunday(date_iso)
        day_idx = _schedule_day_index(d)
        cells = await db.schedule_cells.find(
            {
                "therapist_id": therapist_id,
                "week_start": week_start,
                "day": day_idx,
                "service_code": {"$nin": ["LEAVE", "BREAK", ""]},
            },
            {"_id": 0},
        ).to_list(50)
        for cell in cells:
            if not (cell.get("child_name") or "").strip():
                continue
            cid = cell.get("id")
            if cid in seen_ids:
                continue
            seen_ids.add(cid)
            if cell.get("state") != "cancel_therapist":
                await db.schedule_cells.update_one({"id": cid}, {"$set": {"state": "cancel_therapist"}})
            impacted.append({
                "session_id": cid,
                "date": date_iso,
                "client_name": (cell.get("child_name") or "—").strip(),
                "time_slot": cell.get("time_slot"),
            })
    return impacted


def _enrich_leave_document_url(leave: dict) -> dict:
    if leave.get("document_file_path"):
        leave["document_url"] = f"/api/leaves/{leave['id']}/document"
    else:
        leave.setdefault("document_url", None)
    leave.setdefault("document_verified", False)
    leave.setdefault("schedule_impact", leave.get("schedule_impact") or [])
    return leave

@api.get("/leaves")
async def list_leaves(year: Optional[int] = None, user=Depends(get_current_user)):
    q: dict = {}
    if year:
        q["start_date"] = {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}
    if user.get("role") != "admin":
        q["therapist_id"] = user["id"]
    items = await db.leaves.find(q, {"_id": 0}).sort("start_date", -1).to_list(2000)
    therapists = await db.therapists.find({}, {"_id": 0, "id": 1, "name": 1, "email": 1, "color": 1}).to_list(100)
    t_by_id = {t["id"]: t for t in therapists}
    for it in items:
        t = t_by_id.get(it.get("therapist_id"))
        if t:
            it["therapist_name"] = t.get("name")
            it["therapist_color"] = t.get("color")
            if user.get("role") == "admin":
                it["therapist_email"] = t.get("email")
    return [_enrich_leave_document_url(it) for it in items]

@api.get("/leaves/balance")
async def leaves_balance(year: Optional[int] = None, user=Depends(get_current_user)):
    """Return per-therapist annual balance: {therapist_id, name, allocated, used (Annual+approved/done), remaining, breakdown}.
    For therapist role: only their own.
    """
    yr = year or datetime.now(timezone.utc).year
    therapists = await db.therapists.find({}, {"_id": 0, "id": 1, "name": 1, "color": 1, "email": 1, "annual_balance": 1, "leave_balance": 1, "join_date": 1}).to_list(100)
    if user.get("role") != "admin":
        therapists = [t for t in therapists if t["id"] == user["id"]]
    leaves = await db.leaves.find({"start_date": {"$gte": f"{yr}-01-01", "$lte": f"{yr}-12-31"}}, {"_id": 0}).to_list(2000)
    out = []
    for t in therapists:
        own = [l for l in leaves if l.get("therapist_id") == t["id"]]
        used_annual = sum(float(l.get("days") or 0) for l in own if l.get("leave_type") == "Annual" and l.get("status") in ("approved", "done"))
        used_unpaid = sum(float(l.get("days") or 0) for l in own if l.get("leave_type") == "Unpaid" and l.get("status") in ("approved", "done"))
        used_sick = sum(float(l.get("days") or 0) for l in own if l.get("leave_type") == "Sickleave" and l.get("status") in ("approved", "done"))
        pending = sum(float(l.get("days") or 0) for l in own if l.get("status") == "pending")
        allocated = float(t.get("leave_balance") if t.get("leave_balance") is not None else (t.get("annual_balance") or DEFAULT_ANNUAL_BALANCE))
        remaining = max(0.0, allocated - used_annual)
        out.append({
            "therapist_id": t["id"], "name": t["name"], "color": t.get("color"), "email": t.get("email"),
            "join_date": t.get("join_date"),
            "year": yr, "allocated": allocated,
            "used_annual": round(used_annual, 1),
            "used_unpaid": round(used_unpaid, 1),
            "used_sick": round(used_sick, 1),
            "pending": round(pending, 1),
            "remaining": round(remaining, 1),
            "leaves_count": len(own),
        })
    return out

@api.post("/leaves")
async def create_leave(payload: LeaveIn, user=Depends(get_current_user)):
    if user.get("role") != "admin" and payload.therapist_id != user["id"]:
        raise HTTPException(status_code=403, detail="Therapist can only create own leaves")
    lid = str(uuid.uuid4())
    doc = {"id": lid, **payload.model_dump(), **_leave_default_fields(), "created_by": user["id"], "created_at": now_iso()}
    if user.get("role") != "admin":
        doc["status"] = "pending"  # therapist requests start as pending
    await db.leaves.insert_one(doc)
    doc.pop("_id", None)
    # Notify admins if therapist submitted
    if user.get("role") != "admin":
        await _notify_admins("leave_request", "New leave request",
                             f"{user.get('name')}: {payload.leave_type} {payload.days}d ({payload.start_date} → {payload.end_date})")
    return doc

@api.put("/leaves/{lid}")
async def update_leave(lid: str, payload: LeaveIn, user=Depends(get_current_user)):
    leave = await db.leaves.find_one({"id": lid})
    if not leave:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and leave.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    update = payload.model_dump()
    await db.leaves.update_one({"id": lid}, {"$set": update})
    return await db.leaves.find_one({"id": lid}, {"_id": 0})

@api.put("/leaves/{lid}/status")
async def update_leave_status(lid: str, payload: LeaveStatusUpdate, admin=Depends(admin_only)):
    leave = await db.leaves.find_one({"id": lid})
    if not leave:
        raise HTTPException(status_code=404, detail="Not found")
    prev_status = leave.get("status")
    await db.leaves.update_one({"id": lid}, {"$set": {
        "status": payload.status, "admin_note": payload.admin_note,
        "decided_by": admin.get("name") or "Admin", "decided_at": now_iso(),
    }})
    # Deduct balance when newly approved (annual leave types only)
    if payload.status == "approved" and prev_status != "approved" and leave.get("therapist_id"):
        if (leave.get("leave_type") or "").lower() not in ("unpaid", "absence"):
            t = await db.therapists.find_one({"id": leave["therapist_id"]}, {"_id": 0, "leave_balance": 1})
            if t is not None and t.get("leave_balance") is not None:
                days = float(leave.get("days") or 0)
                new_bal = max(0.0, float(t["leave_balance"]) - days)
                await db.therapists.update_one(
                    {"id": leave["therapist_id"]},
                    {"$set": {"leave_balance": new_bal}},
                )
    # Notify therapist (in-app + email)
    if leave.get("therapist_id"):
        msg_map = {"approved": "Approved", "rejected": "Rejected", "done": "Completed", "cancelled": "Cancelled", "pending": "Pending"}
        label = msg_map.get(payload.status, payload.status)
        msg = (
            f"Your {leave.get('leave_type')} leave from {leave.get('start_date')} to "
            f"{leave.get('end_date')} ({leave.get('days')}d) is now {label}."
        )
        await _notify(leave["therapist_id"], "leave", f"Leave {label}", msg)
        if payload.status in ("approved", "rejected"):
            therapist = await db.therapists.find_one({"id": leave["therapist_id"]}, {"_id": 0, "email": 1, "name": 1})
            if therapist and therapist.get("email"):
                await _send_email_stub(
                    therapist["email"],
                    f"[Boost Growth] Leave Request {label}",
                    f"Dear {therapist.get('name', '')},\n\nYour leave request from {leave.get('start_date')} to "
                    f"{leave.get('end_date')} has been {label.lower()}.\n\n— Boost Growth Portal",
                )
    return await db.leaves.find_one({"id": lid}, {"_id": 0})

@api.delete("/leaves/{lid}")
async def delete_leave(lid: str, user=Depends(get_current_user)):
    leave = await db.leaves.find_one({"id": lid})
    if not leave:
        return {"ok": True}
    if user.get("role") != "admin" and leave.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.leaves.delete_one({"id": lid})
    return {"ok": True}


@api.post("/leaves/mark-absence")
async def mark_absence_without_request(payload: MarkAbsenceIn, admin=Depends(admin_only)):
    """Admin: record absence/permission and optionally cancel schedule sessions."""
    t = await db.therapists.find_one({"id": payload.therapist_id}, {"_id": 0, "id": 1, "name": 1})
    if not t:
        raise HTTPException(status_code=404, detail="Therapist not found")
    days = max(1, (datetime.fromisoformat(payload.date_to[:10]) - datetime.fromisoformat(payload.date_from[:10])).days + 1)
    lid = str(uuid.uuid4())
    doc = {
        "id": lid,
        "therapist_id": payload.therapist_id,
        "start_date": payload.date_from[:10],
        "end_date": payload.date_to[:10],
        "days": float(days),
        "leave_type": payload.leave_type or "Absence",
        "status": "absent",
        "notes": payload.notes,
        "admin_note": "Marked absent by admin",
        **_leave_default_fields(),
        "created_by": admin["id"],
        "created_at": now_iso(),
        "decided_by": admin.get("name") or "Admin",
        "decided_at": now_iso(),
    }
    impact = []
    if payload.cancel_sessions:
        impact = await _cancel_schedule_for_therapist(payload.therapist_id, doc["start_date"], doc["end_date"])
        doc["schedule_impact"] = impact
    await db.leaves.insert_one(doc)
    doc.pop("_id", None)
    return {
        "leave": _enrich_leave_document_url(doc),
        "cancelled_sessions_count": len(impact),
        "sessions": impact,
        "message": f"Done. {len(impact)} session(s) cancelled for {t.get('name')}",
    }


@api.post("/leaves/{lid}/mark-absent")
async def mark_leave_absent(lid: str, payload: MarkAbsentIn, admin=Depends(admin_only)):
    leave = await db.leaves.find_one({"id": lid}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    impact = list(leave.get("schedule_impact") or [])
    if payload.cancel_sessions and leave.get("therapist_id"):
        new_impact = await _cancel_schedule_for_therapist(
            leave["therapist_id"], leave["start_date"], leave["end_date"]
        )
        existing_ids = {x.get("session_id") for x in impact}
        for row in new_impact:
            if row.get("session_id") not in existing_ids:
                impact.append(row)
    await db.leaves.update_one({"id": lid}, {"$set": {
        "status": "absent",
        "schedule_impact": impact,
        "decided_by": admin.get("name") or "Admin",
        "decided_at": now_iso(),
    }})
    updated = await db.leaves.find_one({"id": lid}, {"_id": 0})
    tname = leave.get("therapist_name") or "Therapist"
    therapists = await db.therapists.find_one({"id": leave.get("therapist_id")}, {"name": 1})
    if therapists:
        tname = therapists.get("name") or tname
    return {
        "leave": _enrich_leave_document_url(updated),
        "cancelled_sessions_count": len(impact),
        "sessions": impact,
        "message": f"Done. {len(impact)} session(s) cancelled on {leave.get('start_date')} → {leave.get('end_date')} for {tname}",
    }


@api.post("/leaves/{lid}/upload-document")
async def upload_leave_document(
    lid: str,
    file: UploadFile = File(...),
    document_type: Optional[str] = Form("other"),
    user=Depends(get_current_user),
):
    leave = await db.leaves.find_one({"id": lid}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if user.get("role") != "admin" and leave.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="File required")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    ext = Path(file.filename).suffix.lower() or ".pdf"
    if ext not in (".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"):
        raise HTTPException(status_code=400, detail="PDF or image only")
    stored = f"leave_{lid}{ext}"
    save_path = UPLOAD_DIR / stored
    if leave.get("document_file_path"):
        old = UPLOAD_DIR / leave["document_file_path"]
        if old.exists() and old.name != stored:
            old.unlink()
    save_path.write_bytes(content)
    dtype = (document_type or "other").lower()
    if dtype not in LEAVE_DOC_TYPES:
        dtype = "other"
    await db.leaves.update_one({"id": lid}, {"$set": {
        "document_file_path": stored,
        "document_file_name": file.filename,
        "document_type": dtype,
        "document_verified": False,
        "document_uploaded_at": now_iso(),
    }})
    updated = await db.leaves.find_one({"id": lid}, {"_id": 0})
    return _enrich_leave_document_url(updated)


@api.get("/leaves/{lid}/document")
async def download_leave_document(lid: str, user=Depends(get_current_user)):
    leave = await db.leaves.find_one({"id": lid}, {"_id": 0})
    if not leave or not leave.get("document_file_path"):
        raise HTTPException(status_code=404, detail="No document")
    if user.get("role") != "admin" and leave.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    fp = UPLOAD_DIR / leave["document_file_path"]
    if not fp.exists():
        raise HTTPException(status_code=404, detail="File missing")
    return FileResponse(str(fp), filename=leave.get("document_file_name") or leave["document_file_path"])


@api.delete("/leaves/{lid}/document")
async def delete_leave_document(lid: str, user=Depends(get_current_user)):
    leave = await db.leaves.find_one({"id": lid}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if user.get("role") != "admin" and leave.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    if leave.get("document_file_path"):
        fp = UPLOAD_DIR / leave["document_file_path"]
        if fp.exists():
            fp.unlink()
    await db.leaves.update_one({"id": lid}, {"$set": {
        "document_file_path": None,
        "document_file_name": None,
        "document_type": None,
        "document_verified": False,
        "document_uploaded_at": None,
    }})
    return {"ok": True}


@api.put("/leaves/{lid}/verify-document")
async def verify_leave_document(lid: str, payload: LeaveDocumentVerifyIn, _=Depends(admin_only)):
    leave = await db.leaves.find_one({"id": lid}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    await db.leaves.update_one({"id": lid}, {"$set": {"document_verified": bool(payload.verified)}})
    updated = await db.leaves.find_one({"id": lid}, {"_id": 0})
    return _enrich_leave_document_url(updated)


@api.post("/admin/clear-leaves")
async def admin_clear_all_leaves(_=Depends(admin_only)):
    """Delete ALL leave records (test data cleanup)."""
    result = await db.leaves.delete_many({})
    return {"deleted": result.deleted_count, "message": f"Deleted {result.deleted_count} leave records"}


PROGRESS_REPORT_DRIVE_URLS = {
    "009": "https://docs.google.com/document/d/14c29YPvhWaZirB5Qc-_47qP7Q_04-IOZEhpWk76WiU0/edit",
    "024": "https://docs.google.com/document/d/1DS4n4WvIB2_lS-XaZD3gSYg8WcDa5k_RYLwAIOsX7Ig/edit",
    "038": "https://docs.google.com/document/d/1-cxoewBVcbyVXa-XuBziY4OFAD2bfSpYL2_SRK4p2Ik/edit",
    "040": "https://docs.google.com/document/d/1uPUgFPz944AqlHXFXT3oVOpar6JETzsQQ3a6rd3XTK8/edit",
    "042": "https://docs.google.com/document/d/14tyu4xNlG4AmzALpjYwuWwKflwqk_buX-i2rsovxKRY/edit",
    "047": "https://drive.google.com/file/d/1eD8w2NQ5WCRtZrODhX33RHQYGT2jbHvM/view",
    "063": "https://drive.google.com/file/d/1av1C994LOEuMY2ChsEl0t8QaS5fO3s7m/view",
    "070": "https://drive.google.com/file/d/1tI5z5vrDDVaApSOAsp4HbkcawcDe42ll/view",
    "072": "https://docs.google.com/document/d/19UY48orOHqV-ItptNFVxUgRyLgWeWgi8gIy--SmbMHA/edit",
    "034": "https://drive.google.com/file/d/1DRU9zPhF0fmS7RIOQFJ3FDaH7H7gkfTN/view",
}


@api.post("/admin/migrate-progress-report-urls")
async def admin_migrate_progress_report_urls(_=Depends(admin_only)):
    """One-time: set Drive URLs on existing Apr 2026 progress reports by client file_no."""
    updated = 0
    missing = []
    for file_no, url in PROGRESS_REPORT_DRIVE_URLS.items():
        client = await _find_client_by_file_no(file_no)
        if not client:
            missing.append(file_no)
            continue
        r = await db.progress_reports.update_many(
            {"client_id": client["id"], "title": {"$regex": "Apr 2026", "$options": "i"}},
            {"$set": {"url": url, "updated_at": now_iso()}},
        )
        updated += r.modified_count
    return {"updated": updated, "missing_clients": missing, "message": f"Updated {updated} progress report URLs"}


@api.post("/admin/repair-session-invoices")
async def admin_repair_session_invoices(_=Depends(admin_only)):
    """Backfill invoice_id on sessions; fix HS service_type for HS-only clients."""
    invoices = await db.invoices.find({}, {"_id": 0, "id": 1, "client_id": 1, "invoice_number": 1}).to_list(5000)
    inv_by_num = {}
    for inv in invoices:
        num = (inv.get("invoice_number") or "").strip()
        if num:
            inv_by_num[f"{inv['client_id']}|{num}"] = inv["id"]
    sessions = await db.sessions.find({}, {"_id": 0, "id": 1, "client_id": 1, "invoice_id": 1, "source_invoice": 1, "service_type": 1}).to_list(20000)
    linked = typed = 0
    clients = {c["id"]: c for c in await db.clients.find({}, {"_id": 0, "id": 1, "service_type": 1}).to_list(500)}
    for s in sessions:
        patch = {}
        if not s.get("invoice_id") and s.get("source_invoice"):
            key = f"{s['client_id']}|{(s.get('source_invoice') or '').strip()}"
            if key in inv_by_num:
                patch["invoice_id"] = inv_by_num[key]
                linked += 1
        client = clients.get(s.get("client_id"))
        if client and _normalize_service_type(client.get("service_type")) == "HS":
            if _normalize_service_type(s.get("service_type")) != "HS":
                patch["service_type"] = "HS"
                patch["week_number"] = None
                typed += 1
        if patch:
            await db.sessions.update_one({"id": s["id"]}, {"$set": patch})
    return {"invoice_ids_linked": linked, "service_types_fixed": typed}


# ------------------- Cancel-Notify (in-app + queued email) -------------------
async def _send_email_stub(to: str, subject: str, body: str) -> dict:
    """Send email via Brevo/Resend (HTTPS) or SMTP. Logs all attempts to email_queue."""
    await _reload_email_settings_from_db()
    provider_pref = os.environ.get("EMAIL_PROVIDER", "auto")

    def pick_provider():
        if provider_pref == "brevo":
            return "brevo" if _brevo_configured() else None
        if provider_pref == "resend":
            return "resend" if _resend_configured() else None
        if provider_pref == "smtp":
            return "smtp" if _smtp_configured() else None
        # auto — HTTPS first (works on Railway); SMTP last
        if _brevo_configured():
            return "brevo"
        if _resend_configured():
            return "resend"
        if _smtp_configured():
            return "smtp"
        return None

    chosen = pick_provider()
    queue_doc = {
        "id": str(uuid.uuid4()),
        "to": to, "subject": subject, "body": body,
        "status": "queued", "provider": chosen or "none",
        "created_at": now_iso(),
    }

    if not chosen:
        queue_doc["status"] = "queued_no_key"
        queue_doc["error"] = "No email provider configured. Add Brevo API key in Admin."
        logger.info(f"Email queued (no provider): to={to} subject={subject}")
        await db.email_queue.insert_one(queue_doc)
        queue_doc.pop("_id", None)
        return queue_doc

    try:
        if chosen == "brevo":
            pid = await _send_via_brevo(to, subject, body)
            queue_doc["status"] = "sent"
            queue_doc["provider_id"] = pid
        elif chosen == "resend":
            pid = await _send_via_resend(to, subject, body)
            queue_doc["status"] = "sent"
            queue_doc["provider_id"] = pid
        else:
            await asyncio.to_thread(_send_via_smtp_sync, to, subject, body)
            queue_doc["status"] = "sent"
    except Exception as e:
        queue_doc["status"] = "failed"
        queue_doc["error"] = str(e)[:500]
        hint = _smtp_error_hint(str(e))
        if hint:
            queue_doc["hint_ar"] = hint
        elif "sender" in str(e).lower() or "not verified" in str(e).lower():
            queue_doc["hint_ar"] = "فعّلي إيميل المرسل في Brevo: Senders → admin@boostgrowthsa.com → Verify (رابط في الإيميل)."
        elif "unrecognised ip" in str(e).lower() or "unauthorized" in str(e).lower() or "authorised_ips" in str(e).lower():
            queue_doc["hint_ar"] = "Brevo حجب IP السيرفر. افتحي app.brevo.com/security/authorised_ips → Authorize 152.55.177.26 أو Deactivate blocking للـ API."
        logger.warning(f"Email send failed ({chosen}) to {to}: {e}")

    await db.email_queue.insert_one(queue_doc)
    queue_doc.pop("_id", None)
    return queue_doc

@api.post("/schedule/cancel-notify")
async def schedule_cancel_notify(payload: CancelNotifyIn, _=Depends(admin_only)):
    """Mark cell as cancelled (optional) + send in-app/email notifications to selected therapists."""
    cell = await db.schedule_cells.find_one({"id": payload.cell_id}, {"_id": 0})
    if not cell:
        raise HTTPException(status_code=404, detail="Schedule cell not found")
    if payload.state:
        await db.schedule_cells.update_one({"id": payload.cell_id}, {"$set": {"state": payload.state}})
    recipients = payload.recipient_ids or ([cell["therapist_id"]] if cell.get("therapist_id") else [])
    title = "Notice from Admin"
    if payload.state == "cancel_therapist":
        title = "Session Cancelled"
    elif payload.state == "cancel_child":
        title = "Session Cancelled (Client)"
    sent = []
    for rid in recipients:
        if payload.send_in_app:
            n = await _notify(
                rid, "schedule_cancel", title, payload.message,
                schedule_cell_id=payload.cell_id, requires_ack=True,
            )
            sent.append({"user_id": rid, "notification_id": n["id"]})
        therapist = await db.therapists.find_one({"id": rid}, {"_id": 0})
        send_mail = payload.send_email or payload.state in ("cancel_therapist", "cancel_child")
        if send_mail:
            recipient = payload.extra_email if len(recipients) == 1 and payload.extra_email else (therapist.get("email") if therapist else None)
            if recipient:
                client_name = (cell.get("child_name") or "—").strip()
                week_start = cell.get("week_start") or ""
                day_idx = cell.get("day")
                day_label = ""
                if week_start and day_idx is not None:
                    try:
                        d = datetime.fromisoformat(str(week_start)[:10]) + timedelta(days=int(day_idx))
                        day_label = d.strftime("%d %b %Y")
                    except Exception:
                        day_label = str(week_start)
                if payload.state == "cancel_therapist":
                    subj = f"Session Cancelled — {client_name} on {day_label or week_start}"
                    body = (
                        f"Dear {therapist.get('name', '')},\n\n"
                        f"The session with {client_name} scheduled on {day_label or week_start} "
                        f"at {cell.get('time_slot') or '—'} has been cancelled.\n\n"
                        f"{payload.message}\n\n— Boost Growth Portal"
                    )
                else:
                    subj = f"[Boost Growth] {title}"
                    body_lines = [
                        f"Hello {therapist.get('name') if therapist else ''},",
                        "",
                        payload.message,
                        "",
                        f"Cell: {cell.get('service_code')} | {client_name}",
                        f"Day: {day_label or cell.get('day')} | Time: {cell.get('time_slot')}",
                        "",
                        "— Boost Growth Portal",
                    ]
                    body = "\n".join(body_lines)
                await _send_email_stub(recipient, subj, body)
    return {"ok": True, "sent": sent}

# ------------------- Intake (admin only) -------------------
@api.get("/intake")
async def list_intake(_=Depends(admin_only)):
    return await db.intake.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/intake")
async def create_intake(payload: IntakeIn, _=Depends(admin_only)):
    iid = str(uuid.uuid4())
    doc = {"id": iid, **payload.model_dump(), "created_at": now_iso()}
    await db.intake.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/intake/{iid}")
async def update_intake(iid: str, payload: IntakeIn, _=Depends(admin_only)):
    await db.intake.update_one({"id": iid}, {"$set": payload.model_dump()})
    return await db.intake.find_one({"id": iid}, {"_id": 0})

@api.delete("/intake/{iid}")
async def delete_intake(iid: str, _=Depends(admin_only)):
    await db.intake.delete_one({"id": iid})
    return {"ok": True}

@api.post("/admin/seed-intake-master")
async def seed_intake_master(_=Depends(admin_only)):
    """Upsert INTAKE_SEED records by child_name + intake_type. Does not delete existing rows."""
    created, updated = 0, 0
    for item in INTAKE_SEED:
        name = item.get("child_name", "").strip()
        itype = item.get("intake_type", "pre")
        if not name:
            continue
        match = await db.intake.find_one(
            {"child_name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}, "intake_type": itype},
            {"_id": 0, "id": 1},
        )
        doc = {**item, "child_name": name, "intake_type": itype}
        if match:
            await db.intake.update_one({"id": match["id"]}, {"$set": doc})
            updated += 1
        else:
            await db.intake.insert_one({
                "id": str(uuid.uuid4()),
                "status": item.get("status") or "new",
                "priority": bool(item.get("priority")),
                "created_at": now_iso(),
                **doc,
            })
            created += 1
    return {"created": created, "updated": updated, "total_seed": len(INTAKE_SEED)}

# ------------------- Reports -------------------
@api.get("/reports/dashboard")
async def reports_dashboard(_=Depends(admin_only)):
    sessions = await db.sessions.find({}, {"_id": 0}).to_list(5000)
    clients = await db.clients.find({}, {"_id": 0}).to_list(500)
    therapists = await db.therapists.find({}, {"_id": 0, "pin_hash": 0, "password_hash": 0}).to_list(50)
    requests = await db.requests.find({}, {"_id": 0}).to_list(500)
    cells = await db.schedule_cells.find({}, {"_id": 0}).to_list(5000)

    # Sessions per therapist
    per_t: dict = {}
    for t in therapists:
        per_t[t["id"]] = {"name": t["name"], "color": t.get("color"),
                           "completed": 0, "cancelled": 0, "no_show": 0, "no_service": 0,
                           "hours": 0.0}
    for s in sessions:
        for tid in s.get("therapist_ids") or []:
            if tid in per_t:
                if s["status"] == "Completed":
                    per_t[tid]["completed"] += 1
                    per_t[tid]["hours"] += float(s.get("hours") or 0)
                elif s["status"] == "Cancelled":
                    per_t[tid]["cancelled"] += 1
                elif s["status"] == "No Show":
                    per_t[tid]["no_show"] += 1
                else:
                    per_t[tid]["no_service"] += 1

    # Per-client used hours + status
    per_c = []
    for c in clients:
        used = sum(float(s.get("hours") or 0) for s in sessions if s.get("client_id") == c["id"] and s.get("status") == "Completed")
        pkg = c.get("package_hours") or 24
        rem = max(0, pkg - used)
        if rem <= 0 or rem <= 2 or rem / pkg <= 0.2:
            status = "urgent"
        elif rem / pkg <= 0.35 or rem <= 4:
            status = "warning"
        else:
            status = "ok"
        per_c.append({"id": c["id"], "name": c["name"], "file_no": c.get("file_no"),
                      "color": c.get("color"), "pkg": pkg, "used": round(used, 1),
                      "rem": round(rem, 1), "status": status})

    # Cancellation breakdown from schedule cells (this week)
    sched_cancel_t = sum(1 for c in cells if c.get("state") == "cancel_therapist")
    sched_cancel_c = sum(1 for c in cells if c.get("state") == "cancel_child")

    return {
        "totals": {
            "therapists": len(therapists),
            "clients": len(clients),
            "sessions": len(sessions),
            "completed_sessions": sum(1 for s in sessions if s.get("status") == "Completed"),
            "total_hours": round(sum(float(s.get("hours") or 0) for s in sessions if s.get("status") == "Completed"), 1),
            "open_requests": sum(1 for r in requests if r.get("status") == "pending"),
            "urgent_clients": sum(1 for c in per_c if c["status"] == "urgent"),
            "warning_clients": sum(1 for c in per_c if c["status"] == "warning"),
            "schedule_cells": len(cells),
            "schedule_cancel_therapist": sched_cancel_t,
            "schedule_cancel_child": sched_cancel_c,
        },
        "per_therapist": list(per_t.values()),
        "per_client": sorted(per_c, key=lambda x: {"urgent":0,"warning":1,"ok":2}[x["status"]]),
    }

# ------------------- Imports -------------------
def _normalize_table_column(name) -> str:
    """Excel headers like 'Child Name' / 'DOB/Age' → child_name / dob_age."""
    s = str(name).strip().lower()
    s = _re_top.sub(r"[\s/]+", "_", s)
    s = _re_top.sub(r"[^\w]+", "_", s)
    s = _re_top.sub(r"_+", "_", s).strip("_")
    return s


def _read_table(file: UploadFile) -> List[dict]:
    """Read xlsx/csv into list of dicts with normalized lower-case keys."""
    import pandas as pd
    content = file.file.read()
    import io
    if file.filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    else:
        df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    df.columns = [_normalize_table_column(c) for c in df.columns]
    df = df.where(df.notna(), None)
    return df.to_dict("records")

@api.post("/import/clients")
async def import_clients(file: UploadFile = File(...), _=Depends(admin_only)):
    rows = _read_table(file)
    created, skipped = 0, 0
    therapists = await db.therapists.find({}, {"_id": 0}).to_list(100)
    t_by_name = {t["name"].lower(): t["id"] for t in therapists}
    for r in rows:
        name = r.get("name") or r.get("child_name") or r.get("full_name")
        if not name:
            skipped += 1; continue
        file_no = str(r.get("file_no") or r.get("id") or r.get("file") or "").strip() or None
        # match therapist name to id
        main_name = (r.get("main_therapist") or r.get("main") or "").strip().lower() if r.get("main_therapist") or r.get("main") else None
        main_id = t_by_name.get(main_name) if main_name else None
        await db.clients.insert_one({
            "id": str(uuid.uuid4()), "name": str(name).strip(),
            "file_no": file_no, "package_hours": float(r.get("package_hours") or r.get("pkg") or 24),
            "supervisor": r.get("supervisor"), "main_therapist_id": main_id,
            "co_therapist_ids": [], "color": r.get("color") or "#A2C4C9",
            "locations": [], "parent_name": r.get("parent_name") or r.get("parent"),
            "parent_phone": str(r.get("parent_phone") or r.get("phone") or "") or None,
            "age": str(r.get("age") or "") or None, "notes": r.get("notes"),
            "created_at": now_iso(),
        })
        created += 1
    return {"created": created, "skipped": skipped}

@api.post("/import/intake")
async def import_intake(file: UploadFile = File(...), _=Depends(admin_only)):
    rows = _read_table(file)
    created, updated, skipped = 0, 0, 0
    for r in rows:
        name = (
            r.get("child_name") or r.get("name") or r.get("child")
            or r.get("student_name") or r.get("client_name") or ""
        )
        if isinstance(name, str):
            name = name.strip()
        else:
            name = str(name).strip() if name is not None else ""
        if not name:
            skipped += 1
            continue
        phone = str(r.get("phone") or r.get("parent_phone") or r.get("mobile") or "").strip() or None
        intake_type = (r.get("intake_type") or r.get("type") or "pre").lower()
        if intake_type not in ("pre", "post"):
            intake_type = "pre"
        status = (r.get("status") or "new").lower()
        doc = {
            "child_name": name,
            "parent_name": r.get("parent_name") or r.get("parent") or r.get("guardian"),
            "phone": phone,
            "intake_type": intake_type,
            "status": status,
            "notes": r.get("notes") or r.get("note"),
            "intake_date": str(r.get("intake_date") or r.get("date") or "") or None,
            "age": str(r.get("age") or r.get("dob_age") or r.get("dob") or "") or None,
            "service": r.get("service") or r.get("service_type"),
            "district": r.get("area") or r.get("district") or r.get("location"),
            "diagnosis": r.get("diagnosis"),
            "priority": bool(r.get("priority")) if r.get("priority") not in (None, "", "0", "false", "no") else False,
        }
        match_q = {
            "child_name": {"$regex": f"^{re.escape(name)}$", "$options": "i"},
            "intake_type": intake_type,
        }
        if phone:
            match_q["phone"] = phone
        match = await db.intake.find_one(match_q, {"_id": 0, "id": 1})
        if match:
            await db.intake.update_one({"id": match["id"]}, {"$set": doc})
            updated += 1
        else:
            await db.intake.insert_one({
                "id": str(uuid.uuid4()),
                "created_at": now_iso(),
                **doc,
            })
            created += 1
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "message": f"{updated} records updated, {created} records added, {skipped} records skipped",
    }

# ------------------- Historical Schedule Loader -------------------
HISTORICAL_SCHEDULES = None  # lazy-loaded from JSON file

def _load_historical():
    global HISTORICAL_SCHEDULES
    if HISTORICAL_SCHEDULES is None:
        import json
        path = ROOT_DIR / "historical_schedules.json"
        if path.exists():
            HISTORICAL_SCHEDULES = json.loads(path.read_text())
        else:
            HISTORICAL_SCHEDULES = {}
    return HISTORICAL_SCHEDULES

@api.get("/import/historical-weeks")
async def list_historical_weeks(_=Depends(admin_only)):
    data = _load_historical()
    return {"weeks": list(data.keys())}

@api.post("/import/historical-load")
async def import_historical(body: dict, _=Depends(admin_only)):
    """Import all historical weeks into schedule_cells. body: {clear_existing?: bool}"""
    data = _load_historical()
    if not data:
        raise HTTPException(status_code=404, detail="No historical data file found")
    if body.get("clear_existing"):
        await db.schedule_cells.delete_many({})
    therapists = await db.therapists.find({}, {"_id": 0}).to_list(100)
    t_by_name = {t["name"]: t["id"] for t in therapists}
    DAYS_MAP = {"Sunday":0, "Monday":1, "Tuesday":2, "Wednesday":3, "Thursday":4}
    TIMES = ["8:00 AM - 9:00 AM","9:00 AM - 10:00 AM","10:00 AM - 11:00 AM",
             "11:00 AM - 12:00 PM","12:00 PM - 1:00 PM","1:00 PM - 2:00 PM",
             "2:00 PM - 3:00 PM","3:00 PM - 4:00 PM","4:00 PM - 5:00 PM",
             "5:00 PM - 6:00 PM"]
    inserted = 0
    weeks_loaded = 0
    for week_label, therapists_data in data.items():
        # parse week label like "26 Apr- 30 Apr" → use a fake ISO date for storage
        week_start_iso = f"hist:{week_label}"
        weeks_loaded += 1
        for entry in therapists_data:
            tname = entry.get("n")
            t_id = t_by_name.get(tname)
            if not t_id:
                continue
            for day_label, slots in entry.get("s", []):
                day_idx = DAYS_MAP.get(day_label)
                if day_idx is None:
                    continue
                for slot_idx, raw in enumerate(slots):
                    if not raw or not str(raw).strip():
                        continue
                    txt = str(raw).strip()
                    # parse service code
                    service = "SS"
                    child = None
                    note = None
                    custom = None
                    upper = txt.upper()
                    if upper.startswith("HS"): service = "HS"
                    elif upper.startswith("SS"): service = "SS"
                    elif upper.startswith("OS"): service = "OS"
                    elif "AVC" in upper: service = "AVC"
                    elif "SUPERVISION" in upper: service = "SUPERVISION"
                    elif "OBSERVATION" in upper: service = "OBSERVATION"
                    elif "MEETING" in upper: service = "MEETING"
                    elif "LEAVE" in upper: service = "LEAVE"
                    elif "BREAK" in upper: service = "BREAK"
                    # extract child name after | or W/
                    if "|" in txt:
                        child = txt.split("|", 1)[1].strip()
                    elif "W/" in txt:
                        child = txt.split("W/", 1)[1].strip()
                    elif "with" in txt.lower():
                        child = txt.lower().split("with", 1)[1].strip()
                    if child and "(" in child:
                        custom = child[child.find("(")+1:child.find(")")]
                        child = child[:child.find("(")].strip()
                    if slot_idx >= len(TIMES):
                        continue
                    if service in ("LEAVE", "BREAK", "AVC"):
                        note = txt
                    await db.schedule_cells.insert_one({
                        "id": str(uuid.uuid4()),
                        "therapist_id": t_id, "day": day_idx,
                        "time_slot": TIMES[slot_idx],
                        "service_code": service, "child_name": child,
                        "note": note, "custom_time": custom,
                        "state": "normal", "color": None, "duration": 1,
                        "week_start": week_start_iso, "created_at": now_iso(),
                    })
                    inserted += 1
    return {"weeks_loaded": weeks_loaded, "cells_inserted": inserted}

@api.post("/schedule/duplicate-week")
async def duplicate_week(body: dict, _=Depends(admin_only)):
    """Copy all cells from source_week to target_week. body: {source_week, target_week, clear_target?}"""
    source = body.get("source_week"); target = body.get("target_week")
    if not source or not target:
        raise HTTPException(status_code=400, detail="source_week and target_week required")
    if body.get("clear_target"):
        await db.schedule_cells.delete_many({"week_start": target})
    cells = await db.schedule_cells.find({"week_start": source}, {"_id": 0}).to_list(5000)
    inserted = 0
    for c in cells:
        new_c = {**c, "id": str(uuid.uuid4()), "week_start": target,
                 "state": "normal", "created_at": now_iso()}
        await db.schedule_cells.insert_one(new_c)
        inserted += 1
    return {"copied": inserted}

@api.post("/import/list-sheets")
async def list_excel_sheets(file: UploadFile = File(...), _=Depends(admin_only)):
    """Return the list of sheet names in an uploaded .xlsx file (helps user pick the right one)."""
    import openpyxl, io
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    return {"sheets": wb.sheetnames}


SCHEDULE_TIME_SLOTS = [
    "8:00 AM - 9:00 AM", "9:00 AM - 10:00 AM", "10:00 AM - 11:00 AM",
    "11:00 AM - 12:00 PM", "12:00 PM - 1:00 PM", "1:00 PM - 2:00 PM",
    "2:00 PM - 3:00 PM", "3:00 PM - 4:00 PM", "4:00 PM - 5:00 PM",
    "5:00 PM - 6:00 PM",
]
SCHEDULE_DAYS_MAP = {"sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4}


def _parse_hm_to_minutes(hm: str, ref_ampm: str = "AM") -> Optional[int]:
    """Parse '8:30', '1:30', etc. to minutes from midnight."""
    hm = (hm or "").strip().upper()
    if not hm:
        return None
    ampm = ref_ampm.upper()
    m = re.match(r"^(\d{1,2}):(\d{2})\s*(AM|PM)?$", hm, re.I)
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if m.group(3):
        ampm = m.group(3).upper()
    elif h < 8 and ref_ampm == "PM":
        ampm = "PM"
    if ampm == "PM" and h != 12:
        h += 12
    if ampm == "AM" and h == 12:
        h = 0
    return h * 60 + mi


def _slot_bounds_minutes(time_slot: str):
    """Return (start_min, end_min) for a canonical time slot string."""
    parts = (time_slot or "").split(" - ")
    if len(parts) != 2:
        return None, None
    start_ref = "AM" if "AM" in parts[0].upper() else "PM"
    s = _parse_hm_to_minutes(parts[0].strip(), start_ref)
    e = _parse_hm_to_minutes(parts[1].strip(), "PM" if "PM" in parts[1].upper() else start_ref)
    return s, e


def _duration_from_custom(time_slot: str, custom: str, time_slots: list) -> int:
    """How many consecutive time_slots a session spans based on custom time range."""
    if not custom or not str(custom).strip():
        return 1
    txt = str(custom).strip()
    m = re.search(r"([\d]{1,2}:[\d]{2})\s*[-–]\s*([\d]{1,2}:[\d]{2})", txt)
    if not m:
        return 1
    start_idx = time_slots.index(time_slot) if time_slot in time_slots else -1
    if start_idx < 0:
        return 1
    _, slot_end_ref = (time_slot.split(" - ") + ["AM"])[:2]
    ref = "PM" if "PM" in slot_end_ref.upper() else "AM"
    start_m = _parse_hm_to_minutes(m.group(1), ref)
    end_m = _parse_hm_to_minutes(m.group(2), "PM")
    if start_m is None or end_m is None:
        return 1
    if end_m <= start_m:
        end_m += 12 * 60
    count = 0
    for i in range(start_idx, len(time_slots)):
        s, e = _slot_bounds_minutes(time_slots[i])
        if s is None:
            continue
        if s < end_m and e > start_m:
            count += 1
        elif s >= end_m:
            break
    return max(1, count)


def _parse_schedule_cell_text(txt: str):
    """Returns (service_code, child_name, custom_time, note) or None."""
    if not txt or not str(txt).strip():
        return None
    txt = str(txt).strip()
    upper = txt.upper()
    custom = None
    note = None
    child = None
    service = "SS"
    if "AVC" in upper:
        service = "AVC"; note = txt
    elif "LEAVE" in upper:
        service = "LEAVE"; note = txt
    elif "BREAK" in upper:
        service = "BREAK"; note = txt
    elif "SUPERVISION" in upper:
        service = "SUPERVISION"
    elif "OBSERVATION" in upper:
        service = "OBSERVATION"
    elif "MEETING" in upper:
        service = "MEETING"
    elif upper.startswith("HS"):
        service = "HS"
    elif upper.startswith("OS"):
        service = "OS"
    elif upper.startswith("SS"):
        service = "SS"
    if "|" in txt:
        child = txt.split("|", 1)[1].strip()
    elif "W/" in upper:
        idx = upper.index("W/")
        child = txt[idx + 2:].strip()
    elif " with " in txt.lower():
        child = txt.lower().split(" with ", 1)[1].strip().title()
    if child and "(" in child:
        m_open = child.find("(")
        m_close = child.find(")", m_open)
        if m_close > m_open:
            custom = child[m_open + 1:m_close].strip()
            child = child[:m_open].strip()
    return service, child, custom, note


def _resolve_schedule_therapist(name: str, t_by_name: dict) -> Optional[str]:
    name = (name or "").strip()
    if not name:
        return None
    if name in t_by_name:
        return t_by_name[name]
    for key, tid in t_by_name.items():
        if key.lower() == name.lower():
            return tid
    return None


def _normalize_schedule_grid(rows) -> List[List[str]]:
    grid = []
    for row in rows:
        if row is None:
            grid.append([])
            continue
        cells = []
        for c in row:
            if c is None:
                cells.append("")
            else:
                cells.append(str(c).strip())
        grid.append(cells)
    return grid


def _normalize_week_start(week_start: str) -> str:
    """Normalize any date to the Sunday (week start) ISO string."""
    from datetime import date, timedelta
    raw = (week_start or "").strip()[:10]
    d = date.fromisoformat(raw)
    days_since_sunday = (d.weekday() + 1) % 7
    sunday = d - timedelta(days=days_since_sunday)
    return sunday.isoformat()


async def _import_schedule_grid(grid: List[List[str]], week_start: str, t_by_name: dict, clear_existing: bool):
    if clear_existing:
        await db.schedule_cells.delete_many({"week_start": week_start})
    inserted = 0
    skipped_unknown = []
    time_slots = list(SCHEDULE_TIME_SLOTS)
    i = 0
    while i < len(grid):
        row = grid[i]
        joined = " ".join(c.lower() for c in row)
        if "therapist" in joined and "days" in joined and "8:00" in joined:
            header_times = []
            for c in row[3:]:
                if c and ("AM" in c.upper() or "PM" in c.upper()):
                    header_times.append(c)
            if header_times:
                time_slots = header_times
            current_t_id = None
            i += 1
            while i < len(grid):
                r = grid[i]
                if not any(r):
                    if i + 1 < len(grid) and not any(grid[i + 1]):
                        i += 1
                        break
                    i += 1
                    continue
                name_c = r[1] if len(r) > 1 else ""
                if name_c and name_c.lower() not in SCHEDULE_DAYS_MAP:
                    tid = _resolve_schedule_therapist(name_c, t_by_name)
                    if tid:
                        current_t_id = tid
                    elif name_c and name_c not in skipped_unknown:
                        skipped_unknown.append(name_c)
                day_label = (r[2] if len(r) > 2 else "").lower()
                day_idx = SCHEDULE_DAYS_MAP.get(day_label)
                if day_idx is not None and current_t_id:
                    skip_until = -1
                    for slot_idx, ts in enumerate(time_slots):
                        if slot_idx <= skip_until:
                            continue
                        col_idx = 3 + slot_idx
                        if col_idx >= len(r):
                            break
                        val = r[col_idx].strip()
                        parsed = _parse_schedule_cell_text(val)
                        if parsed:
                            service, child, custom, note = parsed
                            canonical_ts = (
                                SCHEDULE_TIME_SLOTS[slot_idx]
                                if slot_idx < len(SCHEDULE_TIME_SLOTS)
                                else ts
                            )
                            duration = _duration_from_custom(canonical_ts, custom, time_slots)
                            if duration > 1:
                                skip_until = slot_idx + duration - 1
                            cell_color = None
                            if child:
                                cl = await db.clients.find_one({"name": child}, {"_id": 0, "schedule_color": 1, "color": 1})
                                if cl:
                                    cell_color = cl.get("schedule_color") or cl.get("color")
                            await db.schedule_cells.insert_one({
                                "id": str(uuid.uuid4()),
                                "therapist_id": current_t_id,
                                "day": day_idx,
                                "time_slot": canonical_ts,
                                "service_code": service,
                                "child_name": child,
                                "note": note,
                                "custom_time": custom,
                                "state": "normal",
                                "color": cell_color,
                                "duration": duration,
                                "week_start": week_start,
                                "created_at": now_iso(),
                            })
                            inserted += 1
                i += 1
            continue
        i += 1
    return inserted, skipped_unknown


async def _seed_schedule_week_2026_05_24(t_by_name: dict):
    """Seed May 24–28 2026 schedule if empty (idempotent)."""
    week_start = "2026-05-24"
    if await db.schedule_cells.count_documents({"week_start": week_start}) > 0:
        return 0
    seed_rows = [
        ("Ms. Maha", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Fahda", 0, "10:00 AM - 11:00 AM", "Supervision W/ Lulu (10-11:30)"),
        ("Ms. Fahda", 0, "11:00 AM - 12:00 PM", "HS | Saleh (11:30-1:30)"),
        ("Ms. Fahda", 0, "1:00 PM - 2:00 PM", "HS | Ibrahim"),
        ("Ms. Fahda", 1, "8:00 AM - 9:00 AM", "HS | Abdulaziz A"),
        ("Ms. Fahda", 1, "9:00 AM - 10:00 AM", "HS | Ibrahim"),
        ("Ms. Razan", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Manal", 0, "8:00 AM - 9:00 AM", "HS | Abdulaziz A"),
        ("Ms. Manal", 0, "9:00 AM - 10:00 AM", "HS | Omar"),
        ("Ms. Manal", 1, "8:00 AM - 9:00 AM", "HS | Salman"),
        ("Ms. Manal", 1, "9:00 AM - 10:00 AM", "HS | Saleh"),
        ("Ms. Hajer", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Rahaf", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Shatha", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Alhanouf", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Waad", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Bodoor", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Fatimah", 0, "8:00 AM - 9:00 AM", "HS | Lulu"),
        ("Ms. Fatimah", 0, "9:00 AM - 10:00 AM", "HS | Abdulaziz W"),
        ("Ms. Fatimah", 0, "10:00 AM - 11:00 AM", "AVC"),
        ("Ms. Fatimah", 1, "8:00 AM - 9:00 AM", "HS | Lulu"),
        ("Ms. Fatimah", 1, "9:00 AM - 10:00 AM", "HS | Abdulaziz W"),
        ("Ms. Shrooq", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Abeer", 0, "8:00 AM - 9:00 AM", "Leave"),
        ("Ms. Najla", 0, "8:00 AM - 9:00 AM", "HS | Abdulaziz A"),
        ("Ms. Najla", 0, "9:00 AM - 10:00 AM", "HS | Omar"),
        ("Ms. Najla", 1, "8:00 AM - 9:00 AM", "HS | Khalid"),
        ("Ms. Walaa", 0, "8:00 AM - 9:00 AM", "HS | Khalid"),
        ("Ms. Walaa", 1, "8:00 AM - 9:00 AM", "HS | Khalid"),
    ]
    inserted = 0
    for tname, day, slot, content in seed_rows:
        tid = _resolve_schedule_therapist(tname, t_by_name)
        if not tid:
            continue
        parsed = _parse_schedule_cell_text(content)
        if not parsed:
            continue
        service, child, custom, note = parsed
        await db.schedule_cells.insert_one({
            "id": str(uuid.uuid4()),
            "therapist_id": tid,
            "day": day,
            "time_slot": slot,
            "service_code": service,
            "child_name": child,
            "note": note,
            "custom_time": custom,
            "state": "normal",
            "color": None,
            "duration": 1,
            "week_start": week_start,
            "created_at": now_iso(),
        })
        inserted += 1
    if inserted:
        logger.info(f"Seeded {inserted} schedule cells for week {week_start}")
    return inserted


@api.post("/import/schedule-excel")
async def import_schedule_excel(file: UploadFile = File(...),
                                 week_start: str = Form(...),
                                 clear_existing: Optional[str] = Form(None),
                                 sheet_name: Optional[str] = Form(None),
                                 _=Depends(admin_only)):
    """Parse Therapists' Schedule .xlsx or .csv and create cells for week_start."""
    import io
    content = await file.read()
    fname = (file.filename or "").lower()
    week_start = _normalize_week_start(week_start)
    logger.info(f"Schedule import week_start={week_start} (normalized to Sunday)")
    therapists = await db.therapists.find({}, {"_id": 0, "pin_hash": 0, "password_hash": 0}).to_list(100)
    t_by_name = {t["name"]: t["id"] for t in therapists}
    for t in therapists:
        short = t["name"].replace("Ms. ", "").strip()
        t_by_name[short] = t["id"]
        t_by_name[short.lower()] = t["id"]

    if fname.endswith(".csv"):
        import csv
        text = content.decode("utf-8-sig", errors="replace")
        grid = _normalize_schedule_grid(list(csv.reader(io.StringIO(text))))
    else:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb[sheet_name] if sheet_name and sheet_name in wb.sheetnames else wb.active
        max_row = ws.max_row or 0
        max_col = ws.max_column or 0
        raw = []
        for r in range(1, max_row + 1):
            raw.append([ws.cell(row=r, column=c).value for c in range(1, max_col + 1)])
        grid = _normalize_schedule_grid(raw)

    inserted, skipped = await _import_schedule_grid(
        grid, week_start, t_by_name, clear_existing == "true"
    )
    return {"cells_inserted": inserted, "week_start": week_start, "skipped_therapists": skipped[:20]}

@api.get("/")
async def root():
    return {"message": "Boost Growth Portal API", "status": "ok"}


@api.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ------------------- Seed Data (FROM BASE44 SOURCE) -------------------
THERAPIST_SEED = [
    {"name": "Ms. Maha", "color": "#7A8A6A", "email": "maha@boostgrowthsa.com"},
    {"name": "Ms. Fahda", "color": "#D4A64A", "email": "fahda@boostgrowthsa.com"},
    {"name": "Ms. Razan", "color": "#8FA481", "email": "razan@boostgrowthsa.com"},
    {"name": "Ms. Manal", "color": "#A4BCCB", "email": "manal@boostgrowthsa.com"},
    {"name": "Ms. Hajer", "color": "#C97B5C", "email": "hajer@boostgrowthsa.com"},
    {"name": "Ms. Rahaf", "color": "#9B7BAB", "email": "rahaf@boostgrowthsa.com"},
    {"name": "Ms. Shatha", "color": "#5C8B7E", "email": "shatha@boostgrowthsa.com"},
    {"name": "Ms. Alhanouf", "color": "#B89968", "email": "alhanouf@boostgrowthsa.com"},
    {"name": "Ms. Waad", "color": "#7B96B5", "email": "waad@boostgrowthsa.com"},
    {"name": "Ms. Fatimah", "color": "#6B9080", "email": "fatimah@boostgrowthsa.com"},
    {"name": "Ms. Shrooq", "color": "#D49A60", "email": "shrooq@boostgrowthsa.com"},
    {"name": "Ms. Abeer", "color": "#8B7BA8", "email": "abeer@boostgrowthsa.com"},
    {"name": "Ms. Najla", "color": "#7BA890", "email": "najla@boostgrowthsa.com"},
    {"name": "Ms. Asma", "color": "#6A7F9B", "email": "asma@boostgrowthsa.com"},
]

CLIENT_SEED = [
    {"file_no":"009","name":"Saleh Ahusainy","main":"Ms. Waad","co":["Ms. Manal","Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#FFE599","locs":[{"service":"SS","address":"Alnakeel - Home Sweet Home"},{"service":"HS","address":"Alnakheel - 1st floor, apartment #7"},{"service":"HS","address":"Grandmother house"}]},
    {"file_no":"011","name":"Fahad Alyahya","main":"Ms. Alhanouf","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#A2C4C9","locs":[{"service":"HS","address":"Alyasmin - house no 3075"},{"service":"SS","address":"Talat School"}]},
    {"file_no":"018","name":"Layan AlSaud","main":"Ms. Jenan","co":[],"pkg":24,"sup":"Ms. Jenan","color":"#C9DAF8","locs":[{"service":"ABA","address":"Alaqiq"}]},
    {"file_no":"023","name":"Yahya Alqahtani","main":"Ms. Hajer","co":["Ms. Manal"],"pkg":24,"sup":"Ms. Fahda","color":"#D5A6BD","locs":[{"service":"HS","address":"Alaarid"}]},
    {"file_no":"024","name":"Abdulaziz Alrasheed","main":"Ms. Shatha","co":["Ms. Manal","Ms. Hajer"],"pkg":24,"sup":"Ms. Fahda","color":"#E6B8AF","locs":[{"service":"HS","address":"Alnada - Building #26, 3rd floor, apartment #23"}]},
    {"file_no":"027","name":"Mohmmed Alaqel","main":"Ms. Rahaf","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#FFF2CC","locs":[{"service":"HS","address":"AlMalqa - 331"}]},
    {"file_no":"030","name":"Husam Alturaigy","main":"Ms. Manal","co":["Ms. Shatha"],"pkg":24,"sup":"Ms. Fahda","color":"#B4A7D6","locs":[{"service":"SS","address":"Whales of the future daycare"},{"service":"HS","address":"Alwaha - Home #4B"}]},
    {"file_no":"034","name":"Aljouhrah Alduailij","main":"Ms. Asma","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#D9EAD3","locs":[{"service":"SS","address":"Alnakheel - Talat School"}]},
    {"file_no":"035","name":"Saad Alghamdi","main":"Ms. Shatha","co":["Ms. Hajer","Ms. Fatimah"],"pkg":24,"sup":"Ms. Maha","color":"#B6D7A8","locs":[{"service":"HS","address":"Al Aqiq - House in the corner"},{"service":"SS","address":"Al Motaqdimah Schools"}]},
    {"file_no":"037","name":"Suzan Alsultan","main":"Ms. Asma","co":[],"pkg":24,"sup":"Ms. Maha","color":"#FCE5CD","locs":[{"service":"HS","address":"King Fahad - Villa 1308"}]},
    {"file_no":"038","name":"Salman Alrasheed","main":"Ms. Manal","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Maha","color":"#F4CCCC","locs":[{"service":"SS","address":"Summer Camp - Stars of Knowledge School"},{"service":"HS","address":"Alnada - Building #26, 3rd floor, apartment #23"}]},
    {"file_no":"040","name":"Abdulaziz AlAbdulwahab","main":"Ms. Fatimah","co":["Ms. Fahda","Ms. Hajer"],"pkg":24,"sup":"Ms. Maha","color":"#6FA8DC","locs":[{"service":"HS","address":"Alraed - house no 8188"}]},
    {"file_no":"041","name":"Ameerah Alshehri","main":"Ms. Fahda","co":["Ms. Fatimah"],"pkg":24,"sup":"Ms. Maha","color":"#EA9999","locs":[{"service":"HS","address":"Roshen - Villa 277"}]},
    {"file_no":"042","name":"Sultan Aldamer","main":"Ms. Shrooq","co":["Ms. Rahaf"],"pkg":24,"sup":"Ms. Maha","color":"#FFE599","locs":[{"service":"SS","address":"Bright Mind School"},{"service":"HS","address":"Alhada - No house number"}]},
    {"file_no":"047","name":"Alwaleed Alotaibi","main":"Ms. Hajer","co":["Ms. Alhanouf"],"pkg":24,"sup":"Ms. Maha","color":"#B4A7D6","locs":[{"service":"HS","address":"Alqairawan - house no 10"},{"service":"SS","address":"Al Motaqdimah Schools"}]},
    {"file_no":"052","name":"Sulaiman Alkhurashi","main":"Ms. Rahaf","co":["Ms. Maha"],"pkg":24,"sup":"Ms. Maha","color":"#F9CB9C","locs":[{"service":"HS","address":"Alsulaimanyah - house no 24"}]},
    {"file_no":"054","name":"Omar Alkhurashi","main":"Ms. Manal","co":["Ms. Maha"],"pkg":24,"sup":"Ms. Maha","color":"#D0E0E3","locs":[{"service":"HS","address":"Alsulaimanyah - house no 24"}]},
    {"file_no":"060","name":"Mohammed Albedayea","main":"Ms. Bodoor","co":["Ms. Shatha"],"pkg":24,"sup":"Ms. Maha","color":"#D9EAD3","locs":[{"service":"HS","address":"Alyasmin - Home no 14"},{"service":"SS","address":"Yas School"}]},
    {"file_no":"061","name":"Ibrahim Alnasir","main":"Ms. Rahaf","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#D9D2E9","locs":[{"service":"HS","address":"Alyasmin - Home no 39"},{"service":"SS","address":"Alnakheel - Talat School"}]},
    {"file_no":"062","name":"Lulu Almutair","main":"Ms. Razan","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#D5A6BD","locs":[{"service":"HS","address":"Almuroj - Home no 4"},{"service":"SS","address":"Alnakheel - Talat School"}]},
    {"file_no":"063","name":"Amani Ghaith","main":"Ms. Maha","co":[],"pkg":24,"sup":"Ms. Maha","color":"#FFF2CC","locs":[{"service":"HS","address":"Alnakheel"}]},
    {"file_no":"065","name":"Aser Alharbi","main":"Ms. Najla","co":["Ms. Maha"],"pkg":24,"sup":"Ms. Maha","color":"#F4CCCC","locs":[{"service":"HS","address":"Al Izdihar - First floor - House no 15"}]},
    {"file_no":"068","name":"Abdulrahman Alshawi","main":"Ms. Razan","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#C9DAF8","locs":[{"service":"HS","address":"AR Rayan - Home no 32"},{"service":"SS","address":"Kindergarten of KSU"}]},
    {"file_no":"070","name":"Abdulelah Almuhana","main":"Ms. Abeer","co":["Ms. Maha"],"pkg":24,"sup":"Ms. Maha","color":"#CFE2F3","locs":[{"service":"SS","address":"Manarat Ar Riyadh"}]},
    {"file_no":"072","name":"Khalid Bin Shuael","main":"Ms. Shatha","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#EAD1DC","locs":[{"service":"HS","address":"AlMursalat"}]},
]

# ------------------- Intake Seed (from Waiting_List_v4.xlsx) -------------------
INTAKE_SEED = [
    # Pre-Intake
    {"intake_type":"pre","child_name":"Reema Idrees","service":"HS","phone":"546272994","district":"Iraqi","age":"2021","time_pref":"Morning","diagnosis":"PWS"},
    {"intake_type":"pre","child_name":"Abdulaziz Alrajab","service":"HS","phone":"500252211","district":"Al Malqa","age":"2023","time_pref":"Any","diagnosis":"NA","notes":"Online CONCL"},
    {"intake_type":"pre","child_name":"Mansour","service":"HS","phone":"507247881","district":"Alyasmeen","age":"2022","time_pref":"Any","diagnosis":"Speech delay"},
    {"intake_type":"pre","child_name":"Leen","service":"SS","phone":"503225528","district":"Al Raed","age":"2010","time_pref":"Morning","diagnosis":"NA","notes":"3 hours at school"},
    {"intake_type":"pre","child_name":"Ebrahim Alnami","service":"SS","phone":"564443542","district":"Alsulimania","age":"2022","time_pref":"Morning","diagnosis":"Premature - 29 weeks"},
    {"intake_type":"pre","child_name":"Naif Alblawi","service":"HS","phone":"535544260","district":"Qurtubah","age":"2020","time_pref":"Evening","diagnosis":"ADHD"},
    {"intake_type":"pre","child_name":"Saad Alajaji","service":"HS","phone":"555955342","district":"AL-Suwaidi","age":"2021","time_pref":"Evening","diagnosis":"NA"},
    {"intake_type":"pre","child_name":"Reema Alotaibi","service":"HS","phone":"503553339","district":"AlArid","time_pref":"Evening","diagnosis":"Speech delay","priority": True},
    {"intake_type":"pre","child_name":"Feras AlFouzan","service":"SS","district":"AlFalah","age":"2019","diagnosis":"ASD nonverbal"},
    {"intake_type":"pre","child_name":"Saud Alshrafi","service":"SS","district":"Alyasmeen","age":"2020","diagnosis":"ADHD"},
    {"intake_type":"pre","child_name":"Khalid Abunayyan","service":"HS","district":"Diriyah","age":"2021","diagnosis":"ADD"},
    {"intake_type":"pre","child_name":"Fahad Abdullatif","service":"HS","district":"Sidrah","age":"2020","diagnosis":"ADHD"},
    {"intake_type":"pre","child_name":"Mela Mohammed","service":"SS","district":"Tuwiq","age":"2022","diagnosis":"ADHD"},
    {"intake_type":"pre","child_name":"Mansour Tonkar","service":"SS","district":"Al-Moroj","age":"2019","diagnosis":"ASD"},
    {"intake_type":"pre","child_name":"Waseem Aljohani","service":"HS / SS","phone":"594744884","district":"Alnarjis","age":"2019","diagnosis":"ADHD","notes":"DR.Turki"},
    {"intake_type":"pre","child_name":"Sultan Bandar","service":"HS","phone":"555579702","district":"Alyasmeen","age":"2019","time_pref":"Any","diagnosis":"Speech delay - ADHD"},
    # Post-Intake
    {"intake_type":"post","child_name":"Mohammed alnoweser","service":"HS","district":"King Fahad","age":"3 year","language":"English"},
    {"intake_type":"post","child_name":"Mohammed Alofi","service":"HS","phone":"554505400","district":"AlAridh","age":"6","language":"English / Arabic"},
    {"intake_type":"post","child_name":"Rakan Alaqel","service":"HS","phone":"538154083","district":"Alnarjis","age":"2019","language":"Arabic"},
    {"intake_type":"post","child_name":"Nawaf Alshweeb","service":"HS","district":"Um Alhamam","age":"5.5","language":"ASD"},
    {"intake_type":"post","child_name":"Abdulkareem Kaki","service":"HS","language":"Arabic"},
    {"intake_type":"post","child_name":"Abdulaziz Alzahrani","service":"HS","phone":"555341092","district":"Almalqa","age":"4"},
    {"intake_type":"post","child_name":"Yazeed Bu sheet","service":"SS","phone":"555009662","district":"Hitten","diagnosis":"Autism"},
    {"intake_type":"post","child_name":"Misk Alsadoon","service":"HS","district":"Qurtubah"},
    {"intake_type":"post","child_name":"Omar ALImazrou","service":"HS","phone":"534888855","district":"AlArid","age":"2023","diagnosis":"Autism","priority": True},
    {"intake_type":"post","child_name":"Fahad Suliman","service":"HS","phone":"966500566235","district":"Al-Sahafa","age":"2019","diagnosis":"ADD"},
    {"intake_type":"post","child_name":"Naif Alwhibi","service":"SS / HS","phone":"506128118","district":"Ar Rabi","age":"2020","diagnosis":"ASD","priority": True},
    {"intake_type":"post","child_name":"Ahmad Alshalfan","service":"SS / HS","phone":"505287407","district":"Almalqa","age":"2020","diagnosis":"ADHD and GDD","priority": True},
    {"intake_type":"post","child_name":"Abdulelah Almuhana","service":"HS","phone":"966565544999","district":"Al-Taawun","age":"2021","priority": True},
    {"intake_type":"post","child_name":"Faisal Alzghaibi","service":"HS","district":"Alyasmeen","age":"1445"},
    {"intake_type":"post","child_name":"Sultan Abalkhail","service":"HS/SS","district":"Al-Mursalat","age":"2019"},
    {"intake_type":"post","child_name":"Leena Alshahrani","service":"HS","phone":"530511175","district":"Alnarjis"},
]

# ------------------- Directory Seed (Internal Team) -------------------
DIRECTORY_SEED = [
    {"name":"Genan Almuhaisen","role":"Direct Manager","phone":"","email":"genan@boostgrowthsa.com"},
    {"name":"Boost Growth (Main)","role":"Coordinator / General Inquiries","phone":"","email":"hello@boostgrowthsa.com"},
    {"name":"Ms. Walaa","role":"Operations","phone":"","email":"walaa@boostgrowthsa.com"},
    {"name":"Ms. Maha","role":"Supervisor","phone":"","email":"maha@boostgrowthsa.com"},
    {"name":"Ms. Fahdah","role":"Supervisor","phone":"","email":"fahda@boostgrowthsa.com"},
]

# ------------------- Resources Seed -------------------
RESOURCES_SEED = [
    {"title":"Therapist Drive","description":"Session materials · forms · training","url":"https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr","visibility":"therapist","icon":"Folders","bg":"#E5EBE1","color":"#3D4F35","sort_order":10},
    {"title":"Therapist Training Hub","description":"Protocols · lesson plans","url":"https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr","visibility":"therapist","icon":"Notebook","bg":"#EAF0F3","color":"#375568","sort_order":20},
    {"title":"Client Files","description":"Per-client folders","url":"https://drive.google.com/drive/folders/1iMDwfucwzsEIl9WxwhJi_h6tg2vVtAFr","visibility":"admin","icon":"Folders","bg":"#FAF0D1","color":"#6B5218","sort_order":30},
    {"title":"HR Files","description":"Employees · Contracts","url":"https://drive.google.com/drive/folders/1jWRO97gDHK_TfmZhTqCqm0SdBc6_b5bE","visibility":"admin","icon":"Files","bg":"#F1ECF7","color":"#4E3F70","sort_order":40},
    {"title":"Company Policies","description":"Internal policies & SOPs","url":"https://drive.google.com/drive/folders/11VQQ-o1QoDQV-ktygB1tlnRmqCs3mxAb","visibility":"all","icon":"Notebook","bg":"#F4E7D8","color":"#8B6918","sort_order":50},
]


async def _run_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.therapists.create_index("id", unique=True)
        await db.schedule_cells.create_index([("week_start", 1), ("therapist_id", 1)])
        await db.notifications.create_index("user_id")
        await db.sessions.create_index([("client_id", 1), ("session_date", -1)])

        admin_email = os.environ["ADMIN_EMAIL"].lower()
        admin_password = os.environ["ADMIN_PASSWORD"]
        admin_name = os.environ.get("ADMIN_NAME", "Admin")
        existing = await db.users.find_one({"email": admin_email})
        if not existing:
            await db.users.insert_one({"id": str(uuid.uuid4()), "email": admin_email,
                                       "password_hash": hash_password(admin_password),
                                       "name": admin_name, "role": "admin", "created_at": now_iso()})
            logger.info(f"Admin seeded: {admin_email}")
        elif not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

        # Seed therapists ONLY on first-time setup (count==0). NEVER overwrite existing data.
        th_count = await db.therapists.count_documents({})
        if th_count == 0:
            for s in THERAPIST_SEED:
                await db.therapists.insert_one({
                    "id": str(uuid.uuid4()), "name": s["name"], "color": s["color"],
                    "email": s.get("email"), "phone": None,
                    "pin_hash": hash_password("0000"),
                    "created_at": now_iso(),
                })
            logger.info(f"First-time seed: {len(THERAPIST_SEED)} therapists with PIN=0000")
        else:
            # Add any new seed therapists that don't exist yet (by name) — preserves existing UUIDs
            existing_names = {t["name"] async for t in db.therapists.find({}, {"_id": 0, "name": 1})}
            added = 0
            for s in THERAPIST_SEED:
                if s["name"] not in existing_names:
                    await db.therapists.insert_one({
                        "id": str(uuid.uuid4()), "name": s["name"], "color": s["color"],
                        "email": s.get("email"), "phone": None,
                        "pin_hash": hash_password("0000"),
                        "created_at": now_iso(),
                    })
                    added += 1
            if added:
                logger.info(f"Added {added} new therapist(s) without disturbing existing data")

        # Seed schedule week 2026-05-24 if empty
        t_map = {t["name"]: t["id"] async for t in db.therapists.find({}, {"_id": 0, "name": 1, "id": 1})}
        for t in await db.therapists.find({}, {"_id": 0, "name": 1, "id": 1}).to_list(100):
            short = t["name"].replace("Ms. ", "").strip()
            t_map[short] = t["id"]
            t_map[short.lower()] = t["id"]
        await _seed_schedule_week_2026_05_24(t_map)

        # Migrate invoice service_type (HS / SS) from sessions where missing
        try:
            n = await _migrate_invoice_service_types()
            if n:
                logger.info(f"Invoice service_type migration: updated {n} invoice(s)")
        except Exception as e:
            logger.warning(f"Invoice service_type migration skipped: {e}")

        try:
            n = await _migrate_therapist_emails()
            if n:
                logger.info(f"Therapist email migration: updated {n} record(s)")
        except Exception as e:
            logger.warning(f"Therapist email migration skipped: {e}")

        # Load persisted email settings from db.settings into env
        settings_doc = await db.settings.find_one({"key": "email"}, {"_id": 0})
        if settings_doc:
            _apply_email_settings(settings_doc)

        # Seed clients ONLY on first-time setup (count==0). Preserves user edits.
        cl_count = await db.clients.count_documents({})
        if cl_count == 0:
            therapists_map = {t["name"]: t["id"] async for t in db.therapists.find({}, {"_id": 0, "name": 1, "id": 1})}
            for c in CLIENT_SEED:
                await db.clients.insert_one({
                    "id": str(uuid.uuid4()),
                    "file_no": c["file_no"], "name": c["name"],
                    "package_hours": c["pkg"], "supervisor": c["sup"],
                    "main_therapist_id": therapists_map.get(c["main"]),
                    "co_therapist_ids": [therapists_map[n] for n in c["co"] if n in therapists_map],
                    "color": c["color"], "locations": c["locs"],
                    "parent_name": None, "parent_phone": None, "age": None,
                    "notes": None, "created_at": now_iso(),
                })
            await db.meta.update_one({"key": "client_seed_version"},
                                     {"$set": {"version": 1, "updated_at": now_iso()}},
                                     upsert=True)
            logger.info(f"First-time seed: {len(CLIENT_SEED)} clients")

        # Seed Intake (only if empty — admin may manage manually)
        if await db.intake.count_documents({}) == 0:
            for item in INTAKE_SEED:
                await db.intake.insert_one({
                    "id": str(uuid.uuid4()),
                    "status": "new",
                    "priority": False,
                    "created_at": now_iso(),
                    **item,
                })
            logger.info(f"Seeded {len(INTAKE_SEED)} intake records from waiting list")

        # Seed Directory (only if empty)
        if await db.directory.count_documents({}) == 0:
            for item in DIRECTORY_SEED:
                await db.directory.insert_one({
                    "id": str(uuid.uuid4()), **item, "created_at": now_iso(),
                })
            logger.info(f"Seeded {len(DIRECTORY_SEED)} directory contacts")

        # Seed Resources (only if empty)
        if await db.resources.count_documents({}) == 0:
            for item in RESOURCES_SEED:
                await db.resources.insert_one({
                    "id": str(uuid.uuid4()),
                    "category": "drive",
                    **item,
                    "created_at": now_iso(),
                })
            logger.info(f"Seeded {len(RESOURCES_SEED)} resources")

        # Seed Leaves (only if empty) — from leaves_seed.json (parsed Vacation 2026)
        if await db.leaves.count_documents({}) == 0:
            seed_path = ROOT_DIR / "leaves_seed.json"
            if seed_path.exists():
                import json
                seed = json.loads(seed_path.read_text())
                t_by_name = {t["name"]: t["id"] async for t in db.therapists.find({}, {"_id": 0, "name": 1, "id": 1})}
                inserted = 0
                for item in seed:
                    tid = t_by_name.get(item.get("therapist_name"))
                    if not tid:
                        continue
                    await db.leaves.insert_one({
                        "id": str(uuid.uuid4()),
                        "therapist_id": tid,
                        "start_date": item.get("start_date") or "",
                        "end_date": item.get("end_date") or "",
                        "days": item.get("days") or 0,
                        "leave_type": item.get("leave_type") or "Annual",
                        "status": item.get("status") or "done",
                        "notes": item.get("notes"),
                        "created_at": now_iso(),
                    })
                    inserted += 1
                logger.info(f"Seeded {inserted} leaves from Vacation 2026")
    except Exception:
        logger.exception(
            "Background startup/seed failed — check MONGO_URL and MongoDB Atlas network access (0.0.0.0/0)"
        )


@app.on_event("startup")
async def startup():
    asyncio.create_task(_run_startup())
    logger.info("API ready; database init running in background")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ------------------- Frontend (React build) — same host as /api -------------------
FRONTEND_DIR = ROOT_DIR / "static"

if FRONTEND_DIR.is_dir():
    @app.get("/{spa_path:path}")
    async def serve_frontend(spa_path: str = ""):
        """Serve CRA build; unknown paths → index.html for client-side routing."""
        if spa_path.startswith("api") or spa_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        if spa_path:
            asset = FRONTEND_DIR / spa_path
            if asset.is_file():
                return FileResponse(asset)
        index = FRONTEND_DIR / "index.html"
        if index.is_file():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built — run build or deploy with Dockerfile")
