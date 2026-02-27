"""HTML rendering and PDF generation for collection book export."""

import html as html_mod
from datetime import datetime
from typing import Optional

import html2text


BOOK_STYLES = ("memoir", "reference", "correspondence")

# ---------------------------------------------------------------------------
# Shared helpers (same logic as docx_builder)
# ---------------------------------------------------------------------------

def _html_to_text(html: Optional[str]) -> str:
    if not html:
        return ""
    h = html2text.HTML2Text()
    h.ignore_links = False
    h.ignore_images = True
    h.body_width = 0
    return h.handle(html).strip()


def _get_email_body_html(email: dict) -> str:
    """Return the best available body as safe HTML."""
    if email.get("body_html"):
        return email["body_html"]
    text = email.get("body_text") or _html_to_text(email.get("body_html")) or email.get("snippet") or "(no content)"
    return "<p>" + html_mod.escape(text).replace("\n\n", "</p><p>").replace("\n", "<br>") + "</p>"


def _format_date(date_str: Optional[str]) -> str:
    if not date_str:
        return "Unknown date"
    try:
        dt = datetime.fromisoformat(date_str)
        return dt.strftime("%B %d, %Y %I:%M %p")
    except (ValueError, TypeError):
        return date_str


def _format_file_size(size: Optional[int]) -> str:
    if size is None or size == 0:
        return ""
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


def _esc(val: Optional[str]) -> str:
    return html_mod.escape(val or "")


# ---------------------------------------------------------------------------
# CSS per book style
# ---------------------------------------------------------------------------

_CSS_MEMOIR = """
    body { font-family: Georgia, 'Times New Roman', serif; color: #222; line-height: 1.7; }
    .title-page { text-align: center; padding: 3in 1in 1in 1in; page-break-after: always; }
    .title-page h1 { font-size: 2.4em; margin-bottom: 0.3em; font-weight: normal; letter-spacing: 0.02em; }
    .title-page .description { font-size: 1.1em; color: #666; font-style: italic; margin-bottom: 1em; }
    .title-page .export-date { font-size: 0.85em; color: #999; }
    .toc { page-break-after: always; padding: 1in; }
    .toc h2 { font-size: 1.5em; border-bottom: 2px solid #333; padding-bottom: 0.3em; }
    .toc ol { list-style: decimal; padding-left: 1.5em; }
    .toc li { margin: 0.5em 0; font-size: 1.05em; }
    .chapter { page-break-before: always; padding: 0.5in 1in; }
    .chapter h2 { font-size: 1.8em; text-align: center; margin-bottom: 0.2em; font-weight: normal;
                   border-bottom: 1px solid #ccc; padding-bottom: 0.4em; }
    .chapter .meta { font-style: italic; color: #777; text-align: center; margin-bottom: 1.5em; font-size: 0.9em; }
    .chapter .body { text-align: justify; }
    .chapter .body p { margin: 0.8em 0; text-indent: 1.5em; }
    .chapter .body p:first-child { text-indent: 0; }
    .attachments { margin-top: 1.5em; font-size: 0.85em; color: #888; }
    .attachments strong { color: #555; }
    @page { margin: 1in 1.2in; }
"""

_CSS_REFERENCE = """
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
           color: #222; line-height: 1.5; font-size: 10pt; }
    .title-page { text-align: center; padding: 2in 1in 1in 1in; page-break-after: always; }
    .title-page h1 { font-size: 2em; margin-bottom: 0.3em; }
    .title-page .description { font-size: 1em; color: #555; margin-bottom: 1em; }
    .title-page .export-date { font-size: 0.8em; color: #999; }
    .toc { page-break-after: always; padding: 0.5in; }
    .toc h2 { font-size: 1.3em; background: #eee; padding: 0.3em 0.5em; margin-bottom: 0.5em; }
    .toc ol { list-style: decimal; padding-left: 1.5em; }
    .toc li { margin: 0.3em 0; font-size: 0.95em; }
    .chapter { page-break-before: always; padding: 0.3in 0.5in; }
    .chapter h2 { font-size: 1.3em; background: #e8e8e8; padding: 0.3em 0.5em; margin-bottom: 0.5em; }
    .chapter .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 1em; font-size: 0.9em; }
    .chapter .meta-table td { padding: 0.25em 0.5em; border-bottom: 1px solid #ddd; }
    .chapter .meta-table td.label { font-weight: bold; width: 80px; color: #555; background: #f8f8f8; }
    .chapter .body { }
    .chapter .body p { margin: 0.5em 0; }
    .attachments { margin-top: 1em; font-size: 0.85em; color: #666; border-top: 1px solid #ddd; padding-top: 0.5em; }
    @page { margin: 0.75in; }
"""

