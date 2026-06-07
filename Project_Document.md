# Coding Tracker Project

The Project the needs to be done is Node.js Backend, now it is all about Getting Coding profiles of users in my college and showing it in a dashboard and analytics page.
> [!WARNING]
> The Following is Only Backend Project. The Details given below all for understanding, don't be confused.

<hr>

## Part A: User's DashBoard

### Part A:
1. User Goes to login/Signup page sees Enter College Mail and Vaildate Otp in 2 minutes -> This is only registration.
2. Later we hit our college student's Database and fetch data Somedata and put in Postgres / Sql Database.
3. But until Now the User is only registered, Not Verified.
4. To Verfiy the user, we need to verify their profile url's or handlers.
5. Now the page to enter all the handlers and click on sumbit.
6. After sumbit the user see a unqiue 8 digit alphanumeric and characters code which stored in redis.
7. The user need to change the first name of the all profiles in all platforms and click on verfiy
8. Then we hit all the api's / unoffical graphql endpoints / scarpe them, to get first name and match it against the code in redis, if all names are successfully match flush it and change the status to verify in postgres/db and add the handlers.
9. JWT short, refresh tokens for session maintaince and authentication.
10. Store tokens according suitable database (I an not an expert i just given a example below). 

***So, at the end, the database looks like this :***

---

***(Students) RDB:***

|ID(Primary, Not Null, Unique)| Full Name     |RollNumber  |College |   Branch   |Phone       |leetcode_handler |codechef_handler |codeforces_handler |hackerrank_handler | isVerified |
|-----------------------------|---------------|------------|--------|------------|------------|-----------------|-----------------|-------------------|-------------------|------------|
|23MH1A01459@acet.ac.in       | Siva Pranay   |23MH10A1459 |  AUS   |    CSE     |9425294579  |sivap_192        |sivap_634        |siva_63            |siva05             |   true/1   |
|                             |               |            |        |            |            |                 |                 |                   |                   |            |

***Redis:***

|Email                 |     OTP            |  Timer  |
|----------------------|--------------------|---------|
|23MH1A01459@acet.ac.in|  917011            |   120 s |

|Email                 |     Short Token    |  Timer  |
|----------------------|--------------------|---------|
|23MH1A01459@acet.ac.in|  917011            |   300 s |

|Email                 |     Refresh Token  |  Timer  |
|----------------------|--------------------|---------|
|23MH1A01459@acet.ac.in|  917011            |   3d    |

---

10. Now User(Student) Has set of things to check:
    i.  Profile Tab
    ii. LeaderBoard (Leetcode, Codechef, Codeforces, Hackerrank)
    iii.Settings

11. In Leardboard each tab of platform is filtered as All, Contest, Consistancy & Problems.

12. Student who are cheating and now upto mark as claimed in profile are blocklisted and not shown in the leardboard (The process is done via Offline interview and testing)

---

***So the remaining collected Data which is scraped is store like the following:***

## 📌 PART 2: Production-Ready Database Infrastructure

### 2.1 Redis Token & Session Store Mappings
Redis manages transient data structures to minimize access latency and protect long-term sessions:

```ini
# 2-Minute Registration OTP Store
Key:   otp:auth:23MH1A01459@acet.ac.in
Value: "917011"
TTL:   120 Seconds

# User Verification Code Store
Key:   verify:profile:23MH1A01459@acet.ac.in
Value: "AC89X77P"
TTL:   86400 Seconds (24 Hours)

# JWT Short Session Token Whitelist (Mapped to Session IDs)
Key:   jwt:short:sess_78ac991b2
Value: "23MH1A01459@acet.ac.in"
TTL:   300 Seconds (5 Minutes)

# JWT Persistent Refresh Token Store
Key:   jwt:refresh:sess_78ac991b2
Value: "sha256_hashed_token_string"
TTL:   259200 Seconds (3 Days)
```

---

### 2.2 Complete, Uncompressed PostgreSQL Relational Schema (DDL)

