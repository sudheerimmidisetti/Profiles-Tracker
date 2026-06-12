-- 011_contest_id_and_schema_tracking.sql
-- Adds:
--   1. contest_id column to student_submissions (tracks which CC/CF contest a submission belongs to)
--   2. schema_migrations tracking table (for idempotent migration runner)
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ── 1. contest_id column ──────────────────────────────────────────────────────
ALTER TABLE student_submissions
  ADD COLUMN IF NOT EXISTS contest_id TEXT;

-- Index for fast per-contest lookups (used by ContestDetailPanel for CC)
CREATE INDEX IF NOT EXISTS idx_submissions_contest
  ON student_submissions (student_email, platform, contest_id)
  WHERE contest_id IS NOT NULL;

-- ── 2. schema_migrations tracking ────────────────────────────────────────────
-- The migration runner creates this table itself; this ensures it exists
-- even if the runner is invoked for the first time mid-sequence.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(255) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
