import json
from datetime import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from . import config
from .database import get_connection


def _get_client_config() -> dict:
    return {
        "web": {
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [config.OAUTH_REDIRECT_URI],
        }
    }


def create_auth_flow() -> Flow:
    """Create OAuth2 flow for Gmail authorization."""
    flow = Flow.from_client_config(
        _get_client_config(),
        scopes=config.GMAIL_SCOPES,
        redirect_uri=config.OAUTH_REDIRECT_URI,
    )
    return flow


def get_auth_url() -> str:
    """Generate the OAuth2 authorization URL."""
    flow = create_auth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url


def exchange_code(code: str) -> Credentials:
    """Exchange authorization code for credentials."""
    flow = create_auth_flow()
    flow.fetch_token(code=code)
    return flow.credentials


def store_credentials(creds: Credentials):
    """Store OAuth credentials in the database."""
    expiry = creds.expiry.isoformat() if creds.expiry else None
    scopes = json.dumps(list(creds.scopes)) if creds.scopes else None

    with get_connection() as conn:
        conn.execute("DELETE FROM oauth_tokens")
        conn.execute(
            """INSERT INTO oauth_tokens (id, access_token, refresh_token, token_uri,
               client_id, client_secret, scopes, expiry, updated_at)
               VALUES (1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
            (
                creds.token,
                creds.refresh_token,
                creds.token_uri,
                creds.client_id,
                creds.client_secret,
                scopes,
                expiry,
            ),
        )
        conn.commit()


def load_credentials() -> Credentials | None:
    """Load stored OAuth credentials from the database."""
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM oauth_tokens WHERE id = 1").fetchone()

    if not row:
        return None

    scopes = json.loads(row["scopes"]) if row["scopes"] else config.GMAIL_SCOPES
    expiry = datetime.fromisoformat(row["expiry"]) if row["expiry"] else None

    creds = Credentials(
        token=row["access_token"],
        refresh_token=row["refresh_token"],
        token_uri=row["token_uri"],
        client_id=row["client_id"],
        client_secret=row["client_secret"],
        scopes=scopes,
    )
    creds.expiry = expiry
    return creds


def clear_credentials():
    """Remove stored credentials."""
    with get_connection() as conn:
        conn.execute("DELETE FROM oauth_tokens")
        conn.commit()


def get_valid_credentials() -> Credentials | None:
    """Load credentials and refresh if expired."""
    creds = load_credentials()
    if not creds:
        return None

    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        store_credentials(creds)

    if not creds.valid:
        return None

    return creds
