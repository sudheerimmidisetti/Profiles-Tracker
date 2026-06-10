# HackerRank Profile — Complete Data Reference for Dashboard Building

> **Sources:** Public profile REST API (`/rest/contests/master/hackers/{username}/profile`),
> HackerRank Scoring docs, HackerRank for Work API, and observed profile page structure.
>
> **Primary API endpoint:** `GET https://www.hackerrank.com/rest/contests/master/hackers/{username}/profile`
> Returns a top-level `model` object containing all fields below.

---

## 1. Identity & Personal Info

| Field | Type | Notes |
|---|---|---|
| `username` | string | Unique handle; used in all API calls |
| `name` | string | Display name (full name) |
| `avatar` | string (URL) | Profile picture; hosted on `hrcdn.net` |
| `country` | string | Country name |
| `city` | string | City |
| `gender` | string | e.g., "male" / "female" / null |
| `birth_date` | string / null | ISO date string |
| `about` / `bio` | string | Free-text bio |
| `created_at` | string | ISO timestamp — account creation date |
| `jobs_headline` | string | Job title / professional headline |
| `school` | string | University / school name |
| `graduation_year` | integer / null | Year of graduation |

---

## 2. Social & External Links

| Field | Type | Notes |
|---|---|---|
| `linkedin_url` | string / null | Full LinkedIn profile URL |
| `github_url` | string / null | GitHub profile URL |
| `website` | string / null | Personal or portfolio website |
| `twitter_url` | string / null | Twitter / X profile URL |

---

## 3. Badges

Returned as an array of badge objects. Each badge represents a skill domain.

### 3.1 Badge Object Schema

| Field | Type | Notes |
|---|---|---|
| `name` | string | Badge name (see §3.2 for full list) |
| `stars` | integer (1–5) | Current star level |
| `current_points` | integer | Points accumulated in this domain |
| `next_level_points` | integer | Points needed to reach the next star |
| `tier` | string | "bronze" / "silver" / "gold" |
| `badge_id` | string | Internal slug ID |

### 3.2 All Available Badges (Earnable Domains)

**Problem Solving**
- Problem Solving (covers Algorithms + Data Structures)

**Language Proficiency**
- C++ (cpp)
- C (c_lang)
- Python
- Java
- Ruby
- JavaScript

**Specialized Skills**
- SQL
- React
- Angular
- RegEx
- Linux Shell
- Functional Programming

**Tutorial / 30-Day Series**
- 30 Days of Code
- 10 Days of JavaScript
- 10 Days of Statistics

### 3.3 Badge Star Levels & Point Thresholds

| Badge | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Problem Solving | 30 | 100 | 200 | 475 | 850 (6★: 2200) |
| C++ | 10 | 40 | 70 | 150 | 250 |
| C | 15 | 50 | 100 | 200 | 500 |
| Python | 35 | 70 | 110 | 220 | 400 |
| Java | 25 | 50 | 80 | 150 | 250 |
| Ruby | 35 | 100 | 200 | 350 | 550 |
| SQL | 80 | 175 | 300 | 450 | 650 |
| React | 120 | 210 | 300 | 450 | 600 |
| 30 Days of Code | 2 | 7 | 15 | 22 | 30 (challenges solved) |
| 10 Days of JS | 2 | 5 | 10 | 17 | 25 (challenges solved) |
| 10 Days of Statistics | 3 | 5 | 10 | 15 | 20 (challenges solved) |

---

## 4. Skills Verification Certificates

Returned as an array. Each certificate is earned by passing a timed proctored assessment.

### 4.1 Certificate Object Schema

| Field | Type | Notes |
|---|---|---|
| `certificate_id` | string | Unique certificate UUID |
| `title` | string | e.g., "Problem Solving (Basic)" |
| `slug` | string | e.g., `problem_solving_basic` |
| `level` | string | "basic" / "intermediate" / "advanced" |
| `issued_at` | string | ISO timestamp |
| `certificate_url` | string | Public shareable verification URL |
| `image_url` | string | Certificate image asset |
| `status` | string | "passed" / "failed" |

### 4.2 All Available Certifications (as of 2025)

**Software Engineering**
- Problem Solving (Basic)
- Problem Solving (Intermediate)

**Languages**
- Python (Basic)
- JavaScript (Basic)
- JavaScript (Intermediate)
- Java (Basic)
- C# (Basic)
- Go (Basic)
- CSS (Basic)

**Databases**
- SQL (Basic)
- SQL (Intermediate)
- SQL (Advanced)

**Frameworks & Specializations**
- Node.js (Intermediate)
- React (Basic)
- Angular (Intermediate)
- Rest API (Intermediate)

**Role-based**
- Software Engineer (role certificate — timed multi-challenge test)
- Frontend Developer (React)

---

## 5. Rankings & Leaderboard Data

### 5.1 Global / Overall

