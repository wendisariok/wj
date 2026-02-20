import base64
import re
from datetime import datetime
from typing import Optional
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials


def get_gmail_service(creds: Credentials):
    """Build Gmail API service."""
    return build("gmail", "v1", credentials=creds)


def build_search_query(
    keywords: str = "",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    senders: Optional[str] = None,
    subject_keywords: Optional[str] = None,
    filter_logic: str = "and",
    has_attachment: bool = False,
) -> str:
    """Build a Gmail search query string with structured filters.

    - senders: comma-separated email addresses → (from:a OR from:b)
    - subject_keywords: space-separated words → subject:word1 subject:word2
    - keywords: bare text for body/general search
    - filter_logic: "and" (all must match) or "or" (any can match)
    """
    # Build each category as a self-contained group
    category_parts = []

    if senders:
        addrs = [s.strip() for s in senders.split(",") if s.strip()]
        if len(addrs) == 1:
            category_parts.append(f"from:{addrs[0]}")
        elif addrs:
            category_parts.append("(" + " OR ".join(f"from:{a}" for a in addrs) + ")")

    if subject_keywords:
        words = subject_keywords.split()
        if len(words) == 1:
            category_parts.append(f"subject:{words[0]}")
        else:
            # Group multiple subject keywords so they stay together in OR mode
            category_parts.append("(" + " ".join(f"subject:{w}" for w in words) + ")")

    if keywords:
        # Group multi-word body keywords so they stay together in OR mode
        if " " in keywords and filter_logic == "or":
            category_parts.append(f"({keywords})")
        else:
            category_parts.append(keywords)

    # Combine categories with AND or OR
    if filter_logic == "or" and len(category_parts) > 1:
        combined = " OR ".join(category_parts)
        query_parts = [f"({combined})"]
    else:
        query_parts = category_parts

    # These filters are always ANDed — they constrain results regardless
    if has_attachment:
        query_parts.append("has:attachment")
    if date_from:
        query_parts.append(f"after:{date_from}")
    if date_to:
        query_parts.append(f"before:{date_to}")

    return " ".join(query_parts)


def search_messages(service, query: str, max_results: int = 500) -> list[str]:
    """Search Gmail and return list of message IDs."""
    message_ids = []
    page_token = None

    while True:
        result = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=min(max_results - len(message_ids), 100),
            pageToken=page_token,
        ).execute()

        messages = result.get("messages", [])
        message_ids.extend(msg["id"] for msg in messages)

        if len(message_ids) >= max_results:
            break

        page_token = result.get("nextPageToken")
        if not page_token:
            break

    return message_ids


def fetch_message(service, message_id: str) -> dict:
    """Fetch a single message's full details."""
    msg = service.users().messages().get(
        userId="me",
        id=message_id,
        format="full",
    ).execute()
    return parse_message(msg)


def parse_message(msg: dict) -> dict:
    """Parse a Gmail API message into a flat dict."""
    headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}

    body_text, body_html = _extract_body(msg.get("payload", {}))

    date_str = headers.get("date", "")
    parsed_date = _parse_date(date_str)

    return {
        "message_id": msg["id"],
        "thread_id": msg.get("threadId"),
        "subject": headers.get("subject"),
        "sender": headers.get("from"),
        "recipient": headers.get("to"),
        "date": parsed_date,
        "body_text": body_text,
        "body_html": body_html,
        "snippet": msg.get("snippet"),
        "labels": ",".join(msg.get("labelIds", [])),
        "attachments": extract_attachment_metadata(msg.get("payload", {})),
    }


def _extract_body(payload: dict) -> tuple[str | None, str | None]:
    """Extract text and HTML body from message payload."""
    body_text = None
    body_html = None

    mime_type = payload.get("mimeType", "")

    if mime_type == "text/plain":
        body_text = _decode_body(payload.get("body", {}))
    elif mime_type == "text/html":
        body_html = _decode_body(payload.get("body", {}))
    elif "parts" in payload:
        for part in payload["parts"]:
            part_mime = part.get("mimeType", "")
            if part_mime == "text/plain" and not body_text:
                body_text = _decode_body(part.get("body", {}))
            elif part_mime == "text/html" and not body_html:
                body_html = _decode_body(part.get("body", {}))
            elif part_mime.startswith("multipart/") and "parts" in part:
                sub_text, sub_html = _extract_body(part)
                if sub_text and not body_text:
                    body_text = sub_text
                if sub_html and not body_html:
                    body_html = sub_html

    return body_text, body_html


def _decode_body(body: dict) -> str | None:
    """Decode base64url encoded body data."""
    data = body.get("data")
    if not data:
        return None
    return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")


def _parse_date(date_str: str) -> str | None:
    """Parse email date header into ISO format."""
    if not date_str:
        return None

    # Remove timezone abbreviation in parentheses
    date_str = re.sub(r"\s*\([^)]*\)\s*$", "", date_str).strip()

    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S",
        "%d %b %Y %H:%M:%S",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).isoformat()
        except ValueError:
            continue

    return date_str


def extract_attachment_metadata(payload: dict) -> list[dict]:
    """Recursively walk MIME parts, collect attachment metadata."""
    attachments = []
    _collect_attachments(payload, attachments)
    return attachments


def _collect_attachments(part: dict, result: list[dict]):
    """Recursively collect attachment info from MIME parts."""
    filename = part.get("filename")
    body = part.get("body", {})
    attachment_id = body.get("attachmentId")

    # A part is an attachment if it has a filename or an attachmentId
    if filename and attachment_id:
        result.append({
            "attachment_id": attachment_id,
            "filename": filename,
            "mime_type": part.get("mimeType"),
            "size": body.get("size", 0),
        })

    for sub_part in part.get("parts", []):
        _collect_attachments(sub_part, result)


def download_attachment(service, message_id: str, attachment_id: str) -> bytes:
    """Download attachment data from Gmail API."""
    att = service.users().messages().attachments().get(
        userId="me",
        messageId=message_id,
        id=attachment_id,
    ).execute()
    data = att.get("data", "")
    return base64.urlsafe_b64decode(data)


def get_user_email(service) -> str | None:
    """Get the authenticated user's email address."""
    try:
        profile = service.users().getProfile(userId="me").execute()
        return profile.get("emailAddress")
    except Exception:
        return None
