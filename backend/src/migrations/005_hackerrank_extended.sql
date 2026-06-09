-- 005_hackerrank_extended.sql
-- Extends hackerrank_profiles with full profile, social, medals, ELO, domain scores.
-- Adds score/track columns to recent_submissions for full detail.

-- ── hackerrank_profiles ────────────────────────────────────────────────────────
ALTER TABLE hackerrank_profiles
  ADD COLUMN IF NOT EXISTS display_name          VARCHAR(150),
  ADD COLUMN IF NOT EXISTS avatar_url            TEXT,
  ADD COLUMN IF NOT EXISTS country               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city                  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS school                VARCHAR(200),
  ADD COLUMN IF NOT EXISTS jobs_headline         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS about                 TEXT,
  ADD COLUMN IF NOT EXISTS graduation_year       INTEGER,
  ADD COLUMN IF NOT EXISTS created_at_hr         TIMESTAMP,
  -- Social links
  ADD COLUMN IF NOT EXISTS linkedin_url          TEXT,
  ADD COLUMN IF NOT EXISTS github_url            TEXT,
  ADD COLUMN IF NOT EXISTS website               TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url           TEXT,
  -- Followers
  ADD COLUMN IF NOT EXISTS followers_count       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count       INTEGER DEFAULT 0,
  -- Rankings
  ADD COLUMN IF NOT EXISTS leaderboard_rank      INTEGER,
  ADD COLUMN IF NOT EXISTS level                 INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elo_rating            NUMERIC(10,2) DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS contest_points        NUMERIC(10,2) DEFAULT 0,
  -- Medals (contest)
  ADD COLUMN IF NOT EXISTS medals_gold           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medals_silver         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medals_bronze         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contests_participated INTEGER DEFAULT 0,
  -- Submission stats
  ADD COLUMN IF NOT EXISTS submissions_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_submissions  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_rate       NUMERIC(5,2) DEFAULT 0,
  -- Additional domain stars
  ADD COLUMN IF NOT EXISTS ruby_stars            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS js_stars              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sql_score             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS algorithms_score      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ds_score              INTEGER DEFAULT 0,
  -- Rich JSONB
  ADD COLUMN IF NOT EXISTS badges                JSONB,
  ADD COLUMN IF NOT EXISTS certificates          JSONB,
  ADD COLUMN IF NOT EXISTS track_scores          JSONB;

-- ── hackerrank_recent_submissions ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='hackerrank_recent_submissions' AND column_name='score'
  ) THEN
    ALTER TABLE hackerrank_recent_submissions ADD COLUMN score NUMERIC(10,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='hackerrank_recent_submissions' AND column_name='track'
  ) THEN
    ALTER TABLE hackerrank_recent_submissions ADD COLUMN track VARCHAR(100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='hackerrank_recent_submissions' AND column_name='difficulty'
  ) THEN
    ALTER TABLE hackerrank_recent_submissions ADD COLUMN difficulty VARCHAR(50);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hr_subs_email ON hackerrank_recent_submissions(student_email);
CREATE INDEX IF NOT EXISTS idx_hr_profiles_points ON hackerrank_profiles(total_points DESC);
