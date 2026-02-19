-- InboxForge initial schema

CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE NOT NULL,
    thread_id TEXT,
    subject TEXT,
    sender TEXT,
    recipient TEXT,
    date TEXT,
    body_text TEXT,
    body_html TEXT,
    snippet TEXT,
    labels TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keywords TEXT NOT NULL,
    date_from TEXT,
    date_to TEXT,
    results_count INTEGER DEFAULT 0,
    new_emails_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS search_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_id INTEGER NOT NULL,
    email_id INTEGER NOT NULL,
    is_new INTEGER DEFAULT 1,
    FOREIGN KEY (search_id) REFERENCES search_history(id),
    FOREIGN KEY (email_id) REFERENCES emails(id),
    UNIQUE(search_id, email_id)
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT,
    refresh_token TEXT,
    token_uri TEXT,
    client_id TEXT,
    client_secret TEXT,
    scopes TEXT,
    expiry TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);
CREATE INDEX IF NOT EXISTS idx_search_emails_search_id ON search_emails(search_id);
CREATE INDEX IF NOT EXISTS idx_search_emails_email_id ON search_emails(email_id);
