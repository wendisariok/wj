import os
import re
import logging
from . import config

logger = logging.getLogger(__name__)


def sanitize_filename(filename: str) -> str:
    """Strip path traversal, invalid chars, truncate to 200 chars."""
    # Take only the basename (strip any directory components)
    filename = os.path.basename(filename)
    # Remove characters that are invalid on Windows/Linux
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', filename)
    # Collapse multiple underscores/dots
    filename = re.sub(r'_+', '_', filename)
    # Strip leading/trailing whitespace and dots
    filename = filename.strip('. ')
    if not filename:
        filename = "attachment"
    # Truncate to 200 chars while preserving extension
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:200 - len(ext)] + ext
    return filename


def build_search_folder_name(search: dict) -> str:
    """Build a human-readable folder name from search filters."""
    parts = []
    if search.get("senders"):
        parts.append(f"from-{search['senders']}")
    if search.get("subject_keywords"):
        parts.append(f"subj-{search['subject_keywords']}")
    if search.get("keywords"):
        parts.append(search["keywords"])
    label = "_".join(parts) if parts else "search"
    # Sanitize for filesystem
    label = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', label)
    label = re.sub(r'[,\s]+', '-', label)
    label = label.strip('._- ')[:80] or "search"
    search_id = search.get("id", "")
    return f"{label}_{search_id}"


def _resolve_canonical_name(message_id: str, filename: str) -> str:
    """Determine the final filename in the canonical dir, handling duplicates."""
    filename = sanitize_filename(filename)
    canonical_dir = os.path.join(config.ATTACHMENTS_DIR, "_files", message_id)
    os.makedirs(canonical_dir, exist_ok=True)

    base, ext = os.path.splitext(filename)
    final_name = filename
    counter = 1
    while os.path.exists(os.path.join(canonical_dir, final_name)):
        final_name = f"{base}_{counter}{ext}"
        counter += 1

    return final_name


def save_attachment(message_id: str, filename: str, data: bytes, search_folder: str = "") -> str:
    """Save attachment to canonical location and hardlink into search folder.

    Canonical: ATTACHMENTS_DIR/_files/{message_id}/{filename}
    Search:    ATTACHMENTS_DIR/{search_folder}/{message_id}/{filename} (hardlink)

    Returns relative path to the canonical file from ATTACHMENTS_DIR.
    """
    filename = sanitize_filename(filename)
    canonical_dir = os.path.join(config.ATTACHMENTS_DIR, "_files", message_id)
    os.makedirs(canonical_dir, exist_ok=True)

    # Check if canonical file already exists (same message_id + filename)
    canonical_path = os.path.join(canonical_dir, filename)
    if not os.path.exists(canonical_path):
        # Handle duplicate filenames with counter suffix
        final_name = _resolve_canonical_name(message_id, filename)
        canonical_path = os.path.join(canonical_dir, final_name)
        with open(canonical_path, "wb") as f:
            f.write(data)
    else:
        final_name = filename

    canonical_rel = f"_files/{message_id}/{final_name}"

    # Create hardlink in search folder if specified
    if search_folder:
        link_into_search_folder(search_folder, message_id, final_name, canonical_path)

    return canonical_rel


def link_into_search_folder(search_folder: str, message_id: str, filename: str, canonical_abs: str):
    """Create a hardlink (or copy fallback) in the search folder pointing to the canonical file."""
    search_dir = os.path.join(config.ATTACHMENTS_DIR, search_folder, message_id)
    os.makedirs(search_dir, exist_ok=True)
    link_path = os.path.join(search_dir, filename)

    if os.path.exists(link_path):
        return  # Already linked

    try:
        os.link(canonical_abs, link_path)
    except OSError:
        # Fallback: copy the file if hardlinks aren't supported
        import shutil
        try:
            shutil.copy2(canonical_abs, link_path)
        except Exception as e:
            logger.warning("Failed to link/copy %s into search folder: %s", filename, e)


def get_absolute_path(relative_path: str) -> str:
    """Convert relative path to absolute path under ATTACHMENTS_DIR."""
    return os.path.join(config.ATTACHMENTS_DIR, relative_path)


def attachment_exists(relative_path: str) -> bool:
    """Check if attachment file exists on disk."""
    return os.path.exists(get_absolute_path(relative_path))
