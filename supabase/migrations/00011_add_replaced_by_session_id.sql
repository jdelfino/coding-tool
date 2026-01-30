-- Add replaced_by_session_id to sessions table
-- Tracks which session replaced this one when an instructor starts a new session
ALTER TABLE sessions ADD COLUMN replaced_by_session_id UUID REFERENCES sessions(id);
