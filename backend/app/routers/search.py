import logging

from fastapi import APIRouter, HTTPException
from sqlite3 import IntegrityError

from ..oauth import get_valid_credentials
from ..gmail_client import get_gmail_service, build_search_query, search_messages, fetch_message, download_attachment
from ..attachment_storage import save_attachment
from ..database import get_connection, dict_from_row
from ..models import SearchRequest, SearchResponse, SearchHistoryItem, EmailSummary

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=SearchResponse)
async def search_gmail(request: SearchRequest):
    """Search Gmail for emails matching keywords and date range, store results."""
    # Validate at least one filter is set
    has_filter = bool(
        request.keywords.strip()
        or (request.senders and request.senders.strip())
        or (request.subject_keywords and request.subject_keywords.strip())
        or request.has_attachment
    )
    if not has_filter:
        raise HTTPException(status_code=422, detail="At least one search filter (keywords, senders, or subject keywords) is required.")

    creds = get_valid_credentials()
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated with Gmail. Please connect your account first.")

    # Create search history record
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO search_history (keywords, senders, subject_keywords, filter_logic, date_from, date_to, status)
               VALUES (?, ?, ?, ?, ?, ?, 'running')""",
            (request.keywords, request.senders, request.subject_keywords, request.filter_logic, request.date_from, request.date_to),
        )
        search_id = cursor.lastrowid
        conn.commit()

    try:
        service = get_gmail_service(creds)
        query = build_search_query(
            keywords=request.keywords,
            date_from=request.date_from,
            date_to=request.date_to,
            senders=request.senders,
            subject_keywords=request.subject_keywords,
            filter_logic=request.filter_logic,
            has_attachment=request.has_attachment,
        )
        message_ids = search_messages(service, query)

        new_count = 0
        dup_count = 0

        with get_connection() as conn:
            for msg_id in message_ids:
                # Check if email already exists
                existing = conn.execute(
                    "SELECT id FROM emails WHERE message_id = ?", (msg_id,)
                ).fetchone()

                if existing:
                    # Email already stored — link to this search as duplicate
                    dup_count += 1
                    try:
                        conn.execute(
                            "INSERT INTO search_emails (search_id, email_id, is_new) VALUES (?, ?, 0)",
                            (search_id, existing["id"]),
                        )
                    except IntegrityError:
                        pass
                else:
                    # Fetch and store new email
                    try:
                        parsed = fetch_message(service, msg_id)
                        cursor = conn.execute(
                            """INSERT INTO emails (message_id, thread_id, subject, sender, recipient,
                               date, body_text, body_html, snippet, labels)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            (
                                parsed["message_id"],
                                parsed["thread_id"],
                                parsed["subject"],
                                parsed["sender"],
                                parsed["recipient"],
                                parsed["date"],
                                parsed["body_text"],
                                parsed["body_html"],
                                parsed["snippet"],
                                parsed["labels"],
                            ),
                        )
                        email_id = cursor.lastrowid

                        # Download attachments for this email
                        for att in parsed.get("attachments", []):
                            try:
                                att_data = download_attachment(service, msg_id, att["attachment_id"])
                                rel_path = save_attachment(msg_id, att["filename"], att_data)
                                conn.execute(
                                    """INSERT INTO attachments (email_id, gmail_attachment_id, filename, mime_type, size, file_path)
                                       VALUES (?, ?, ?, ?, ?, ?)""",
                                    (email_id, att["attachment_id"], att["filename"],
                                     att["mime_type"], att["size"], rel_path),
                                )
                            except Exception as att_err:
                                logger.warning("Failed to download attachment %s: %s", att.get("filename"), att_err)
                        conn.execute(
                            "UPDATE emails SET attachments_checked = 1 WHERE id = ?",
                            (email_id,),
                        )

                        conn.execute(
                            "INSERT INTO search_emails (search_id, email_id, is_new) VALUES (?, ?, 1)",
                            (search_id, email_id),
                        )
                        new_count += 1
                    except IntegrityError:
                        # Race condition: email was inserted between check and insert
                        dup_count += 1
                        existing = conn.execute(
                            "SELECT id FROM emails WHERE message_id = ?", (msg_id,)
                        ).fetchone()
                        if existing:
                            try:
                                conn.execute(
                                    "INSERT INTO search_emails (search_id, email_id, is_new) VALUES (?, ?, 0)",
                                    (search_id, existing["id"]),
                                )
                            except IntegrityError:
                                pass
                    except Exception:
                        # Skip individual message failures
                        continue

            # Update search history
            conn.execute(
                """UPDATE search_history
                   SET results_count = ?, new_emails_count = ?, duplicate_count = ?, status = 'completed'
                   WHERE id = ?""",
                (len(message_ids), new_count, dup_count, search_id),
            )
            conn.commit()

        return SearchResponse(
            search_id=search_id,
            keywords=request.keywords,
            senders=request.senders,
            subject_keywords=request.subject_keywords,
            filter_logic=request.filter_logic,
            date_from=request.date_from,
            date_to=request.date_to,
            results_count=len(message_ids),
            new_emails_count=new_count,
            duplicate_count=dup_count,
            status="completed",
        )

    except HTTPException:
        raise
    except Exception as e:
        with get_connection() as conn:
            conn.execute(
                "UPDATE search_history SET status = 'error', error_message = ? WHERE id = ?",
                (str(e), search_id),
            )
            conn.commit()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/history", response_model=list[SearchHistoryItem])
async def search_history():
    """List past searches."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM search_history ORDER BY created_at DESC LIMIT 50"
        ).fetchall()
    return [SearchHistoryItem(**dict_from_row(r)) for r in rows]


@router.get("/history/{search_id}/emails", response_model=list[EmailSummary])
async def search_emails(search_id: int):
    """Get emails from a specific past search."""
    with get_connection() as conn:
        # Verify search exists
        search = conn.execute(
            "SELECT id FROM search_history WHERE id = ?", (search_id,)
        ).fetchone()
        if not search:
            raise HTTPException(status_code=404, detail="Search not found")

        rows = conn.execute(
            """SELECT e.id, e.message_id, e.subject, e.sender, e.date, e.snippet,
                      se.is_new
               FROM emails e
               JOIN search_emails se ON e.id = se.email_id
               WHERE se.search_id = ?
               ORDER BY e.date DESC""",
            (search_id,),
        ).fetchall()

    return [
        EmailSummary(
            id=r["id"],
            message_id=r["message_id"],
            subject=r["subject"],
            sender=r["sender"],
            date=r["date"],
            snippet=r["snippet"],
            is_new=bool(r["is_new"]),
        )
        for r in rows
    ]