```sql
-- ============================================================================
-- SECTION 1: CORE ENTITY STRUCTURES
-- ============================================================================

CREATE TABLE students (
    email VARCHAR(150) PRIMARY KEY, -- Primary System ID: "23MH1A01459@acet.ac.in"
    full_name VARCHAR(150) NOT NULL,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    college VARCHAR(100) NOT NULL,
    branch VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_blocklisted BOOLEAN DEFAULT FALSE, -- Set to TRUE to hide cheaters from all leaderboards
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unified connector table that normalizes core stats across all 4 platforms
CREATE TABLE platform_profiles (
    id SERIAL PRIMARY KEY,
    student_email VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    platform_name VARCHAR(50) NOT NULL, -- Values: 'leetcode', 'codeforces', 'codechef', 'hackerrank'
    username VARCHAR(100) NOT NULL, -- The platform handle/username
    current_rating INT DEFAULT 0, -- Maps Codeforces/Codechef ratings or Hackerrank score equivalents
    global_rank INT DEFAULT 0,
    total_solved INT DEFAULT 0,
    easy_solved INT DEFAULT 0,
    medium_solved INT DEFAULT 0,
    hard_solved INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- CONSTRAINTS --
    UNIQUE(platform_name, username),   -- Guard: No two students can claim the exact same handle
    UNIQUE(student_email, platform_name) -- Guard: One student can link at most 1 handle per platform
);

-- Crucial Explicit Indexes for high-performance sorting and lightning-fast joins
CREATE INDEX idx_platform_profiles_student_email ON platform_profiles(student_email);
CREATE INDEX idx_platform_profiles_leaderboard ON platform_profiles(platform_name, total_solved DESC);


-- ============================================================================
-- SECTION 2: LEETCODE SPECIFIC TABLES
-- ============================================================================

CREATE TABLE leetcode_profiles (
    student_email VARCHAR(150) PRIMARY KEY REFERENCES students(email) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    global_ranking INT,
    contest_rating NUMERIC(6, 2) DEFAULT 0.00,
    top_percentage NUMERIC(4, 2),
    contribution_calendar JSONB, -- Stores the raw stringified timestamp-to-count JSON heatmap map
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leetcode_contest_history (
    id SERIAL PRIMARY KEY,
    student_email VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    contest_title VARCHAR(200) NOT NULL,
    contest_time INT,
    rank_achieved INT,
    finish_time_seconds INT,
    problems_solved INT,
    rating_after_contest NUMERIC(6, 2),
    UNIQUE(student_email, contest_title)
);


-- ============================================================================
-- SECTION 3: CODEFORCES SPECIFIC TABLES (UNCOMPRESSED)
-- ============================================================================

CREATE TABLE codeforces_profiles (
    student_email VARCHAR(150) PRIMARY KEY REFERENCES students(email) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    current_rating INT DEFAULT 0,
    max_rating INT DEFAULT 0,
    current_rank VARCHAR(50) DEFAULT 'unrated', -- e.g., 'Specialist', 'Expert', 'Candidate Master'
    max_rank VARCHAR(50) DEFAULT 'unrated',
    contribution INT DEFAULT 0,
    avatar_url TEXT,
    
    -- Uncompressed fields mapped directly to Codeforces' numeric problem rating tiers
    solved_rating_under_1200 INT DEFAULT 0, -- "Newbie / Pupil" level problems
    solved_rating_1200_1599  INT DEFAULT 0, -- "Specialist" level problems
    solved_rating_1600_1899  INT DEFAULT 0, -- "Expert" level problems
    solved_rating_1900_2199  INT DEFAULT 0, -- "Candidate Master / Master"
    solved_rating_above_2200 INT DEFAULT 0, -- "Grandmaster+" level
    
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE codeforces_contest_history (
    id SERIAL PRIMARY KEY,
    student_email VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    contest_id INT NOT NULL,
    contest_name VARCHAR(255) NOT NULL,
    rank_achieved INT NOT NULL,
    old_rating INT NOT NULL,
    new_rating INT NOT NULL,
    rating_change INT NOT NULL, -- (new_rating - old_rating)
    timestamp_seconds BIGINT,
    UNIQUE(student_email, contest_id)
);


-- ============================================================================
-- SECTION 4: CODECHEF SPECIFIC TABLES (UNCOMPRESSED)
-- ============================================================================

CREATE TABLE codechef_profiles (
    student_email VARCHAR(150) PRIMARY KEY REFERENCES students(email) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    stars_string VARCHAR(10) DEFAULT '1★', -- e.g., '1★', '3★', '5★'
    current_rating INT DEFAULT 0,
    highest_rating INT DEFAULT 0,
    global_rank INT DEFAULT 0,
    country_rank INT DEFAULT 0,
    current_division VARCHAR(10) DEFAULT 'Div 4', -- e.g., 'Div 1', 'Div 2', 'Div 3', 'Div 4'
    
    -- Uncompressed problem tracking fields natively exposed in profile payloads
    starters_solved INT DEFAULT 0,     -- Questions solved during official "Starters" rounds
    practice_solved INT DEFAULT 0,     -- Questions solved from standard learning tracks
    peer_solved INT DEFAULT 0,         -- Questions solved from peer review challenges
    total_solved INT DEFAULT 0,
    
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE codechef_contest_history (
    id SERIAL PRIMARY KEY,
    student_email VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    contest_code VARCHAR(50) NOT NULL, -- e.g., 'START120B'
    contest_name VARCHAR(255),
    rank_achieved INT NOT NULL,
    rating_after_contest INT NOT NULL,
    rating_change INT NOT NULL,
    UNIQUE(student_email, contest_code)
);


-- ============================================================================
-- SECTION 5: HACKERRANK SPECIFIC TABLES (UNCOMPRESSED)
-- ============================================================================

CREATE TABLE hackerrank_profiles (
    student_email VARCHAR(150) PRIMARY KEY REFERENCES students(email) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    total_points NUMERIC(10, 2) DEFAULT 0.00,
    global_rank INT DEFAULT 0,
    
    -- Uncompressed domain-specific star allocations
    problem_solving_stars INT DEFAULT 0, -- Direct tracking indicator for algos
    problem_solving_score INT DEFAULT 0,
    cpp_stars INT DEFAULT 0,
    java_stars INT DEFAULT 0,
    python_stars INT DEFAULT 0,
    sql_stars INT DEFAULT 0,
    
    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Real-time activity ledger used to trace submission timelines and fight plagiarism
CREATE TABLE hackerrank_recent_submissions (
    id SERIAL PRIMARY KEY,
    student_email VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    challenge_slug VARCHAR(255) NOT NULL, -- Unique identifier e.g., 'solve-me-first'
    challenge_name VARCHAR(255) NOT NULL,language VARCHAR(50),status VARCHAR(50),
    language VARCHAR(50),status VARCHAR(50),                   -- 'Accepted', 'Wrong Answer', etc.
    submitted_at TIMESTAMP,
    UNIQUE(student_email, challenge_slug)
);

-- ============================================================================
-- SECTION 6: HISTORICAL TIME-SERIESSNAPSHOTS (ANALYTICS ENGINE)
-- ============================================================================

CREATE TABLE platform_daily_snapshots (
    id SERIAL PRIMARY KEY,
    student_email VARCHAR(150) REFERENCES students(email) ON DELETE CASCADE,
    platform_name VARCHAR(50) NOT NULL, -- 'leetcode', 'codeforces', 'codechef', 'hackerrank'
    snapshot_date DATE DEFAULT CURRENT_DATE,
    rating INT, -- Target tracking parameter on specific execution dates 
    total_solved_snapshot INT,      -- Aggregated lifetime total count on this date 
    UNIQUE(student_email, platform_name, snapshot_date)
);
-- Index optimization to maximize graph assembly query performance 
CREATE INDEX idx_snapshots_lookup ON platform_daily_snapshots(student_email, snapshot_date);