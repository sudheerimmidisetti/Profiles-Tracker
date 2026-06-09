-- 004_codechef_extended.sql
-- Extends codechef_profiles with full profile info, DSA rating, heatmap, badges.
-- Extends codechef_contest_history with date, contest_type, problems_solved.

-- ── codechef_profiles ────────────────────────────────────────────────────────
ALTER TABLE codechef_profiles
  ADD COLUMN IF NOT EXISTS display_name          VARCHAR(150),
  ADD COLUMN IF NOT EXISTS avatar_url            TEXT,
  ADD COLUMN IF NOT EXISTS country               VARCHAR(100),
  ADD COLUMN IF NOT EXISTS institution           VARCHAR(200),
  ADD COLUMN IF NOT EXISTS student_or_pro        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS is_pro_user           BOOLEAN DEFAULT FALSE,
  -- DSA rating (separate track)
  ADD COLUMN IF NOT EXISTS dsa_rating            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dsa_highest_rating    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dsa_global_rank       INTEGER,
  ADD COLUMN IF NOT EXISTS dsa_country_rank      INTEGER,
  -- Solving detail
  ADD COLUMN IF NOT EXISTS problems_fully_solved    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS problems_partial_solved  INTEGER DEFAULT 0,
  -- Derived
  ADD COLUMN IF NOT EXISTS contests_participated  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_rank              INTEGER,
  ADD COLUMN IF NOT EXISTS win_rate               NUMERIC(5,2) DEFAULT 0,
  -- JSONB blobs
  ADD COLUMN IF NOT EXISTS heat_map               JSONB,
  ADD COLUMN IF NOT EXISTS badges                 JSONB,
  ADD COLUMN IF NOT EXISTS rating_graph           JSONB;

-- ── codechef_contest_history ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='codechef_contest_history' AND column_name='contest_date'
  ) THEN
    ALTER TABLE codechef_contest_history ADD COLUMN contest_date TIMESTAMP;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='codechef_contest_history' AND column_name='contest_type'
  ) THEN
    ALTER TABLE codechef_contest_history ADD COLUMN contest_type VARCHAR(50);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='codechef_contest_history' AND column_name='division'
  ) THEN
    ALTER TABLE codechef_contest_history ADD COLUMN division VARCHAR(20);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='codechef_contest_history' AND column_name='problems_solved_count'
  ) THEN
    ALTER TABLE codechef_contest_history ADD COLUMN problems_solved_count INTEGER DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cc_contest_email ON codechef_contest_history(student_email);
CREATE INDEX IF NOT EXISTS idx_cc_profiles_rating ON codechef_profiles(current_rating DESC);