| Field | Type | Notes |
|---|---|---|
| `current_points` | float | Total cumulative points across all tracks |
| `level` | integer | Overall level number |
| `leaderboard_rank` | integer | Global rank position |
| `hacker_rank` | integer | (Deprecated alias) global rank |
| `contest_points` | float | Points earned specifically from contests |

### 5.2 Per-Track Leaderboard

Accessible via: `GET /rest/hackers/{username}/scores`  
Also embedded in the profile model under `track_rank`:

| Field | Type | Notes |
|---|---|---|
| `track` | string | Domain slug (e.g., "algorithms", "sql") |
| `rank` | integer | Rank within that domain's leaderboard |
| `score` | float | Total points in that domain |
| `solved` | integer | Challenges solved count in that domain |

### 5.3 All Practice Track Domains

| Domain | Slug |
|---|---|
| Algorithms | `algorithms` |
| Data Structures | `data-structures` |
| Mathematics | `mathematics` |
| Artificial Intelligence | `ai` |
| Databases | `databases` |
| SQL | `sql` |
| Linux Shell | `shell` |
| Functional Programming | `fp` |
| Regex | `regex` |
| Security | `security` |
| Python | `python` |
| Java | `java` |
| C | `c` |
| C++ | `cpp` |
| JavaScript | `javascript` |
| Ruby | `ruby` |
| Distributed Systems | `distributed-systems` |
| 30 Days of Code | `30daysofcode` |

---

## 6. Contest / Competition Data

### 6.1 Contest Participation Summary

| Field | Type | Notes |
|---|---|---|
| `num_contests_participated` | integer | Total contests entered |
| `medals.gold` | integer | Gold medals earned (top 4% in rated contest) |
| `medals.silver` | integer | Silver medals earned (top 8%) |
| `medals.bronze` | integer | Bronze medals earned (top 13%) |
| `elo_rating` | float | ELO-based competitive rating (starts at 1500) |

### 6.2 Per-Contest Record Object

Accessible via: `GET /rest/contests/{contest_slug}/leaderboard?username={username}`

| Field | Type | Notes |
|---|---|---|
| `contest_slug` | string | URL identifier for the contest |
| `contest_name` | string | Display name |
| `rank` | integer | Final rank in the contest |
| `score` | float | Total score achieved |
| `contest_date` | string | ISO timestamp |
| `is_rated` | boolean | Whether it affected ELO rating |
| `medal` | string / null | "gold" / "silver" / "bronze" / null |
| `challenges_solved` | integer | Number of problems solved |

---

## 7. Submissions Data

### 7.1 Aggregate Stats (in profile model)

| Field | Type | Notes |
|---|---|---|
| `submissions_count` | integer | Total submissions ever made |
| `accepted_submissions` | integer | Submissions that passed all test cases |
| `wrong_submissions` | integer | Submissions that failed |
| `acceptance_rate` | float | accepted / total, as a percentage |
| `last_submission_at` | string | ISO timestamp of most recent submission |

### 7.2 Individual Submission Object

Accessible via: `GET /rest/hackers/{username}/recent_challenges`

| Field | Type | Notes |
|---|---|---|
| `submission_id` | integer | Unique submission ID |
| `challenge_slug` | string | Slug of the challenge |
| `challenge_name` | string | Display name of the challenge |
| `language` | string | Programming language used |
| `score` | float | Score achieved (0–max) |
| `status` | string | "Accepted" / "Wrong Answer" / "Runtime Error" / "Compilation Error" / "Time Limit Exceeded" |
| `submitted_at` | string | ISO timestamp |
| `track` | string | Domain this challenge belongs to |
| `contest_slug` | string / null | Contest it was part of, or null for practice |

---

## 8. Social Graph

| Field | Type | Notes |
|---|---|---|
| `followers_count` | integer | Number of users following this profile |
| `following_count` | integer | Number of users this profile follows |
| `is_following` | boolean | Whether the authenticated user follows them |
| `is_followed_by` | boolean | Whether they follow the authenticated user |

---

## 9. Activity / Timeline

Accessible via: `GET /rest/hackers/{username}/activities?page={n}`

### 9.1 Activity Object Schema

| Field | Type | Notes |
|---|---|---|
| `activity_id` | integer | Unique activity ID |
| `type` | string | Type of activity (see §9.2) |
| `target` | object | Subject of the activity (challenge, badge, etc.) |
| `created_at` | string | ISO timestamp |
| `points_earned` | float / null | Points gained from this action |

### 9.2 Activity Types

- `solved_challenge` — solved a practice challenge
- `submitted` — made any submission
- `earned_badge` — reached a new badge star level
- `earned_certificate` — passed a skills verification
- `followed_user` — followed another hacker
- `joined_contest` — registered for a contest
- `contest_submission` — submitted to a contest problem
- `unlocked_editorial` — unlocked a challenge editorial

