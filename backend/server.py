from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# ============================================================
# Atlantis Contact Form — emails submissions to the owner
# ============================================================
class ContactSubmission(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    number: Optional[str] = Field(default="", max_length=40)
    email: Optional[str] = Field(default="", max_length=160)
    questions: Optional[str] = Field(default="", max_length=4000)
    request: Optional[str] = Field(default="", max_length=4000)
    page: Optional[str] = Field(default="", max_length=200)


def _send_email_via_gmail(subject: str, body: str) -> None:
    gmail_user = os.environ.get("GMAIL_USER")
    gmail_pwd = os.environ.get("GMAIL_APP_PASSWORD")
    dest = os.environ.get("CONTACT_DEST_EMAIL", gmail_user)
    if not gmail_user or not gmail_pwd:
        raise RuntimeError("Gmail credentials are not configured")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = gmail_user
    msg["To"] = dest
    msg.set_content(body)

    context = ssl.create_default_context()
    # Use SSL on 465 for simplest, most reliable Gmail SMTP delivery
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=20) as server:
        server.login(gmail_user, gmail_pwd)
        server.send_message(msg)


@api_router.post("/contact")
async def submit_contact(payload: ContactSubmission):
    ts = datetime.now(timezone.utc).isoformat()
    subject = f"Atlantis B&B — New inquiry from {payload.name}"
    body = (
        "New Atlantis B&B contact submission\n"
        "----------------------------------------\n"
        f"Submitted at : {ts}\n"
        f"Source page  : {payload.page or '(unknown)'}\n"
        f"Name         : {payload.name}\n"
        f"Phone number : {payload.number or '(not provided)'}\n"
        f"Email        : {payload.email or '(not provided)'}\n\n"
        "Questions:\n"
        f"{payload.questions or '(none)'}\n\n"
        "Request:\n"
        f"{payload.request or '(none)'}\n"
    )
    try:
        _send_email_via_gmail(subject, body)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to send contact email")
        raise HTTPException(status_code=502, detail=f"Email delivery failed: {exc}")

    # Best-effort persistence (not required for the email to succeed)
    try:
        await db.contact_submissions.insert_one({
            "id": str(uuid.uuid4()),
            "name": payload.name,
            "number": payload.number,
            "email": payload.email,
            "questions": payload.questions,
            "request": payload.request,
            "page": payload.page,
            "submitted_at": ts,
        })
    except Exception:
        logger.exception("Failed to persist contact submission (non-fatal)")

    return {"ok": True, "message": "Submission sent"}

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