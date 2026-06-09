-- ============================================================================
-- MIGRATION 002: Extended LeetCode Schema
-- Adds: profile info, streak, beats %, language stats, skill tags, badges,
--        recent AC submissions to leetcode_profiles.
-- Adds: trendDirection + totalProblems to leetcode_contest_history.
-- Run: psql $DATABASE_URL -f src/migrations/002_leetcode_extended.sql
-- Safe to re-run (all ADD COLUMN IF NOT EXISTS).
-- ============================================================================

-- ── Extended profile info ────────────────────────────────────────────────────
ALTER TABLE leetcode_profiles
  ADD COLUMN IF NOT EXISTS real_name          VARCHAR(150),
  ADD COLUMN IF NOT EXISTS avatar_url         TEXT,
  ADD COLUMN IF NOT EXISTS about_me           TEXT,
  ADD COLUMN IF NOT EXISTS school             VARCHAR(200),
  ADD COLUMN IF NOT EXISTS company            VARCHAR(200),
  ADD COLUMN IF NOT EXISTS job_title          VARCHAR(150),
  ADD COLUMN IF NOT EXISTS country            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS github_url         TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url       TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url        TEXT,
  ADD COLUMN IF NOT EXISTS reputation         INT          DEFAULT 0;

-- ── Solving stats ────────────────────────────────────────────────────────────
ALTER TABLE leetcode_profiles
  ADD COLUMN IF NOT EXISTS total_solved        INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS easy_solved         INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medium_solved       INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hard_solved         INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_questions     INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_rate     NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS beats_easy          NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS beats_medium        NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS beats_hard          NUMERIC(5,2) DEFAULT 0.00;

-- ── Calendar ─────────────────────────────────────────────────────────────────
ALTER TABLE leetcode_profiles
  ADD COLUMN IF NOT EXISTS streak              INT          DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_active_days   INT          DEFAULT 0;

-- ── Contest ranking ──────────────────────────────────────────────────────────
ALTER TABLE leetcode_profiles
  ADD COLUMN IF NOT EXISTS attended_contests_count INT        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_participants      INT        DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contest_badge_name      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contest_badge_icon      TEXT,
  ADD COLUMN IF NOT EXISTS contest_badge_expired   BOOLEAN    DEFAULT FALSE;

-- ── JSONB blobs (avoids dozens of child tables) ───────────────────────────────
ALTER TABLE leetcode_profiles
  ADD COLUMN IF NOT EXISTS language_stats      JSONB,   -- [{languageName, problemsSolved}]
  ADD COLUMN IF NOT EXISTS skill_tags          JSONB,   -- {advanced:[...], intermediate:[...], fundamental:[...]}
  ADD COLUMN IF NOT EXISTS badges              JSONB,   -- [{name, displayName, icon, creationDate}]
  ADD COLUMN IF NOT EXISTS upcoming_badges     JSONB,   -- [{name, icon, progress}]
  ADD COLUMN IF NOT EXISTS active_badge        JSONB,   -- {name, icon}
  ADD COLUMN IF NOT EXISTS recent_ac_submissions JSONB; -- [{title, titleSlug, timestamp}]

-- ── Extended contest history ─────────────────────────────────────────────────
ALTER TABLE leetcode_contest_history
  ADD COLUMN IF NOT EXISTS trend_direction     VARCHAR(10),  -- 'UP' | 'DOWN'
  ADD COLUMN IF NOT EXISTS total_problems      INT;

-- ── GIN indexes on JSONB for efficient queries ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lc_language_stats ON leetcode_profiles USING GIN (language_stats);
CREATE INDEX IF NOT EXISTS idx_lc_skill_tags     ON leetcode_profiles USING GIN (skill_tags);
CREATE INDEX IF NOT EXISTS idx_lc_badges         ON leetcode_profiles USING GIN (badges);
