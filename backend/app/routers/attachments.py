import logging
import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..database import get_connection, dict_from_row
from ..models import AttachmentInfo, BackfillResponse
from ..attachment_storage import get_absolute_path, attachment_exists, save_attachment, build_search_folder_name, link_into_search_folder, sanitize_filename
from .. import config
from ..oauth import get_valid_credentials
from ..gmail_client import get_gmail_service, extract_attachment_metadata, download_attachment

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/search/{search_id}/count")
async def get_search_attachment_count(search_id: int):
    """Get the number of attachments for emails in a search."""
    with get_connection() as conn:
        row = conn.execute(
            """SELECT COUNT(*) as count FROM attachments a
               JOIN search_emails se ON a.email_id = se.email_id
               WHERE se.search_id = ?""",
            (search_id,),
        ).fetchone()
    return {"count": row["count"]}


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
async def backfill_attachments(search_id: int | None = None, force: bool = False):
    """Re-fetch emails from Gmail and download their attachments.

    If search_id is provided, only process emails from that search.
    If force is True, re-process even already-checked emails (skips existing attachment records).
    Otherwise, process all unchecked emails.
    """
    creds = get_valid_credentials()
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated with Gmail.")

    service = get_gmail_service(creds)

    search_folder = ""
    with get_connection() as conn:
        if search_id:
            # Get search info for folder naming
            search_row = conn.execute(
                "SELECT * FROM search_history WHERE id = ?", (search_id,)
            ).fetchone()
            if not search_row:
                raise HTTPException(status_code=404, detail="Search not found")
            search_folder = build_search_folder_name(dict(search_row))

            if force:
                # Reset checked flag and clear existing attachment records for this search
                email_ids_rows = conn.execute(
                    "SELECT email_id FROM search_emails WHERE search_id = ?", (search_id,)
                ).fetchall()
                email_ids = [r["email_id"] for r in email_ids_rows]
                if email_ids:
                    ph = ",".join("?" for _ in email_ids)
                    conn.execute(f"DELETE FROM attachments WHERE email_id IN ({ph})", email_ids)
                    conn.execute(f"UPDATE emails SET attachments_checked = 0 WHERE id IN ({ph})", email_ids)
                    conn.commit()

            unchecked = conn.execute(
                """SELECT e.id, e.message_id FROM emails e
                   JOIN search_emails se ON e.id = se.email_id
                   WHERE se.search_id = ? AND e.attachments_checked = 0""",
                (search_id,),
            ).fetchall()
        else:
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
                        safe_name = sanitize_filename(att["filename"])
                        canonical_path = os.path.join(config.ATTACHMENTS_DIR, "_files", message_id, safe_name)
                        canonical_rel = f"_files/{message_id}/{safe_name}"

                        if os.path.exists(canonical_path):
                            # File already downloaded — just link into search folder
                            if search_folder:
                                link_into_search_folder(search_folder, message_id, safe_name, canonical_path)
                        else:
                            # Download from Gmail and save canonically + link
                            data = download_attachment(service, message_id, att["attachment_id"])
                            canonical_rel = save_attachment(message_id, att["filename"], data, search_folder=search_folder)

                        conn.execute(
                            """INSERT INTO attachments (email_id, gmail_attachment_id, filename, mime_type, size, file_path)
                               VALUES (?, ?, ?, ?, ?, ?)""",
                            (email_id, att["attachment_id"], att["filename"],
                             att["mime_type"], att["size"], canonical_rel),
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
