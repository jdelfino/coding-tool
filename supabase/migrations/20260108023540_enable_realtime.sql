-- Enable Realtime for session-related tables
-- This allows clients to subscribe to changes via Supabase Realtime

-- Add tables to the supabase_realtime publication
-- Note: The publication is created by default in Supabase

ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_students;
ALTER PUBLICATION supabase_realtime ADD TABLE revisions;

-- Set REPLICA IDENTITY FULL for tables that need UPDATE events
-- This is required for Realtime to broadcast full row data on updates
ALTER TABLE sessions REPLICA IDENTITY FULL;
ALTER TABLE session_students REPLICA IDENTITY FULL;
