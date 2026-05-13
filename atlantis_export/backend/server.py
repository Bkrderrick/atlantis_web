"""
Atlantis B&B — Contact-form backend (Gmail SMTP)
================================================
A minimal FastAPI server that accepts contact-form submissions from
the static site and emails them to your inbox via Gmail SMTP.

Run it locally:

    cd backend
    python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\\Scripts\\activate)
    pip install -r requirements.txt
    cp .env.example .env       # then edit .env with your real values
    uvicorn server:app --host 0.0.0.0 --port 8001 --reload

Once it's running, open the static site (index.html, contact.html, etc.)
through ANY HTTP server on the same machine and the contact form will
POST to http://localhost:8001/api/contact. Easiest:

    cd ..                                  # back to project root
    python -m http.server 5500             # serves the static site
    # then visit http://localhost:5500/contact.html in your browser

If the static site is served on a different origin (e.g. 5500) and the
backend on 8001, change API_BASE in contact.html to "http://localhost:8001".
"""

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

app = FastAPI(title="Atlantis Contact API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("atlantis.contact")


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
        raise RuntimeError("Gmail credentials are not configured in .env")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = gmail_user
    msg["To"] = dest
    msg.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context, timeout=20) as server:
        server.login(gmail_user, gmail_pwd)
        server.send_message(msg)


@api_router.get("/")
async def root():
    return {"message": "Atlantis contact API is running"}


@api_router.post("/contact")
async def submit_contact(payload: ContactSubmission):
    ts = datetime.now(timezone.utc).isoformat()
    subject = f"Atlantis B&B - New inquiry from {payload.name}"
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
    except Exception as exc:
        logger.exception("Failed to send contact email")
        raise HTTPException(status_code=502, detail=f"Email delivery failed: {exc}")

    return {"ok": True, "message": "Submission sent"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
