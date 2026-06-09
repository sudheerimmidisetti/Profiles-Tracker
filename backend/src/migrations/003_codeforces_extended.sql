-- 003_codeforces_extended.sql
-- Extends codeforces_profiles with full profile info and computed stats.
-- Extends codeforces_contest_history with problems_solved, contest_type, division.

-- ── codeforces_profiles ───────────────────────────────────────────────────────
ALTER TABLE codeforces_profiles
  ADD COLUMN IF NOT EXISTS first_name             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country                VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city                   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS organization           VARCHAR(200),
  ADD COLUMN IF NOT EXISTS friend_of_count        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title_photo            TEXT,
  ADD COLUMN IF NOT EXISTS last_online_seconds    BIGINT,
  ADD COLUMN IF NOT EXISTS registration_seconds   BIGINT,
  ADD COLUMN IF NOT EXISTS total_solved           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_submissions      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_submissions   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_rate        NUMERIC(5,2) DEFAULT 0,
  -- Solved by difficulty bucket (existing cols stay, these are extra derived)
  ADD COLUMN IF NOT EXISTS highest_rated_problem  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS most_frequent_tag      VARCHAR(100),
  -- JSONB rich data blobs
  ADD COLUMN IF NOT EXISTS language_stats         JSONB,
  ADD COLUMN IF NOT EXISTS tag_stats              JSONB,
  ADD COLUMN IF NOT EXISTS submission_calendar    JSONB,
  ADD COLUMN IF NOT EXISTS recent_ac_submissions  JSONB;

-- ── codeforces_contest_history ─────────────────────────────────────────────────
-- First add missing columns if table already exists
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='codeforces_contest_history' AND column_name='problems_solved'
  ) THEN
    ALTER TABLE codeforces_contest_history ADD COLUMN problems_solved INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='codeforces_contest_history' AND column_name='division'
  ) THEN
    ALTER TABLE codeforces_contest_history ADD COLUMN division VARCHAR(20);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cf_contest_hist_email ON codeforces_contest_history(student_email);
CREATE INDEX IF NOT EXISTS idx_cf_profiles_rating    ON codeforces_profiles(current_rating DESC);
