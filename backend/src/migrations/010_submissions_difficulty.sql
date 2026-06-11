-- 010_submissions_difficulty.sql
-- Add difficulty metadata columns to student_submissions
-- These are populated by the sync job going forward.
-- Existing rows default to NULL (scored as T3 fallback in the UDG engine).

ALTER TABLE student_submissions
  ADD COLUMN IF NOT EXISTS difficulty_tag      VARCHAR(20),   -- 'Easy'/'Medium'/'Hard' (LC) or CC equivalent
  ADD COLUMN IF NOT EXISTS acceptance_rate     DECIMAL(6,2),  -- LC acceptance % (0-100)
  ADD COLUMN IF NOT EXISTS total_submissions   INTEGER,       -- LC total submissions for edge guard
  ADD COLUMN IF NOT EXISTS problem_rating      INTEGER;       -- CF problem rating

CREATE INDEX IF NOT EXISTS idx_submissions_difficulty
  ON student_submissions(platform, difficulty_tag);
