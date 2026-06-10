# LeetCode Profile — Complete Data Reference

> A comprehensive map of every data point available on a LeetCode user profile, sourced from the public GraphQL API (`https://leetcode.com/graphql`), community-built REST wrappers, and the LeetCode UI itself. Organized by data domain for dashboard building.

---

## 1. Basic Public Profile (`userPublicProfile`)

| Field | Type | Description |
|---|---|---|
| `username` | String | Unique handle |
| `realName` | String | Display name (optional) |
| `userAvatar` | URL | Profile picture URL |
| `aboutMe` | String | Bio / about section |
| `school` | String | School or university |
| `company` | String | Employer |
| `jobTitle` | String | Job title |
| `countryName` | String | Country |
| `websites` | String[] | Personal websites |
| `skillTags` | String[] | Self-tagged skills |
| `githubUrl` | URL | Linked GitHub profile |
| `linkedinUrl` | URL | Linked LinkedIn profile |
| `twitterUrl` | URL | Linked Twitter/X profile |
| `reputation` | Int | Community reputation score |
| `ranking` | Int | Global problem-solving rank |

---

## 2. Solving Statistics (`submitStats` / `submitStatsGlobal`)

These are split by difficulty: `All`, `Easy`, `Medium`, `Hard`.

### Accepted Submissions (`acSubmissionNum`)

| Field | Type | Description |
|---|---|---|
| `difficulty` | Enum | `All` / `Easy` / `Medium` / `Hard` |
| `count` | Int | Number of unique problems solved |
| `submissions` | Int | Total accepted submission attempts |

### Total Submissions (`totalSubmissionNum`)

| Field | Type | Description |
|---|---|---|
| `difficulty` | Enum | `All` / `Easy` / `Medium` / `Hard` |
| `count` | Int | Number of problems attempted |
| `submissions` | Int | Total submission attempts (all verdicts) |

### Derived / Computed Fields

| Field | Description |
|---|---|
| `easySolved` | Count of easy problems solved |
| `mediumSolved` | Count of medium problems solved |
| `hardSolved` | Count of hard problems solved |
| `totalSolved` | Sum across all difficulties |
| `totalEasy` / `totalMedium` / `totalHard` | Platform-wide problem counts per tier |
| `totalQuestions` | Total problems on LeetCode |
| `acceptanceRate` | `acceptedSubmissions / totalSubmissions × 100` |
| `contributionPoints` | Legacy contribution score |

### "Beats" Percentile (`problemsSolvedBeatsStats`)

| Field | Type | Description |
|---|---|---|
| `difficulty` | Enum | `Easy` / `Medium` / `Hard` |
| `percentage` | Float | % of users you beat at that difficulty |

---

## 3. Activity Calendar (`userCalendar`)

Queryable by `year` (defaults to current year).

| Field | Type | Description |
|---|---|---|
| `activeYears` | Int[] | Years the user was active |
| `streak` | Int | Current consecutive-day streak |
| `totalActiveDays` | Int | Total days with at least one submission |
| `submissionCalendar` | JSON (Unix→Int map) | Daily submission counts: `{ "timestamp": count }` |
| `daysSkipped` | Int | Days without a submission in the year (derived) |

> **Note:** `submissionCalendar` is a flat JSON object. Keys are Unix timestamps (start of day), values are submission counts. This powers the activity heatmap.

---

## 4. Badges (`userBadges`)

### Earned Badges

| Field | Type | Description |
|---|---|---|
| `name` | String | Badge identifier name |
| `displayName` | String | Human-readable badge name |
| `icon` | URL | Badge icon image |
| `creationDate` | String | Date badge was earned |
| `shortName` | String | Short badge label |
| `medalIcon` | URL | Medal/award variant icon |

### Upcoming Badges

| Field | Type | Description |
|---|---|---|
| `name` | String | Badge name |
| `icon` | URL | Badge icon |
| `progress` | Int | Current progress toward earning |

### Active Badge

| Field | Type | Description |
|---|---|---|
| `name` | String | Currently displayed badge |
| `icon` | URL | Icon of the active badge |

### Contest Badge (`contestBadge`)

| Field | Type | Description |
|---|---|---|
| `name` | String | Contest tier name (e.g. Guardian, Knight) |
| `expired` | Boolean | Whether the badge has expired |
| `hoverText` | String | Tooltip text for the badge |
| `icon` | URL | Badge icon |

---

## 5. Contest Data

### Overall Contest Ranking (`userContestRanking`)

| Field | Type | Description |
|---|---|---|
| `attendedContestsCount` | Int | Total contests participated in |
| `rating` | Float | Current contest rating (Elo-like) |
| `globalRanking` | Int | Global rank among contest participants |
| `totalParticipants` | Int | Total registered contest participants |
| `topPercentage` | Float | Percentile rank (lower = better) |
| `badge` | Object | Current contest tier badge (`name`) |

### Contest History (`userContestRankingHistory`)

Per-contest entry, one object per contest attended:

