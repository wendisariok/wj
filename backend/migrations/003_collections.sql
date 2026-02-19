-- Collections and collection_emails tables

CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    email_id INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    chapter_title TEXT DEFAULT '',
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (email_id) REFERENCES emails(id),
    UNIQUE(collection_id, email_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_emails_collection ON collection_emails(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_emails_email ON collection_emails(email_id);
