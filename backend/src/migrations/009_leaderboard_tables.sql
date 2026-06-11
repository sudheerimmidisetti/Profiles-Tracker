-- 009_leaderboard_tables.sql
-- New tables for the 3-tier leaderboard system:
-- Placements (6-month), Weekly (contest-only), Monthly (contest + practice blend)

-- ── Problem metadata cache (UDG tier) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS problem_metadata (
  problem_id        VARCHAR(300)   PRIMARY KEY,   -- platform:id (e.g. "lc:two-sum")
  platform          VARCHAR(20)    NOT NULL,
  title             VARCHAR(500),
  difficulty_tag    VARCHAR(20),                  -- Easy / Medium / Hard (LC)
  cf_rating         INTEGER,                      -- CF problem rating
  cc_rating         INTEGER,                      -- CC difficulty_rating
  acceptance_rate   DECIMAL(6,2),                 -- LC acceptance % (0–100)
  total_submissions INTEGER,
  udg_tier          SMALLINT,                     -- 1–6 computed tier
  cached_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_meta_platform ON problem_metadata(platform);

-- ── Weekly contest scores per student per platform (raw) ───────────────────────
CREATE TABLE IF NOT EXISTS weekly_contest_scores (
  id            BIGSERIAL PRIMARY KEY,
  student_email VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
  week_start    DATE         NOT NULL,   -- Monday of that week (IST)
  platform      VARCHAR(20)  NOT NULL,
  score         DECIMAL(8,4) DEFAULT 0, -- 0–100 log-ratio or proxy score
  rank          INTEGER,
  participants  INTEGER,
  contest_id    VARCHAR(200),
  attended      BOOLEAN      DEFAULT FALSE,
  UNIQUE(student_email, week_start, platform, contest_id)
);

CREATE INDEX IF NOT EXISTS idx_wcs_student_week ON weekly_contest_scores(student_email, week_start);

-- ── Weekly leaderboard composite (one row per student per week) ────────────────
CREATE TABLE IF NOT EXISTS weekly_board (
  student_email      VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
  week_start         DATE         NOT NULL,
  lc_score           DECIMAL(8,4) DEFAULT 0,
  cf_score           DECIMAL(8,4) DEFAULT 0,
  cc_score           DECIMAL(8,4) DEFAULT 0,
  composite          DECIMAL(8,4) DEFAULT 0,
  platforms_attended SMALLINT     DEFAULT 0,
  eligible           BOOLEAN      DEFAULT FALSE,  -- ≥2 platforms attended
  frozen_at          TIMESTAMP,
  PRIMARY KEY(student_email, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_board_week ON weekly_board(week_start, composite DESC);

-- ── Monthly leaderboard ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_board (
  student_email  VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
  month          DATE         NOT NULL,   -- first day of month
  contest_pts    DECIMAL(8,4) DEFAULT 0,
  practice_pts   DECIMAL(8,4) DEFAULT 0,
  month_udg      DECIMAL(10,2) DEFAULT 0,
  active_weeks   SMALLINT     DEFAULT 0,
  monthly_score  DECIMAL(8,4) DEFAULT 0,
  eligible       BOOLEAN      DEFAULT FALSE,
  frozen_at      TIMESTAMP,
  PRIMARY KEY(student_email, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_board_month ON monthly_board(month, monthly_score DESC);

-- ── Placements leaderboard cache (recomputed on refresh, 6-month rolling) ──────
CREATE TABLE IF NOT EXISTS placements_board (
  student_email     VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
  computed_at       TIMESTAMP    NOT NULL DEFAULT NOW(),

  -- Component scores (0–30, 0–30, 0–20, 0–20)
  lc_score          DECIMAL(7,4) DEFAULT 0,
  cc_score          DECIMAL(7,4) DEFAULT 0,
  cf_score          DECIMAL(7,4) DEFAULT 0,
  hr_score          DECIMAL(7,4) DEFAULT 0,
  total_score       DECIMAL(8,4) DEFAULT 0,   -- 0–100

  -- Breakdown detail (stored as JSONB for the hover tooltip)
  lc_breakdown      JSONB,
  cc_breakdown      JSONB,
  cf_breakdown      JSONB,
  hr_breakdown      JSONB,

  PRIMARY KEY(student_email)
);

CREATE INDEX IF NOT EXISTS idx_placements_score ON placements_board(total_score DESC);