| Field | Type | Description |
|---|---|---|
| `attended` | Boolean | Whether user actually participated |
| `rating` | Float | Rating after this contest |
| `ranking` | Int | Rank in this specific contest |
| `trendDirection` | Enum | `UP` / `DOWN` (rating change direction) |
| `problemsSolved` | Int | Problems solved in this contest |
| `totalProblems` | Int | Total problems in this contest |
| `finishTimeInSeconds` | Int | Time taken to finish (penalty included) |
| `contest.title` | String | Contest name |
| `contest.startTime` | Unix | Contest start timestamp |

---

## 6. Language Stats (`languageProblemCount`)

One entry per programming language used.

| Field | Type | Description |
|---|---|---|
| `languageName` | String | Language name (e.g. Python3, Java, C++) |
| `problemsSolved` | Int | Problems solved using this language |

---

## 7. Skill / Topic Stats (`tagProblemCounts`)

Problems solved, grouped by topic tag and proficiency tier.

Three sub-lists: `advanced`, `intermediate`, `fundamental`.

Each entry:

| Field | Type | Description |
|---|---|---|
| `tagName` | String | Topic name (e.g. Dynamic Programming) |
| `tagSlug` | String | URL slug for the tag |
| `problemsSolved` | Int | Problems solved under this tag |

---

## 8. Submissions

### Recent Submissions (`recentSubmissionList`)

Up to 20 most recent submissions (all verdicts):

| Field | Type | Description |
|---|---|---|
| `id` | String | Submission ID |
| `title` | String | Problem title |
| `titleSlug` | String | Problem URL slug |
| `timestamp` | Unix | Submission time |
| `statusDisplay` | String | Verdict (e.g. Accepted, Wrong Answer, TLE) |
| `lang` | String | Language used |
| `runtime` | String | Runtime result |
| `memory` | String | Memory usage result |

### Recent Accepted Submissions (`recentAcSubmissionList`)

Up to 20 most recent accepted submissions:

| Field | Type | Description |
|---|---|---|
| `id` | String | Submission ID |
| `title` | String | Problem title |
| `titleSlug` | String | Problem URL slug |
| `timestamp` | Unix | Submission time |

> **API Limit:** LeetCode's public GraphQL API caps `userSubmissions` and `recentAcSubmissionList` at 20 items. There is no official pagination for full submission history. Community APIs like `alfa-leetcode-api` expose a `?limit=` param but it is still bounded by this upstream constraint.

---

## 9. Question Progress (`userSessionProgress`)

This combines global platform counts with user-specific stats:

| Field | Type | Description |
|---|---|---|
| `allQuestionsCount[difficulty]` | Int | Total problems per difficulty on the platform |
| `acSubmissionNum[difficulty].count` | Int | Problems solved by the user per difficulty |
| `acSubmissionNum[difficulty].submissions` | Int | Accepted submission attempts per difficulty |
| `totalSubmissionNum[difficulty].count` | Int | Problems attempted per difficulty |
| `totalSubmissionNum[difficulty].submissions` | Int | Total attempts (all verdicts) per difficulty |

---

## 10. Problem / Question Data

### Problem List (`problemsetQuestionList`)

Filterable by `tags`, `difficulty`, `limit`, `skip`.

| Field | Type | Description |
|---|---|---|
| `total` | Int | Total problem count matching filters |
| `acRate` | Float | Global acceptance rate for this problem |
| `difficulty` | Enum | `Easy` / `Medium` / `Hard` |
| `freqBar` | Float | Frequency/popularity bar value |
| `frontendQuestionId` | String | Display problem number (e.g. "1") |
| `isFavor` | Boolean | Whether user starred this problem |
| `paidOnly` | Boolean | Whether it's a premium problem |
| `status` | String | User's status (`ac`, `notac`, null) |
| `title` | String | Problem title |
| `titleSlug` | String | URL slug |
| `topicTags` | Object[] | Topic tags (`name`, `id`, `slug`) |
| `hasSolution` | Boolean | Has an official solution |
| `hasVideoSolution` | Boolean | Has a video solution |

### Single Problem Detail (`question`)

| Field | Type | Description |
|---|---|---|
| `questionId` | String | Internal problem ID |
| `questionFrontendId` | String | Displayed problem number |
| `title` | String | Problem title |
| `titleSlug` | String | URL slug |
| `content` | HTML | Full problem statement |
| `difficulty` | Enum | Easy / Medium / Hard |
| `exampleTestcases` | String | Sample test inputs |
| `categoryTitle` | String | Problem category |
| `topicTags` | Object[] | Tags with name, slug, ID |
| `hints` | String[] | Official hints |
| `solution` | Object | Solution metadata (if available) |
| `acRate` | Float | Acceptance rate |
| `likes` | Int | Upvotes |
| `dislikes` | Int | Downvotes |
| `isPaidOnly` | Boolean | Premium-only flag |
| `codeSnippets` | Object[] | Starter code per language |
| `stats` | JSON | Submission stats (total accepted, etc.) |
| `similarQuestions` | JSON | Array of related questions |
| `companyTagStats` | JSON | Company frequency data (premium) |

