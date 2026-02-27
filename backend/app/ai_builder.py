"""AI-powered book builder using Claude API."""

import json
import logging

import anthropic

from .config import ANTHROPIC_API_KEY

logger = logging.getLogger(__name__)

_client = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        if not ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY not set in .env")
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def _truncate(text: str, max_chars: int = 500) -> str:
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "..."


def _build_email_summaries(emails: list[dict], include_body: bool = True) -> str:
    """Build a text summary of emails for the AI prompt."""
    max_body = 500 if len(emails) <= 50 else 200
    parts = []
    for i, email in enumerate(emails):
        lines = [
            f"Email {i} (index {i}):",
            f"  Subject: {email.get('subject', '(no subject)')}",
            f"  From: {email.get('sender', 'Unknown')}",
            f"  Date: {email.get('date', 'Unknown')}",
        ]
        if include_body:
            body = _truncate(email.get("body_text", ""), max_body)
            if body:
                lines.append(f"  Content: {body}")
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


def suggest_book_title(emails: list[dict]) -> str:
    """Analyze collection emails and suggest a book title."""
    client = _get_client()
    summaries = _build_email_summaries(emails, include_body=True)

    message = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=200,
        messages=[
            {
                "role": "user",
                "content": f"""You are analyzing a collection of {len(emails)} emails to suggest a book title.

Here are the emails:

{summaries}

Based on the themes, time period, relationships, and content of these emails, suggest a compelling and descriptive book title. Return ONLY the title text, nothing else — no quotes, no explanation.""",
            }
        ],
    )

    title = message.content[0].text.strip().strip('"\'')
    logger.info("AI suggested title: %s", title)
    return title


def suggest_chapters(
    emails: list[dict], title: str, chapter_count: int
) -> list[dict]:
    """Analyze emails and suggest chapter groupings."""
    client = _get_client()
    summaries = _build_email_summaries(emails, include_body=True)

    message = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": f"""You are organizing {len(emails)} emails into {chapter_count} chapters for a book titled "{title}".

Here are the emails:

{summaries}

Please organize these emails into exactly {chapter_count} chapters. For each chapter:
1. Choose a descriptive chapter title that captures the theme
2. List which emails belong in that chapter by their index numbers

Rules:
- Every email must be assigned to exactly one chapter
- Email indices range from 0 to {len(emails) - 1}
- Group emails by theme, time period, or narrative connection
- Order chapters in a logical narrative flow

Return ONLY valid JSON in this exact format, no other text:
[
  {{"chapter_title": "Chapter Title Here", "email_indices": [0, 1, 2]}},
  {{"chapter_title": "Another Chapter", "email_indices": [3, 4]}}
]""",
            }
        ],
    )

    raw = message.content[0].text.strip()
    # Extract JSON from response (handle markdown code blocks)
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
    raw = raw.strip()

    chapters = json.loads(raw)
    logger.info("AI suggested %d chapters", len(chapters))
    return chapters
