import os
import re
from . import config


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


def save_attachment(message_id: str, filename: str, data: bytes) -> str:
    """Save attachment to ATTACHMENTS_DIR/{message_id}/{filename}.

    Returns relative path from ATTACHMENTS_DIR.
    """
    filename = sanitize_filename(filename)
    dir_path = os.path.join(config.ATTACHMENTS_DIR, message_id)
    os.makedirs(dir_path, exist_ok=True)

    # Handle duplicate filenames with counter suffix
    base, ext = os.path.splitext(filename)
    final_name = filename
    counter = 1
    while os.path.exists(os.path.join(dir_path, final_name)):
        final_name = f"{base}_{counter}{ext}"
        counter += 1

    file_path = os.path.join(dir_path, final_name)
    with open(file_path, "wb") as f:
        f.write(data)

    # Return relative path (forward slashes for portability)
    return f"{message_id}/{final_name}"


def get_absolute_path(relative_path: str) -> str:
    """Convert relative path to absolute path under ATTACHMENTS_DIR."""
    return os.path.join(config.ATTACHMENTS_DIR, relative_path)


def attachment_exists(relative_path: str) -> bool:
    """Check if attachment file exists on disk."""
    return os.path.exists(get_absolute_path(relative_path))