_CSS_CORRESPONDENCE = """
    body { font-family: Georgia, 'Times New Roman', serif; color: #222; line-height: 1.6; }
    .title-page { text-align: center; padding: 3in 1in 1in 1in; page-break-after: always; }
    .title-page h1 { font-family: 'Courier New', Courier, monospace; font-size: 2em; margin-bottom: 0.3em; }
    .title-page .description { font-size: 1em; color: #666; margin-bottom: 1em; }
    .title-page .export-date { font-size: 0.85em; color: #999; }
    .toc { page-break-after: always; padding: 1in; }
    .toc h2 { font-family: 'Courier New', Courier, monospace; font-size: 1.3em; margin-bottom: 0.5em; }
    .toc ol { list-style: decimal; padding-left: 1.5em; }
    .toc li { margin: 0.4em 0; }
    .chapter { page-break-before: always; padding: 0.5in 1in; }
    .chapter .date-line { font-family: 'Courier New', Courier, monospace; text-align: right;
                          color: #555; margin-bottom: 0.5em; font-size: 0.95em; }
    .chapter h2 { font-family: 'Courier New', Courier, monospace; font-size: 1.3em;
                   margin-bottom: 0.1em; font-weight: normal; }
    .chapter .from-line { font-family: 'Courier New', Courier, monospace; color: #555;
                          margin-bottom: 1.5em; font-size: 0.9em; }
    .chapter hr { border: none; border-top: 1px solid #aaa; margin: 1.5em 0; }
    .chapter .body p { margin: 0.7em 0; }
    .attachments { margin-top: 1.5em; font-size: 0.85em; color: #888; }
    @page { margin: 1in; }
"""

_STYLE_CSS = {
    "memoir": _CSS_MEMOIR,
    "reference": _CSS_REFERENCE,
    "correspondence": _CSS_CORRESPONDENCE,
}

# ---------------------------------------------------------------------------
# HTML builders per style
# ---------------------------------------------------------------------------

def _build_email_memoir(entry: dict, attachments: list[dict]) -> str:
    sender = _esc(entry.get("sender") or "Unknown")
    date = _esc(_format_date(entry.get("date")))
    body = _get_email_body_html(entry)
    att_html = _build_attachments_html(attachments)
    return f"""
        <div class="meta">{sender} &mdash; {date}</div>
        <div class="body">{body}</div>
        {att_html}"""


def _build_email_reference(entry: dict, attachments: list[dict]) -> str:
    sender = _esc(entry.get("sender") or "Unknown")
    recipient = _esc(entry.get("recipient") or "Unknown")
    date = _esc(_format_date(entry.get("date")))
    body = _get_email_body_html(entry)
    att_html = _build_attachments_html(attachments)
    return f"""
        <table class="meta-table">
            <tr><td class="label">From</td><td>{sender}</td></tr>
            <tr><td class="label">To</td><td>{recipient}</td></tr>
            <tr><td class="label">Date</td><td>{date}</td></tr>
        </table>
        <div class="body">{body}</div>
        {att_html}"""


