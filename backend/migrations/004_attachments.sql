CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    gmail_attachment_id TEXT,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    file_path TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);
ALTER TABLE emails ADD COLUMN attachments_checked INTEGER DEFAULT 0;
