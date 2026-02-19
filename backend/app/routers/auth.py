from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from .. import config
from ..oauth import get_auth_url, exchange_code, store_credentials, clear_credentials, get_valid_credentials
from ..gmail_client import get_gmail_service, get_user_email
from ..models import AuthStatus, AuthLoginResponse

router = APIRouter()


@router.get("/status", response_model=AuthStatus)
async def auth_status():
    """Check if Gmail is authenticated."""
    creds = get_valid_credentials()
    if not creds:
        return AuthStatus(authenticated=False)

    service = get_gmail_service(creds)
    email = get_user_email(service)
    return AuthStatus(authenticated=True, email=email)


@router.get("/login")
async def auth_login():
    """Get OAuth2 authorization URL."""
    if not config.GOOGLE_CLIENT_ID or not config.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env")
    auth_url = get_auth_url()
    return AuthLoginResponse(auth_url=auth_url)


@router.get("/callback")
async def auth_callback(code: str = None, error: str = None):
    """Handle OAuth2 callback from Google."""
    if error:
        return RedirectResponse(url=f"{config.FRONTEND_URL}?auth_error={error}")

    if not code:
        raise HTTPException(status_code=400, detail="No authorization code received")

    try:
        creds = exchange_code(code)
        store_credentials(creds)
        return RedirectResponse(url=f"{config.FRONTEND_URL}?auth=success")
    except Exception as e:
        return RedirectResponse(url=f"{config.FRONTEND_URL}?auth_error={str(e)}")


@router.post("/logout")
async def auth_logout():
    """Clear stored credentials."""
    clear_credentials()
    return {"status": "logged_out"}