def _build_email_correspondence(entry: dict, attachments: list[dict]) -> str:
    sender = _esc(entry.get("sender") or "Unknown")
    date = _esc(_format_date(entry.get("date")))
    body = _get_email_body_html(entry)
    att_html = _build_attachments_html(attachments)
    return f"""
        <div class="date-line">{date}</div>
        <div class="from-line">From: {sender}</div>
        <hr>
        <div class="body">{body}</div>
        {att_html}"""


_EMAIL_BUILDERS = {
    "memoir": _build_email_memoir,
    "reference": _build_email_reference,
    "correspondence": _build_email_correspondence,
}


def _build_attachments_html(attachments: list[dict]) -> str:
    if not attachments:
        return ""
    items = []
    for att in attachments:
        filename = _esc(att.get("filename") or "unnamed")
        size_str = _format_file_size(att.get("size"))
        label = filename + (f" ({size_str})" if size_str else "")
        items.append(f"<div>{label}</div>")
    return '<div class="attachments"><strong>Attachments:</strong>' + "".join(items) + "</div>"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_collection_html(
    title: str,
    description: str,
    entries: list[dict],
    attachments_by_email: Optional[dict[int, list[dict]]] = None,
    book_style: str = "memoir",
) -> str:
    """Render a collection as a styled HTML book.

    Args:
        title: Book title.
        description: Book description / subtitle.
        entries: Ordered list of email dicts (with chapter_title, subject, sender, etc.).
        attachments_by_email: Optional mapping email_id -> attachment dicts.
        book_style: One of 'memoir', 'reference', 'correspondence'.

    Returns:
        Complete HTML document string.
    """
    if book_style not in _STYLE_CSS:
        book_style = "memoir"

    att_map = attachments_by_email or {}
    css = _STYLE_CSS[book_style]
    email_builder = _EMAIL_BUILDERS[book_style]

    export_date = datetime.now().strftime("%B %d, %Y")

    # Group entries by chapter_title (consecutive entries with same title = one chapter)
    chapter_groups: list[dict] = []
    for entry in entries:
        ch_title = entry.get("chapter_title") or entry.get("subject") or "Untitled"
        if not chapter_groups or chapter_groups[-1]["title"] != ch_title:
            chapter_groups.append({"title": ch_title, "emails": []})
        chapter_groups[-1]["emails"].append(entry)

    # Title page
    title_html = f"""
    <div class="title-page">
        <h1>{_esc(title)}</h1>
        <div class="description">{_esc(description)}</div>
        <div class="export-date">Exported {_esc(export_date)}</div>
    </div>"""

    # Table of contents
    toc_items = []
    for i, group in enumerate(chapter_groups, 1):
        chapter = _esc(group["title"])
        toc_items.append(f'<li><a href="#ch-{i}">{chapter}</a></li>')

    toc_html = f"""
    <div class="toc">
        <h2>Table of Contents</h2>
        <ol>{"".join(toc_items)}</ol>
    </div>""" if toc_items else ""

    # Chapters
    chapters_html = []
    for i, group in enumerate(chapter_groups, 1):
        email_parts = []
        for entry in group["emails"]:
            email_id = entry.get("id") or entry.get("email_id")
            atts = att_map.get(email_id, [])
            email_parts.append(email_builder(entry, atts))
        chapters_html.append(f"""
    <div class="chapter" id="ch-{i}">
        <h2>{_esc(group["title"])}</h2>
        {"".join(email_parts)}
    </div>""")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{_esc(title)}</title>
<style>{css}</style>
</head>
<body>
{title_html}
{toc_html}
{"".join(chapters_html)}
</body>
</html>"""


def build_collection_pdf(
    title: str,
    description: str,
    entries: list[dict],
    attachments_by_email: Optional[dict[int, list[dict]]] = None,
    book_style: str = "memoir",
) -> bytes:
    """Render a collection as a styled PDF book.

    Returns:
        PDF file bytes.
    """
    from weasyprint import HTML

    html_str = build_collection_html(title, description, entries, attachments_by_email, book_style)
    return HTML(string=html_str).write_pdf()
