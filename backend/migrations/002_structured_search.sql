-- Add structured search filter columns to search_history
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE,
-- so idempotency is handled in database.py

ALTER TABLE search_history ADD COLUMN senders TEXT;
ALTER TABLE search_history ADD COLUMN subject_keywords TEXT;
ALTER TABLE search_history ADD COLUMN filter_logic TEXT DEFAULT 'and';
