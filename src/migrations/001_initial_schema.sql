-- ============================================================================
-- CODING TRACKER — FULL POSTGRESQL SCHEMA
-- Run:  psql $DATABASE_URL -f src/migrations/001_initial_schema.sql
-- ============================================================================

-- ============================================================================
-- SECTION 1: CORE ENTITY STRUCTURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS students (
    email        VARCHAR(150) PRIMARY KEY,          -- e.g. 23MH1A01459@acet.ac.in
    full_name    VARCHAR(150) NOT NULL,
    roll_number  VARCHAR(50)  UNIQUE NOT NULL,
    college      VARCHAR(100) NOT NULL,
    branch       VARCHAR(50)  NOT NULL,
    phone        VARCHAR(20)  NOT NULL,
    is_verified      BOOLEAN  DEFAULT FALSE,
    is_blocklisted   BOOLEAN  DEFAULT FALSE,        -- TRUE hides student from all leaderboards
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Unified connector table — normalises core stats across all 4 platforms
CREATE TABLE IF NOT EXISTS platform_profiles (
    id             SERIAL PRIMARY KEY,
    student_email  VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    platform_name  VARCHAR(50)  NOT NULL,           -- 'leetcode' | 'codeforces' | 'codechef' | 'hackerrank'
    username       VARCHAR(100) NOT NULL,
    current_rating INT          DEFAULT 0,
    global_rank    INT          DEFAULT 0,
    total_solved   INT          DEFAULT 0,
    easy_solved    INT          DEFAULT 0,
    medium_solved  INT          DEFAULT 0,
    hard_solved    INT          DEFAULT 0,
    last_updated   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(platform_name, username),               -- no two students can claim the same handle
    UNIQUE(student_email, platform_name)            -- one student, one handle per platform
);

CREATE INDEX IF NOT EXISTS idx_platform_profiles_student_email
    ON platform_profiles(student_email);
CREATE INDEX IF NOT EXISTS idx_platform_profiles_leaderboard
    ON platform_profiles(platform_name, total_solved DESC);


-- ============================================================================
-- SECTION 2: LEETCODE SPECIFIC TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS leetcode_profiles (
    student_email         VARCHAR(150) PRIMARY KEY REFERENCES students(email) ON DELETE CASCADE,
    username              VARCHAR(100) NOT NULL,
    global_ranking        INT,
    contest_rating        NUMERIC(6,2) DEFAULT 0.00,
    top_percentage        NUMERIC(4,2),
    contribution_calendar JSONB,                   -- timestamp→count heatmap
    last_synced           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leetcode_contest_history (
    id                    SERIAL PRIMARY KEY,
    student_email         VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    contest_title         VARCHAR(200) NOT NULL,
    contest_time          INT,
    rank_achieved         INT,
    finish_time_seconds   INT,
    problems_solved       INT,
    rating_after_contest  NUMERIC(6,2),
    UNIQUE(student_email, contest_title)
);


-- ============================================================================
-- SECTION 3: CODEFORCES SPECIFIC TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS codeforces_profiles (
    student_email            VARCHAR(150) PRIMARY KEY REFERENCES students(email) ON DELETE CASCADE,
    username                 VARCHAR(100) NOT NULL,
    current_rating           INT          DEFAULT 0,
    max_rating               INT          DEFAULT 0,
    current_rank             VARCHAR(50)  DEFAULT 'unrated',
    max_rank                 VARCHAR(50)  DEFAULT 'unrated',
    contribution             INT          DEFAULT 0,
    avatar_url               TEXT,
    solved_rating_under_1200 INT          DEFAULT 0,
    solved_rating_1200_1599  INT          DEFAULT 0,
    solved_rating_1600_1899  INT          DEFAULT 0,
    solved_rating_1900_2199  INT          DEFAULT 0,
    solved_rating_above_2200 INT          DEFAULT 0,
    last_synced              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS codeforces_contest_history (
    id                SERIAL PRIMARY KEY,
    student_email     VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    contest_id        INT          NOT NULL,
    contest_name      VARCHAR(255) NOT NULL,
    rank_achieved     INT          NOT NULL,
    old_rating        INT          NOT NULL,
    new_rating        INT          NOT NULL,
    rating_change     INT          NOT NULL,
    timestamp_seconds BIGINT,
    UNIQUE(student_email, contest_id)
);


-- ============================================================================
-- SECTION 4: CODECHEF SPECIFIC TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS codechef_profiles (
    student_email     VARCHAR(150) PRIMARY KEY REFERENCES students(email) ON DELETE CASCADE,
    username          VARCHAR(100) NOT NULL,
    stars_string      VARCHAR(10)  DEFAULT '1★',
    current_rating    INT          DEFAULT 0,
    highest_rating    INT          DEFAULT 0,
    global_rank       INT          DEFAULT 0,
    country_rank      INT          DEFAULT 0,
    current_division  VARCHAR(10)  DEFAULT 'Div 4',
    starters_solved   INT          DEFAULT 0,
    practice_solved   INT          DEFAULT 0,
    peer_solved       INT          DEFAULT 0,
    total_solved      INT          DEFAULT 0,
    last_synced       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS codechef_contest_history (
    id                   SERIAL PRIMARY KEY,
    student_email        VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    contest_code         VARCHAR(50)  NOT NULL,
    contest_name         VARCHAR(255),
    rank_achieved        INT          NOT NULL,
    rating_after_contest INT          NOT NULL,
    rating_change        INT          NOT NULL,
    UNIQUE(student_email, contest_code)
);


-- ============================================================================
-- SECTION 5: HACKERRANK SPECIFIC TABLES
-- NOTE: Duplicate column bug in original DDL fixed here (removed duplicate language/status)
-- ============================================================================

CREATE TABLE IF NOT EXISTS hackerrank_profiles (
    student_email          VARCHAR(150) PRIMARY KEY REFERENCES students(email) ON DELETE CASCADE,
    username               VARCHAR(100) NOT NULL,
    total_points           NUMERIC(10,2) DEFAULT 0.00,
    global_rank            INT           DEFAULT 0,
    problem_solving_stars  INT           DEFAULT 0,
    problem_solving_score  INT           DEFAULT 0,
    cpp_stars              INT           DEFAULT 0,
    java_stars             INT           DEFAULT 0,
    python_stars           INT           DEFAULT 0,
    sql_stars              INT           DEFAULT 0,
    last_synced            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- Activity ledger to trace submission timelines and fight plagiarism
CREATE TABLE IF NOT EXISTS hackerrank_recent_submissions (
    id              SERIAL PRIMARY KEY,
    student_email   VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    challenge_slug  VARCHAR(255) NOT NULL,
    challenge_name  VARCHAR(255) NOT NULL,
    language        VARCHAR(50),
    status          VARCHAR(50),                    -- 'Accepted', 'Wrong Answer', etc.
    submitted_at    TIMESTAMP,
    UNIQUE(student_email, challenge_slug)
);


-- ============================================================================
-- SECTION 6: HISTORICAL TIME-SERIES SNAPSHOTS (ANALYTICS ENGINE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS platform_daily_snapshots (
    id                   SERIAL PRIMARY KEY,
    student_email        VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    platform_name        VARCHAR(50)  NOT NULL,
    snapshot_date        DATE         DEFAULT CURRENT_DATE,
    rating               INT,
    total_solved_snapshot INT,
    UNIQUE(student_email, platform_name, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
    ON platform_daily_snapshots(student_email, snapshot_date);
