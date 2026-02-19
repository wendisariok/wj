import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..database import get_connection, dict_from_row
from ..models import AttachmentInfo, BackfillResponse
from ..attachment_storage import get_absolute_path, attachment_exists, save_attachment
from ..oauth import get_valid_credentials
from ..gmail_client import get_gmail_service, extract_attachment_metadata, download_attachment

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/email/{email_id}", response_model=list[AttachmentInfo])
async def list_attachments(email_id: int):
    """List attachments for an email."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, email_id, filename, mime_type, size, created_at FROM attachments WHERE email_id = ?",
            (email_id,),
        ).fetchall()
    return [AttachmentInfo(**dict_from_row(r)) for r in rows]


@router.get("/{attachment_id}/download")
async def download_attachment_file(attachment_id: int):
    """Serve an attachment file."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM attachments WHERE id = ?", (attachment_id,)
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Attachment not found")

    att = dict_from_row(row)
    abs_path = get_absolute_path(att["file_path"])

    if not attachment_exists(att["file_path"]):
        raise HTTPException(status_code=404, detail="Attachment file missing from disk")

    return FileResponse(
        path=abs_path,
        filename=att["filename"],
        media_type=att["mime_type"] or "application/octet-stream",
    )


@router.post("/backfill", response_model=BackfillResponse)
async def backfill_attachments():
    """Re-fetch all unchecked emails from Gmail and download their attachments."""
    creds = get_valid_credentials()
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated with Gmail.")

    service = get_gmail_service(creds)

    with get_connection() as conn:
        unchecked = conn.execute(
            "SELECT id, message_id FROM emails WHERE attachments_checked = 0"
        ).fetchall()

    total = len(unchecked)
    processed = 0
    downloaded = 0
    errors = 0

    for email_row in unchecked:
        email_id = email_row["id"]
        message_id = email_row["message_id"]
        try:
            # Fetch full message to get attachment metadata
            msg = service.users().messages().get(
                userId="me", id=message_id, format="full"
            ).execute()
            att_meta = extract_attachment_metadata(msg.get("payload", {}))

            with get_connection() as conn:
                for att in att_meta:
                    try:
                        data = download_attachment(service, message_id, att["attachment_id"])
                        rel_path = save_attachment(message_id, att["filename"], data)
                        conn.execute(
                            """INSERT INTO attachments (email_id, gmail_attachment_id, filename, mime_type, size, file_path)
                               VALUES (?, ?, ?, ?, ?, ?)""",
                            (email_id, att["attachment_id"], att["filename"],
                             att["mime_type"], att["size"], rel_path),
                        )
                        downloaded += 1
                    except Exception as e:
                        logger.warning("Failed to download attachment %s for message %s: %s",
                                       att["filename"], message_id, e)
                        errors += 1

                conn.execute(
                    "UPDATE emails SET attachments_checked = 1 WHERE id = ?",
                    (email_id,),
                )
                conn.commit()
            processed += 1
        except Exception as e:
            logger.warning("Failed to process message %s: %s", message_id, e)
            errors += 1

    return BackfillResponse(
        total_emails=total,
        processed=processed,
        attachments_downloaded=downloaded,
        errors=errors,
        status="completed",
    )
