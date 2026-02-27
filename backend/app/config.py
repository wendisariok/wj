import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
DATABASE_PATH = os.getenv("DATABASE_PATH", r"C:\AI\InboxForge\inboxforge.db")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

ATTACHMENTS_DIR = os.getenv("ATTACHMENTS_DIR", r"C:\AI\InboxForge\attachments")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
OAUTH_REDIRECT_URI = f"{BACKEND_URL}/api/auth/callback"
