-- 006_submissions_table.sql
-- Stores all unique accepted (AC) submissions per student per platform.
-- One row = one unique problem solved (no re-submission duplicates).
-- Used for the day-click drawer in the ActivityHeatmap component.

CREATE TABLE IF NOT EXISTS student_submissions (
  id            BIGSERIAL PRIMARY KEY,
  student_email TEXT        NOT NULL,
  platform      TEXT        NOT NULL,   -- 'leetcode' | 'codeforces' | 'codechef' | 'hackerrank'
  problem_id    TEXT        NOT NULL,   -- platform-specific unique key
  problem_name  TEXT,
  status        TEXT        NOT NULL DEFAULT 'AC',
  language      TEXT,
  submitted_at  TIMESTAMPTZ,
  runtime_ms    INT,
  memory_kb     INT,
  raw           JSONB,

  -- One row per unique problem per platform per student
  UNIQUE (student_email, platform, problem_id)
);

-- Fast lookup: all submissions for a student on a specific date
CREATE INDEX IF NOT EXISTS idx_submissions_email_platform_date
  ON student_submissions (student_email, platform, submitted_at DESC);

-- Fast lookup: all submissions for a student across all platforms sorted by date
CREATE INDEX IF NOT EXISTS idx_submissions_email_date
  ON student_submissions (student_email, submitted_at DESC);
