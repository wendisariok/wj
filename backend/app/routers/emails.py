from fastapi import APIRouter, HTTPException

from ..database import get_connection, dict_from_row
from ..models import EmailDetail, AttachmentInfo

router = APIRouter()


@router.get("/{email_id}", response_model=EmailDetail)
async def get_email(email_id: int):
    """Get full email detail with attachments."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM emails WHERE id = ?", (email_id,)
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Email not found")

        att_rows = conn.execute(
            "SELECT id, email_id, filename, mime_type, size, created_at FROM attachments WHERE email_id = ?",
            (email_id,),
        ).fetchall()

    attachments = [AttachmentInfo(**dict_from_row(a)) for a in att_rows]
    email_data = dict_from_row(row)
    email_data["attachments"] = attachments
    return EmailDetail(**email_data)