---

## 11. Contest Platform Data

### All Contests (`contests`)

| Field | Type | Description |
|---|---|---|
| `title` | String | Contest name |
| `titleSlug` | String | URL slug |
| `startTime` | Unix | Start timestamp |
| `duration` | Int | Duration in seconds |
| `originStartTime` | Unix | Original scheduled time |
| `isVirtual` | Boolean | Whether it's a virtual contest |
| `description` | String | Contest description |
| `questions` | Object[] | Problems in the contest (title, slug, difficulty) |

### Upcoming Contests

Same schema as above, filtered to future events.

---

## 12. Discussions

### Trending Discussions

| Field | Type | Description |
|---|---|---|
| `id` | String | Topic ID |
| `title` | String | Discussion title |
| `commentCount` | Int | Number of comments |
| `viewCount` | Int | View count |
| `pinned` | Boolean | Pinned status |
| `tags` | Object[] | Associated tags |
| `post.content` | String | Post body |
| `post.author.username` | String | Author username |
| `post.creationDate` | Unix | Post date |

### Discussion Topic Detail

| Field | Type | Description |
|---|---|---|
| `id` | String | Topic ID |
| `title` | String | Title |
| `commentCount` | Int | Comment count |
| `viewCount` | Int | Views |
| `post.content` | HTML | Full post content |
| `post.author.username` | String | Username |
| `post.author.userAvatar` | URL | Avatar |
| `post.creationDate` | Unix | Timestamp |

### Discussion Comments

| Field | Type | Description |
|---|---|---|
| `id` | String | Comment ID |
| `content` | String | Comment body |
| `author.username` | String | Commenter |
| `creationDate` | Unix | Timestamp |
| `voteCount` | Int | Upvotes on comment |
| `pinned` | Boolean | Pinned comment flag |

---

## 13. Daily Challenge (`activeDailyCodingChallengeQuestion`)

| Field | Type | Description |
|---|---|---|
| `date` | String | Date string (YYYY-MM-DD) |
| `userStatus` | String | Whether user solved it today |
| `link` | String | Problem URL |
| `question.title` | String | Problem title |
| `question.titleSlug` | String | URL slug |
| `question.difficulty` | Enum | Difficulty |
| `question.acRate` | Float | Acceptance rate |
| `question.topicTags` | Object[] | Topic tags |
| `question.content` | HTML | Problem statement |
| `question.isPaidOnly` | Boolean | Premium flag |

---

## 14. Community / Social Stats (UI-visible, limited API access)

These appear on the profile page UI. Some are directly queryable; others are partially accessible:

| Field | Description | API Access |
|---|---|---|
| Profile Views | Total profile views + last-week views | Partial (some endpoints) |
| Solutions Posted | Number of editorial/solution posts | UI only |
| Discussions Started | Discussion thread count | UI only |
| Reputation | Community upvote-based score | `profile.reputation` |
| Contribution Points | Legacy contribution system | `contributionPoints` |

---

## 15. Dashboard Summary — Data Domain Map

| Dashboard Widget | Data Source / GraphQL Query |
|---|---|
| Profile Card | `userPublicProfile` |
| Solved Problems Donut | `submitStatsGlobal.acSubmissionNum` |
| Beats % Bar | `problemsSolvedBeatsStats` |
| Acceptance Rate | Derived from `submitStats` |
| Activity Heatmap | `userCalendar.submissionCalendar` |
| Streak Counter | `userCalendar.streak` |
| Total Active Days | `userCalendar.totalActiveDays` |
| Contest Rating Chart | `userContestRankingHistory` |
| Contest Ranking Card | `userContestRanking` |
| Contest Badge | `contestBadge` |
| Language Breakdown | `languageProblemCount` |
| Skill Tags Chart | `tagProblemCounts` |
| Recent Submissions Feed | `recentSubmissionList` |
| Recent AC Submissions | `recentAcSubmissionList` |
| Badges Gallery | `badges` + `activeBadge` + `upcomingBadges` |
| Problem Progress Tracker | `userSessionProgress` |
| Daily Challenge Card | `activeDailyCodingChallengeQuestion` |

---

## 16. API Access Notes

| Method | URL | Auth Required |
|---|---|---|
| Official GraphQL | `https://leetcode.com/graphql` | No (public fields) |
| alfa-leetcode-api | `https://alfa-leetcode-api.onrender.com/:username` | No |
| leetcode-stats-api | `https://leetcode-stats-api.herokuapp.com/:username` | No |
| LeetCard (stats card) | `https://leetcard.jacoblin.cool/:username` | No |

> Most public data requires no authentication. Some fields (company tag frequency on problems, full submission history, premium problems) require a valid session cookie or LeetCode Premium.

---

*Last verified: June 2026. LeetCode's undocumented GraphQL schema may change without notice.*
