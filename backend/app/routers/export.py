from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from ..database import get_connection, dict_from_row
from ..docx_builder import build_emails_docx

router = APIRouter()


class ExportRequest(BaseModel):
    search_id: Optional[int] = None
    email_ids: Optional[list[int]] = None
    group_by: str = "none"


@router.post("/docx")
async def export_docx(request: ExportRequest):
    """Export emails as a Word document."""
    if not request.search_id and not request.email_ids:
        raise HTTPException(status_code=422, detail="Provide search_id or email_ids")

    with get_connection() as conn:
        if request.search_id:
            rows = conn.execute(
                """SELECT e.* FROM emails e
                   JOIN search_emails se ON e.id = se.email_id
                   WHERE se.search_id = ?
                   ORDER BY e.date DESC""",
                (request.search_id,),
            ).fetchall()
            title = f"Search #{request.search_id} Export"
        else:
            placeholders = ",".join("?" for _ in request.email_ids)
            rows = conn.execute(
                f"SELECT * FROM emails WHERE id IN ({placeholders}) ORDER BY date DESC",
                request.email_ids,
            ).fetchall()
            title = "Email Export"

    if not rows:
        raise HTTPException(status_code=404, detail="No emails found")

    emails = [dict_from_row(r) for r in rows]

    # Query attachments for all exported emails
    email_ids = [e["id"] for e in emails]
    attachments_by_email: dict[int, list[dict]] = {}
    if email_ids:
        with get_connection() as conn:
            ph = ",".join("?" for _ in email_ids)
            att_rows = conn.execute(
                f"SELECT * FROM attachments WHERE email_id IN ({ph})",
                email_ids,
            ).fetchall()
        for ar in att_rows:
            ad = dict_from_row(ar)
            attachments_by_email.setdefault(ad["email_id"], []).append(ad)

    docx_bytes = build_emails_docx(emails, group_by=request.group_by, title=title, attachments_by_email=attachments_by_email)

    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="inboxforge-export.docx"'},
    )


@router.post("/docx/single/{email_id}")
async def export_single_email_docx(email_id: int):
    """Export a single email as a Word document."""
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM emails WHERE id = ?", (email_id,)).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Email not found")

    email = dict_from_row(row)
    subject = email.get("subject") or "email"

    # Query attachments for this email
    with get_connection() as conn:
        att_rows = conn.execute(
            "SELECT * FROM attachments WHERE email_id = ?", (email_id,)
        ).fetchall()
    attachments_by_email: dict[int, list[dict]] = {}
    if att_rows:
        attachments_by_email[email_id] = [dict_from_row(ar) for ar in att_rows]

    docx_bytes = build_emails_docx([email], title=subject, attachments_by_email=attachments_by_email)

    safe_name = "".join(c for c in subject[:50] if c.isalnum() or c in " -_").strip() or "email"

    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.docx"'},
    )
