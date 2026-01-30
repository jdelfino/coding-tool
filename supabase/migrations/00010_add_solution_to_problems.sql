-- Add solution column to problems table
-- Stores instructor solution code (not visible to students)
ALTER TABLE problems ADD COLUMN solution text;