---

## 10. Challenge Progress (per domain/sub-domain)

Accessible via: `GET /rest/contests/master/tracks/{track_slug}/challenges?username={username}`

| Field | Type | Notes |
|---|---|---|
| `challenge_slug` | string | Unique identifier |
| `challenge_name` | string | Display name |
| `difficulty` | string | "Easy" / "Medium" / "Hard" / "Advanced" / "Expert" |
| `score` | float | Points awarded for challenge |
| `max_score` | float | Maximum possible points |
| `solved` | boolean | Whether user has a full-score submission |
| `attempted` | boolean | Whether user has any submission |
| `user_score` | float | User's best score on this challenge |
| `solution_language` | string / null | Language of the accepted solution |
| `sub_domain` | string | Sub-category within the track |

---

## 11. Profile Metadata

| Field | Type | Notes |
|---|---|---|
| `id` | integer | Internal user ID |
| `created_at` | string | ISO — account creation date |
| `updated_at` | string | ISO — last profile edit |
| `last_login_at` | string / null | ISO — last login timestamp |
| `is_email_verified` | boolean | Email verification status |
| `is_hr_approved` | boolean | HackerRank for Work account flag |
| `is_amateur` | boolean | Whether still in "learning" classification |
| `is_hired` | boolean | Hired via HackerRank flag |

---

## 12. Additional API Endpoints for Dashboard

| Endpoint | Returns |
|---|---|
| `GET /rest/contests/master/hackers/{username}/profile` | Full profile `model` object |
| `GET /rest/hackers/{username}/scores` | Per-track scores and ranks |
| `GET /rest/hackers/{username}/recent_challenges` | Last N solved challenges |
| `GET /rest/hackers/{username}/activities` | Paginated activity feed |
| `GET /rest/contests/master/leaderboard?username={username}` | Global leaderboard position |
| `GET /rest/hackers/{username}/followers` | Follower list (paginated) |
| `GET /rest/hackers/{username}/following` | Following list (paginated) |
| `GET /rest/contests/{contest_slug}/leaderboard` | Contest-specific leaderboard |

---

## 13. Summary: Dashboard Widget Map

| Dashboard Widget | Data Fields |
|---|---|
| **Profile Hero Card** | `name`, `username`, `avatar`, `country`, `city`, `jobs_headline`, `school`, `about`, `created_at` |
| **Social Links Bar** | `linkedin_url`, `github_url`, `twitter_url`, `website` |
| **Badges Gallery** | `badges[]` → `name`, `stars`, `current_points`, `next_level_points`, `tier` |
| **Certificates Wall** | `certificates[]` → `title`, `level`, `issued_at`, `certificate_url` |
| **Global Rank Card** | `leaderboard_rank`, `current_points`, `level`, `elo_rating` |
| **Per-Track Rankings** | `track_rank[]` → `track`, `rank`, `score`, `solved` |
| **Medals Tally** | `medals.gold`, `medals.silver`, `medals.bronze`, `num_contests_participated` |
| **Submission Stats** | `submissions_count`, `accepted_submissions`, `acceptance_rate`, `last_submission_at` |
| **Language Breakdown** | Aggregated from submission objects → `language` frequency |
| **Recent Submissions Feed** | `submissions[]` → `challenge_name`, `language`, `score`, `status`, `submitted_at` |
| **Activity Timeline** | `activities[]` → `type`, `target`, `created_at`, `points_earned` |
| **Social Graph** | `followers_count`, `following_count` |
| **Track Progress Bars** | per-domain: `score`, `max_score`, `solved`, `attempted` |
| **Contest History Table** | `contest_name`, `rank`, `score`, `date`, `medal`, `is_rated` |
| **ELO Rating Chart** | `elo_rating` over time (requires activity feed parsing) |

---

## 14. Notes for Implementation

1. **CORS** — The HackerRank public profile API is accessible from the browser but may rate-limit aggressive polling. Cache responses.
2. **Authentication** — The profile API at `/rest/contests/master/hackers/{username}/profile` is **publicly accessible** (no auth required) for public profiles. The HackerRank for Work API (`/work/apidocs`) is separate and requires an enterprise API key.
3. **Pagination** — Activity feeds, follower/following lists, and submission histories are paginated. Use `?page=N&limit=M` parameters.
4. **Dynamic Scoring** — Challenge `max_score` may vary over time due to HackerRank's dynamic scoring formula (`score = sf × cf`).
5. **Null Fields** — Many optional fields (`city`, `gender`, `github_url`, etc.) will be `null` if not set by the user. Always handle nulls gracefully.
6. **Badge Stars** — Problem Solving can go up to **6 stars** (2200 pts), unlike other badges capped at 5.
7. **Medals** — Only awarded in **rated contests**; not all contests are rated.
8. **ELO Rating** — Starts at 1500 for all users and moves based on rated contest performance only.
