import io
from sqlite3 import IntegrityError

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..database import get_connection, dict_from_row
from ..models import (
    CollectionCreate,
    CollectionUpdate,
    CollectionSummary,
    CollectionDetail,
    CollectionEmailItem,
    AddEmailToCollection,
    ReorderCollectionEmails,
    UpdateCollectionEmail,
)
from ..docx_builder import build_collection_docx

router = APIRouter()


@router.get("/", response_model=list[CollectionSummary])
async def list_collections():
    """List all collections with email counts."""
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT c.*, COUNT(ce.id) as email_count
               FROM collections c
               LEFT JOIN collection_emails ce ON c.id = ce.collection_id
               GROUP BY c.id
               ORDER BY c.updated_at DESC"""
        ).fetchall()

    return [
        CollectionSummary(
            id=r["id"],
            name=r["name"],
            description=r["description"],
            email_count=r["email_count"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
        for r in rows
    ]


@router.post("/", response_model=CollectionSummary)
async def create_collection(request: CollectionCreate):
    """Create a new collection."""
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO collections (name, description) VALUES (?, ?)",
            (request.name, request.description),
        )
        conn.commit()
        cid = cursor.lastrowid

    return CollectionSummary(
        id=cid,
        name=request.name,
        description=request.description,
        email_count=0,
        created_at=None,
        updated_at=None,
    )


@router.get("/{collection_id}", response_model=CollectionDetail)
async def get_collection(collection_id: int):
    """Get a collection with its ordered emails."""
    with get_connection() as conn:
        coll = conn.execute(
            "SELECT * FROM collections WHERE id = ?", (collection_id,)
        ).fetchone()
        if not coll:
            raise HTTPException(status_code=404, detail="Collection not found")

        rows = conn.execute(
            """SELECT ce.id, ce.email_id, ce.sort_order, ce.chapter_title,
                      e.subject, e.sender, e.date, e.snippet
               FROM collection_emails ce
               JOIN emails e ON ce.email_id = e.id
               WHERE ce.collection_id = ?
               ORDER BY ce.sort_order""",
            (collection_id,),
        ).fetchall()

    emails = [
        CollectionEmailItem(
            id=r["id"],
            email_id=r["email_id"],
            sort_order=r["sort_order"],
            chapter_title=r["chapter_title"] or "",
            subject=r["subject"],
            sender=r["sender"],
            date=r["date"],
            snippet=r["snippet"],
        )
        for r in rows
    ]

    return CollectionDetail(
        id=coll["id"],
        name=coll["name"],
        description=coll["description"],
        created_at=coll["created_at"],
        updated_at=coll["updated_at"],
        emails=emails,
    )


@router.put("/{collection_id}", response_model=CollectionSummary)
async def update_collection(collection_id: int, request: CollectionUpdate):
    """Update collection name/description."""
    with get_connection() as conn:
        coll = conn.execute(
            "SELECT * FROM collections WHERE id = ?", (collection_id,)
        ).fetchone()
        if not coll:
            raise HTTPException(status_code=404, detail="Collection not found")

        name = request.name if request.name is not None else coll["name"]
        desc = request.description if request.description is not None else coll["description"]

        conn.execute(
            "UPDATE collections SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?",
            (name, desc, collection_id),
        )
        conn.commit()

        count = conn.execute(
            "SELECT COUNT(*) as cnt FROM collection_emails WHERE collection_id = ?",
            (collection_id,),
        ).fetchone()["cnt"]

    return CollectionSummary(
        id=collection_id,
        name=name,
        description=desc,
        email_count=count,
        created_at=coll["created_at"],
        updated_at=None,
    )


@router.delete("/{collection_id}")
async def delete_collection(collection_id: int):
    """Delete a collection (emails remain in DB)."""
    with get_connection() as conn:
        coll = conn.execute(
            "SELECT id FROM collections WHERE id = ?", (collection_id,)
        ).fetchone()
        if not coll:
            raise HTTPException(status_code=404, detail="Collection not found")

        conn.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
        conn.commit()

    return {"ok": True}


@router.post("/{collection_id}/emails", response_model=CollectionEmailItem)
async def add_email_to_collection(collection_id: int, request: AddEmailToCollection):
    """Add an email to a collection."""
    with get_connection() as conn:
        # Verify collection and email exist
        coll = conn.execute("SELECT id FROM collections WHERE id = ?", (collection_id,)).fetchone()
        if not coll:
            raise HTTPException(status_code=404, detail="Collection not found")

        email = conn.execute("SELECT id, subject, sender, date, snippet FROM emails WHERE id = ?", (request.email_id,)).fetchone()
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")

        # Get next sort_order
        max_order = conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM collection_emails WHERE collection_id = ?",
            (collection_id,),
        ).fetchone()["max_order"]

        try:
            cursor = conn.execute(
                "INSERT INTO collection_emails (collection_id, email_id, sort_order, chapter_title) VALUES (?, ?, ?, ?)",
                (collection_id, request.email_id, max_order + 1, request.chapter_title),
            )
            conn.execute(
                "UPDATE collections SET updated_at = datetime('now') WHERE id = ?",
                (collection_id,),
            )
            conn.commit()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="Email already in collection")

    return CollectionEmailItem(
        id=cursor.lastrowid,
        email_id=request.email_id,
        sort_order=max_order + 1,
        chapter_title=request.chapter_title,
        subject=email["subject"],
        sender=email["sender"],
        date=email["date"],
        snippet=email["snippet"],
    )


@router.delete("/{collection_id}/emails/{entry_id}")
async def remove_email_from_collection(collection_id: int, entry_id: int):
    """Remove an email from a collection."""
    with get_connection() as conn:
        entry = conn.execute(
            "SELECT id FROM collection_emails WHERE id = ? AND collection_id = ?",
            (entry_id, collection_id),
        ).fetchone()
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")

        conn.execute("DELETE FROM collection_emails WHERE id = ?", (entry_id,))
        conn.execute(
            "UPDATE collections SET updated_at = datetime('now') WHERE id = ?",
            (collection_id,),
        )
        conn.commit()

    return {"ok": True}


@router.put("/{collection_id}/emails/{entry_id}", response_model=CollectionEmailItem)
async def update_collection_email(collection_id: int, entry_id: int, request: UpdateCollectionEmail):
    """Update the chapter title of a collection email entry."""
    with get_connection() as conn:
        entry = conn.execute(
            """SELECT ce.*, e.subject, e.sender, e.date, e.snippet
               FROM collection_emails ce
               JOIN emails e ON ce.email_id = e.id
               WHERE ce.id = ? AND ce.collection_id = ?""",
            (entry_id, collection_id),
        ).fetchone()
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")

        conn.execute(
            "UPDATE collection_emails SET chapter_title = ? WHERE id = ?",
            (request.chapter_title, entry_id),
        )
        conn.execute(
            "UPDATE collections SET updated_at = datetime('now') WHERE id = ?",
            (collection_id,),
        )
        conn.commit()

    return CollectionEmailItem(
        id=entry_id,
        email_id=entry["email_id"],
        sort_order=entry["sort_order"],
        chapter_title=request.chapter_title,
        subject=entry["subject"],
        sender=entry["sender"],
        date=entry["date"],
        snippet=entry["snippet"],
    )


@router.post("/{collection_id}/reorder")
async def reorder_collection_emails(collection_id: int, request: ReorderCollectionEmails):
    """Reorder emails in a collection by providing ordered entry IDs."""
    with get_connection() as conn:
        coll = conn.execute("SELECT id FROM collections WHERE id = ?", (collection_id,)).fetchone()
        if not coll:
            raise HTTPException(status_code=404, detail="Collection not found")

        for i, entry_id in enumerate(request.entry_ids):
            conn.execute(
                "UPDATE collection_emails SET sort_order = ? WHERE id = ? AND collection_id = ?",
                (i, entry_id, collection_id),
            )

        conn.execute(
            "UPDATE collections SET updated_at = datetime('now') WHERE id = ?",
            (collection_id,),
        )
        conn.commit()

    return {"ok": True}


@router.post("/{collection_id}/export/docx")
async def export_collection_docx(collection_id: int):
    """Export a collection as a structured book in .docx format."""
    with get_connection() as conn:
        coll = conn.execute(
            "SELECT * FROM collections WHERE id = ?", (collection_id,)
        ).fetchone()
        if not coll:
            raise HTTPException(status_code=404, detail="Collection not found")

        rows = conn.execute(
            """SELECT ce.chapter_title, e.*
               FROM collection_emails ce
               JOIN emails e ON ce.email_id = e.id
               WHERE ce.collection_id = ?
               ORDER BY ce.sort_order""",
            (collection_id,),
        ).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="Collection has no emails")

    entries = [dict_from_row(r) for r in rows]
    docx_bytes = build_collection_docx(
        title=coll["name"],
        description=coll["description"],
        entries=entries,
    )

    safe_name = "".join(c for c in coll["name"][:50] if c.isalnum() or c in " -_").strip() or "collection"

    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.docx"'},
    )
