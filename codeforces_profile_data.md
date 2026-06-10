# Codeforces Profile — Complete Data Reference for Dashboard Building

> All data sourced from the official Codeforces API (`https://codeforces.com/api/`).  
> Rate limit: **1 request per 2 seconds** (anonymous). Authenticated requests require an API key + secret from `codeforces.com/settings/api`.

---

## Table of Contents

1. [API Endpoints (User-Specific)](#1-api-endpoints-user-specific)
2. [User Object — Profile Fields](#2-user-object--profile-fields)
3. [Rating History — RatingChange Object](#3-rating-history--ratingchange-object)
4. [Submissions — Submission Object](#4-submissions--submission-object)
5. [Problem Object (per submission)](#5-problem-object-per-submission)
6. [Party & Member (author of submission)](#6-party--member-author-of-submission)
7. [Blog Entries — BlogEntry Object](#7-blog-entries--blogentry-object)
8. [Comments — Comment Object](#8-comments--comment-object)
9. [Contest Object](#9-contest-object)
10. [Hack Object](#10-hack-object)
11. [Ranklist / Standings Data](#11-ranklist--standings-data)
12. [Enumerations (All Possible Values)](#12-enumerations-all-possible-values)
13. [Derived / Computed Metrics (not in API, must calculate)](#13-derived--computed-metrics-not-in-api-must-calculate)
14. [Authentication-Only Data](#14-authentication-only-data)
15. [API Quick Reference](#15-api-quick-reference)

---

## 1. API Endpoints (User-Specific)

| Endpoint | Method | Description |
|---|---|---|
| `user.info?handles={handle}` | GET | Core profile data (up to 10,000 handles per call) |
| `user.rating?handle={handle}` | GET | Full rating change history across all rated contests |
| `user.status?handle={handle}&from=1&count=N` | GET | All submissions (paginated, sorted by submission ID desc) |
| `user.blogEntries?handle={handle}` | GET | All blog posts written by the user |
| `user.friends?onlyOnline=false` | GET | Friend list (**authenticated only**) |
| `user.ratedList?activeOnly=true` | GET | Global rated user list (not user-specific, but filterable) |

---

## 2. User Object — Profile Fields

Returned by `user.info`. These are the **root profile fields**.

| Field | Type | Notes |
|---|---|---|
| `handle` | `string` | The unique username / handle |
| `firstName` | `string \| null` | First name (optional, set by user) |
| `lastName` | `string \| null` | Last name (optional, set by user) |
| `country` | `string \| null` | Country name (optional) |
| `city` | `string \| null` | City name (optional) |
| `organization` | `string \| null` | School / company / org name (optional) |
| `email` | `string \| null` | Email (only visible when authenticated as that user) |
| `vkId` | `string \| null` | VKontakte profile ID (optional) |
| `openId` | `string \| null` | OpenID (optional) |
| `rating` | `int` | Current rating (ELO-style) |
| `maxRating` | `int` | Peak rating ever achieved |
| `rank` | `string` | Current rank title (e.g., "specialist") |
| `maxRank` | `string` | Peak rank title ever held |
| `contribution` | `int` | Community contribution score (from blog posts, problem proposals, etc.) |
| `friendOfCount` | `int` | How many other users have added this user as a friend |
| `lastOnlineTimeSeconds` | `int` | Unix timestamp of last activity |
| `registrationTimeSeconds` | `int` | Unix timestamp of account creation |
| `avatar` | `string` | URL of the profile picture (small square) |
| `titlePhoto` | `string` | URL of the banner/title photo (larger header image) |

---

## 3. Rating History — RatingChange Object

Returned by `user.rating`. One object per **rated contest participated in**.

| Field | Type | Notes |
|---|---|---|
| `contestId` | `int` | Unique ID of the contest |
| `contestName` | `string` | Full display name of the contest (e.g., "Codeforces Round #900 (Div. 3)") |
| `handle` | `string` | User's handle at the time of the contest |
| `rank` | `int` | The user's final rank in that contest |
| `ratingUpdateTimeSeconds` | `int` | Unix timestamp when the rating was recalculated |
| `oldRating` | `int` | Rating before this contest |
| `newRating` | `int` | Rating after this contest |

**Derived from RatingChange:**
- `delta = newRating - oldRating` (positive = gain, negative = loss)
- Max rating gain in a single contest
- Max rating loss in a single contest
- Total contests participated in (length of array)
- Best rank ever in a contest

---

## 4. Submissions — Submission Object

Returned by `user.status`. One object per submission (all-time).

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | Unique submission ID (monotonically increasing) |
| `contestId` | `int \| null` | Contest the submission was made in (null for practice/gym) |
| `creationTimeSeconds` | `int` | Unix timestamp of submission |
| `relativeTimeSeconds` | `int` | Time since contest started when submitted (in seconds) |
| `problem` | `Problem` | Problem object (see Section 5) |
| `author` | `Party` | Who submitted (see Section 6) |
| `programmingLanguage` | `string` | Language string, e.g., `"GNU C++17"`, `"Python 3"`, `"Java 17"` |
| `verdict` | `Verdict enum` | Result of the submission (see Section 12) |
| `testset` | `TestSet enum` | Which test set was used (TESTS, PRETESTS, etc.) |
| `passedTestCount` | `int` | Number of tests passed before failure (or total if AC) |
| `timeConsumedMillis` | `int` | Peak execution time in milliseconds |
| `memoryConsumedBytes` | `int` | Peak memory usage in bytes |
| `points` | `float \| null` | Points awarded (used in IOI-style and educational rounds) |

---

## 5. Problem Object (per submission)

Embedded inside Submission and RanklistRow objects.

| Field | Type | Notes |
|---|---|---|
| `contestId` | `int \| null` | Contest this problem belongs to |
| `problemsetName` | `string \| null` | Name of the problemset if not from a contest |
| `index` | `string` | Problem letter/index within the round (e.g., `"A"`, `"B"`, `"C1"`) |
| `name` | `string` | Full problem title |
| `type` | `ProblemType enum` | `PROGRAMMING` or `QUESTION` |
| `points` | `float \| null` | Maximum points for this problem (ICPC-style rounds) |
| `rating` | `int \| null` | Difficulty rating of the problem (e.g., 800–3500) |
| `tags` | `List<string>` | Algorithm/topic tags (e.g., `["dp", "greedy", "graphs"]`) |

---

## 6. Party & Member (author of submission)

The `author` field of a Submission is a **Party** object.

### Party Object

| Field | Type | Notes |
|---|---|---|
| `contestId` | `int \| null` | Contest associated with this party |
| `members` | `List<Member>` | List of team members (usually just 1 for solo) |
| `participantType` | `ParticipantType enum` | How they joined (CONTESTANT, VIRTUAL, OUT_OF_COMPETITION, etc.) |
| `teamId` | `int \| null` | Team ID (if team contest) |
| `teamName` | `string \| null` | Team name (if team contest) |
| `ghost` | `bool` | Whether the participant is a "ghost" (virtual competitor) |
| `room` | `int \| null` | Room number assigned in the contest |
| `startTimeSeconds` | `int \| null` | When the participant started (relevant for virtual) |

### Member Object

| Field | Type | Notes |
|---|---|---|
| `handle` | `string` | User handle |
| `name` | `string \| null` | Display name (optional) |

---

## 7. Blog Entries — BlogEntry Object

Returned by `user.blogEntries`. Each entry is a blog post the user wrote.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | Unique blog entry ID |
| `originalLocale` | `string` | Language the post was originally written in (e.g., `"en"`, `"ru"`) |
| `creationTimeSeconds` | `int` | Unix timestamp of original post creation |
| `authorHandle` | `string` | Handle of the post author |
| `title` | `string` | Post title |
| `content` | `string \| null` | Full HTML content (only available in full version, not short version) |
| `locale` | `string` | Language of the returned content |
| `modificationTimeSeconds` | `int` | Unix timestamp of last edit |
| `allowViewHistory` | `bool` | Whether edit history is public |
| `tags` | `List<string>` | Tags/labels on the post |
| `rating` | `int` | Community upvote/downvote score |

---

## 8. Comments — Comment Object

Embedded in blog entry data (`blogEntry.comments`).

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | Unique comment ID |
| `creationTimeSeconds` | `int` | Unix timestamp |
| `commentatorHandle` | `string` | Handle of who wrote the comment |
| `locale` | `string` | Language of the comment |
| `text` | `string` | Raw comment content |
| `parentCommentId` | `int \| null` | Parent comment ID (for threaded replies) |
| `rating` | `int` | Upvotes − downvotes on the comment |

---

## 9. Contest Object

Used in standings, rating history, and contest list endpoints.

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | Unique contest ID |
| `name` | `string` | Full contest name |
| `type` | `ContestType enum` | `CF`, `IOI`, or `ICPC` (scoring format) |
| `phase` | `ContestPhase enum` | `BEFORE`, `CODING`, `PENDING_SYSTEM_TEST`, `SYSTEM_TEST`, `FINISHED` |
| `frozen` | `bool` | Whether the scoreboard is currently frozen |
| `durationSeconds` | `int \| null` | Duration of the contest in seconds |
| `freezeDurationSeconds` | `int \| null` | Duration of scoreboard freeze |
| `startTimeSeconds` | `int \| null` | Unix timestamp of contest start |
| `relativeTimeSeconds` | `int \| null` | Current time relative to contest start |
| `preparedBy` | `string \| null` | Handle of the contest author/setter |
| `websiteUrl` | `string \| null` | External website link (for ICPC-style external contests) |
| `description` | `string \| null` | Short description |
| `difficulty` | `int \| null` | Difficulty score (1–5 stars, where applicable) |
| `kind` | `string \| null` | Informal category (e.g., `"Official ICPC Contest"`) |
| `icpcRegion` | `string \| null` | ICPC region (for ICPC contests) |
| `country` | `string \| null` | Country (for ICPC contests) |
| `city` | `string \| null` | City (for ICPC contests) |
| `season` | `string \| null` | Season/year (for ICPC contests) |

---

## 10. Hack Object

Returned via `contest.hacks` (requires authentication for private hacks during a live contest).

| Field | Type | Notes |
|---|---|---|
| `id` | `int` | Unique hack ID |
| `creationTimeSeconds` | `int` | Unix timestamp of the hack attempt |
| `hacker` | `Party` | Who performed the hack |
| `defender` | `Party` | Whose solution was hacked |
| `verdict` | `Verdict enum` | `HACK_SUCCESSFUL` or `HACK_UNSUCCESSFUL` |
| `problem` | `Problem` | The problem that was hacked |
| `test` | `string \| null` | The test input used in the hack (if revealed) |
| `judgeProtocol` | `Dict \| null` | Internal judge protocol data |

---

## 11. Ranklist / Standings Data

Returned by `contest.standings`. Used to get a user's position in specific contests.

### RanklistRow Object

| Field | Type | Notes |
|---|---|---|
| `party` | `Party` | The team/user this row belongs to |
| `rank` | `int` | Final rank in the contest |
| `points` | `float` | Total points scored |
| `penalty` | `int` | Total penalty time (minutes, ICPC-style) |
| `successfulHackCount` | `int` | Number of successful hacks during contest |
| `unsuccessfulHackCount` | `int` | Number of failed hack attempts |
| `problemResults` | `List<ProblemResult>` | Per-problem breakdown |
| `lastSubmissionTimeSeconds` | `int \| null` | Time of last submission in contest |

### ProblemResult Object (per problem per contest)

| Field | Type | Notes |
|---|---|---|
| `points` | `float` | Points earned on this problem |
| `penalty` | `int \| null` | Penalty time for this problem |
| `rejectedAttemptCount` | `int` | Number of wrong/failed attempts before acceptance |
| `type` | `ProblemResultType enum` | `PRELIMINARY` (pretests) or `FINAL` |
| `bestSubmissionTimeSeconds` | `int \| null` | Time of the best/accepted submission |

### ProblemStatistics Object

| Field | Type | Notes |
|---|---|---|
| `contestId` | `int \| null` | Contest this problem belongs to |
| `index` | `string` | Problem index (e.g., `"A"`) |
| `solvedCount` | `int` | Global count of users who solved this problem |

---

## 12. Enumerations (All Possible Values)

### Verdict (submission result)

| Value | Meaning |
|---|---|
| `OK` | Accepted ✅ |
| `WRONG_ANSWER` | Wrong Answer ❌ |
| `TIME_LIMIT_EXCEEDED` | Time Limit Exceeded ⏱️ |
| `MEMORY_LIMIT_EXCEEDED` | Memory Limit Exceeded 💾 |
| `RUNTIME_ERROR` | Runtime Error (crash, segfault, etc.) 💥 |
| `COMPILATION_ERROR` | Compilation Error 🔧 |
| `PRESENTATION_ERROR` | Presentation Error (output format wrong) |
| `IDLENESS_LIMIT_EXCEEDED` | Idleness Limit Exceeded (no output) |
| `PARTIAL` | Partial score (IOI-style) |
| `FAILED` | Failed (general failure) |
| `SKIPPED` | Skipped |
| `CHALLENGED` | Accepted but later hacked |
| `REJECTED` | Rejected |
| `TESTING` | Currently being judged |
| `SUBMITTED` | Submitted, awaiting queue |

### Rank (rating-based titles)

| Rank | Rating Range | Color |
|---|---|---|
| Legendary Grandmaster | ≥ 3000 | Black & Red |
| International Grandmaster | 2600–2999 | Red |
| Grandmaster | 2400–2599 | Red |
| International Master | 2300–2399 | Orange |
| Master | 2100–2299 | Orange |
| Candidate Master | 1900–2099 | Violet/Purple |
| Expert | 1600–1899 | Blue |
| Specialist | 1400–1599 | Cyan |
| Pupil | 1200–1399 | Green |
| Newbie | 0–1199 | Gray |

### ContestType

| Value | Meaning |
|---|---|
| `CF` | Codeforces format (standard, with penalty-free scoring) |
| `IOI` | IOI format (partial scoring, subtasks) |
| `ICPC` | ICPC format (penalty-based, no partial credit) |

### ContestPhase

| Value | Meaning |
|---|---|
| `BEFORE` | Contest hasn't started yet |
| `CODING` | Contest is currently running |
| `PENDING_SYSTEM_TEST` | Waiting for system tests |
| `SYSTEM_TEST` | System tests in progress |
| `FINISHED` | Contest is over |

### ParticipantType

| Value | Meaning |
|---|---|
| `CONTESTANT` | Registered competitor |
| `PRACTICE` | Practicing after contest ended |
| `VIRTUAL` | Virtual participant (replays contest solo) |
| `MANAGER` | Contest manager/organizer |
| `OUT_OF_COMPETITION` | Unrated participant (over-rated, or guest) |
| `SPECTATOR` | Observer only |

### ProblemResultType

| Value | Meaning |
|---|---|
| `PRELIMINARY` | Based on pretests only (during contest) |
| `FINAL` | Based on full test suite (after system tests) |

### ProblemType

| Value | Meaning |
|---|---|
| `PROGRAMMING` | Standard coding problem |
| `QUESTION` | Multiple-choice or non-coding question |

### TestSet

| Value | Meaning |
|---|---|
| `SAMPLES` | Only sample test cases |
| `PRETESTS` | Subset of tests used during contest |
| `TESTS` | Full test suite |
| `CHALLENGES` | Hack test cases |
| `TESTS1` – `TESTS10` | Sub-groups of tests (for multi-phase judging) |

---

## 13. Derived / Computed Metrics (not in API, must calculate)

These are not raw API fields but are **highly valuable for a dashboard** and computed client-side from the raw data above.

### From `user.info`

- Account age (days since `registrationTimeSeconds`)
- Time since last online (`lastOnlineTimeSeconds`)
- Rating delta to next rank (e.g., X points to Expert)
- Rating color (map `rating` to rank/color table above)

### From `user.rating` (rating history array)

- Total rated contests participated in
- Best contest rank (min of `rank` across all entries)
- Worst contest rank
- Largest single-contest rating gain (max `newRating - oldRating`)
- Largest single-contest rating loss (min `newRating - oldRating`)
- Average rating change per contest
- Rating over time chart (plot `newRating` vs `ratingUpdateTimeSeconds`)
- First contest (oldest entry)
- Most recent rated contest
- Number of rating gains vs losses (win/loss ratio)
- Number of times user changed rank tier
- Longest rating improvement streak (N consecutive contests with delta > 0)
- Longest rating decline streak

### From `user.status` (submissions array)

- Total submissions ever
- Total accepted submissions (verdict == `OK`)
- Total unique problems solved (deduplicate by `problem.contestId + problem.index`)
- Acceptance rate (`OK / total`)
- Problems solved per difficulty rating bucket (e.g., how many 800-rated, 900-rated, etc.)
- Problems solved per tag (e.g., count of dp, greedy, graphs)
- Submission heatmap / calendar (group by date)
- Submissions per programming language (frequency)
- Average time consumed on accepted submissions
- Average memory consumed on accepted submissions
- Fastest accepted submission
- Submission activity over time (submissions per month/week)
- Total unique contests attempted (from `submission.contestId`)
- Problems solved in contests vs practice (by `author.participantType`)
- Wrong answers per problem before first AC (penalty count)
- First submission ever (`min creationTimeSeconds`)
- Most recent submission (`max creationTimeSeconds`)
- Most common failure reason (TLE vs WA vs RE breakdown)

### From `user.blogEntries`

- Total blog posts written
- Total community approval score (sum of all blog `rating` values)
- Most popular post (max `rating`)
- Number of posts per topic tag
- Posting frequency over time

### Cross-Source Derived Metrics

- Problems solved per contest (from rating history + submissions joined)
- Average problems solved in each rated contest
- Total hacks attempted / successful (from RanklistRow)
- Hack success rate
- Highest-rated problem ever solved
- Problems solved outside rated contests (practice only)
- "Unique days with a submission" — active days metric
- Participation in Div. 1 vs Div. 2 vs Div. 3 vs Div. 4 contests

---

## 14. Authentication-Only Data

These fields require an API key generated at `codeforces.com/settings/api`. The key/secret pair is passed in requests as HMAC-SHA512 signed parameters.

| Data | Endpoint | Notes |
|---|---|---|
| Friend list | `user.friends` | Returns a list of handles the authenticated user has friended |
| Online friends only | `user.friends?onlyOnline=true` | Filters to currently online friends |
| Private hacks during a live contest | `contest.hacks` | During a running contest, hack test cases are private |
| Group management data | `group.isManager` | Whether a user is a manager of a specific group |
| Private/Mashup contests | `contest.list` (authenticated) | Unlists private gyms and mashups available only to you |

---

## 15. API Quick Reference

```
Base URL: https://codeforces.com/api/

# Core user data
GET /user.info?handles=HANDLE
GET /user.rating?handle=HANDLE
GET /user.status?handle=HANDLE&from=1&count=10000
GET /user.blogEntries?handle=HANDLE

# Contest data (useful for cross-referencing)
GET /contest.list?gym=false
GET /contest.standings?contestId=ID&handles=HANDLE&from=1&count=5
GET /contest.status?contestId=ID&handle=HANDLE

# Problems
GET /problemset.problems?tags=dp&minRating=1200&maxRating=1600

# Recent site actions
GET /recentActions?maxCount=100
```

**Response format:** All responses are JSON in the form:
```json
{
  "status": "OK",
  "result": { ... }
}
```
On error:
```json
{
  "status": "FAILED",
  "comment": "handles: User with handle MikeMe not found"
}
```

**Rate limit:** 1 request per 2 seconds per IP (anonymous). Exceeding returns `"FAILED"` with `"Call limit exceeded"`.

---

*Last updated: June 2026 | Source: Codeforces Official API (codeforces.com/apiHelp)*
