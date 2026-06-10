
markdown

# CodeChef Profile — Complete Data Reference
> A comprehensive map of every piece of data available on a CodeChef profile page, for building a full-featured dashboard.
> Source: Direct scraping of `codechef.com/users/<handle>`, official FAQ, ratings page, badge docs, and community scraper JSON schemas.

---

## 1. Identity & Personal Info

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`username`
 / handle 
|
`string`
|
 Unique identifier (e.g. 
`gennady.korotkevich`
) 
|
|
`name`
|
`string`
|
 Full display name (e.g. 
`Gennady Korotkevich`
) 
|
|
`profilePicture`
|
`URL string`
|
 Avatar/profile image URL 
|
|
`country`
|
`string`
|
 Country name (e.g. 
`Belarus`
) 
|
|
`countryFlag`
|
`URL string`
|
 CDN URL to the country flag image 
|
|
`studentOrProfessional`
|
`string`
|
 Either 
`"Student"`
 or 
`"Professional"`
|
|
`institution`
|
`string`
|
 College/University/Company name 
|
|
`isProUser`
|
`boolean`
|
 Whether user has an active CodeChef Pro plan 
|
|
`isActiveUser`
|
`boolean`
|
 Whether the user has participated in recent contests 
|

---

## 2. CodeChef Contest Rating

This is the primary competitive programming rating, assigned via the **Elo-MMR** system (since Dec 2022).

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`currentRating`
|
`integer`
|
 Current contest rating 
|
|
`highestRating`
|
`integer`
|
 All-time peak rating 
|
|
`stars`
|
`integer`
|
 1 to 7 stars; derived from rating band 
|
|
`division`
|
`string`
|
 Div 1 / Div 2 / Div 3 / Div 4 
|
|
`globalRank`
|
`long \| null`
|
 Current global contest rank; 
`null`
 if inactive 
|
|
`countryRank`
|
`long \| null`
|
 Current country rank; 
`null`
 if inactive 
|
|
`isRankActive`
|
`boolean`
|
 Active/Inactive status (inactive if not participated recently) 
|
|
`ratingType`
|
`string`
|
`"Provisional"`
 or 
`"Final"`
|

### Star / Rating Band Reference

|
 Stars 
|
 Rating Range 
|
 Color 
|
|
---
|
---
|
---
|
|
 ☆ (unrated) 
|
 0 (never participated) 
|
 Grey 
|
|
 1★ 
|
 1 – 1399 
|
 Grey 
|
|
 2★ 
|
 1400 – 1599 
|
 Green 
|
|
 3★ 
|
 1600 – 1799 
|
 Teal/Cyan 
|
|
 4★ 
|
 1800 – 1999 
|
 Blue 
|
|
 5★ 
|
 2000 – 2199 
|
 Violet/Purple 
|
|
 6★ 
|
 2200 – 2499 
|
 Orange 
|
|
 7★ 
|
 2500+ 
|
 Red 
|

---

## 3. DSA Rating

A separate rating track introduced for DSA practice contests (e.g. DSA Mondays).

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`dsaCurrentRating`
|
`integer`
|
 Current DSA rating 
|
|
`dsaHighestRating`
|
`integer`
|
 All-time peak DSA rating 
|
|
`dsaGlobalRank`
|
`long \| null`
|
 Global rank on the DSA leaderboard 
|
|
`dsaCountryRank`
|
`long \| null`
|
 Country rank on the DSA leaderboard 
|

---

## 4. Contest Participation History

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`contestsParticipated`
|
`integer`
|
 Total number of rated contests participated in 
|
|
`ratingData`
|
`array`
|
 Full list of contest rating history (see below) 
|

### Per-Contest Entry (`ratingData[]`)

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`contestName`
|
`string`
|
 Full name (e.g. 
`February Cook-Off 2023 Division 1 (Rated)`
) 
|
|
`contestCode`
|
`string`
|
 Short code / URL slug (e.g. 
`COOK144A`
) 
|
|
`date`
|
`datetime string`
|
 Contest end datetime (e.g. 
`2023-02-08 22:30:00`
) 
|
|
`year`
|
`integer`
|
 Contest year 
|
|
`month`
|
`integer`
|
 Contest month 
|
|
`day`
|
`integer`
|
 Contest day 
|
|
`globalRankInContest`
|
`integer`
|
 User's rank in that specific contest 
|
|
`ratingAfterContest`
|
`integer`
|
 Rating value after contest ends 
|
|
`ratingChange`
|
`integer`
|
 Delta (+/-) compared to previous rating 
|
|
`isProvisional`
|
`boolean`
|
 Whether the rating was provisional at that point 
|
|
`division`
|
`string`
|
 Which division the contest was (Div 1/2/3/4) 
|
|
`contestType`
|
`string`
|
 e.g. 
`Long Challenge`
, 
`Cook-Off`
, 
`Lunchtime`
, 
`Starters`
, 
`SnackDown`
|
|
`problemsSolvedInContest`
|
`array[string]`
|
 Names of problems solved in that contest 
|

---

## 5. Problem Solving Statistics

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`totalProblemsSolved`
|
`long`
|
 Total unique problems with at least one accepted solution 
|
|
`problemsFullySolved`
|
`long`
|
 Problems with a full/100% AC solution 
|
|
`problemsPartiallySolved`
|
`long`
|
 Problems with partial score only 
|
|
`solvedProblemsList`
|
`array[string]`
|
 Names of all solved problems, grouped per contest 
|

---

## 6. Submission Heatmap

CodeChef only exposes the **last 6 months** of submission data through the heatmap widget. Multiple half-year periods are selectable.

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`heatMap`
|
`array`
|
 Array of 
`{date, submissionCount}`
 objects 
|
|
`heatMap[].date`
|
`string`
|
 ISO date string 
`"YYYY-MM-DD"`
|
|
`heatMap[].submissionCount`
|
`integer`
|
 Number of submissions on that day (any verdict) 
|
|
`activePeriod`
|
`string`
|
 Currently selected period (e.g. 
`"2026 Jan-Jun"`
) 
|
|
`availablePeriods`
|
`array[string]`
|
 All selectable half-year period labels 
|

> ⚠️ **Limitation**: Heatmap data is capped to the last 6 months (or one half-year period at a time). Full historical daily data is not available.

---

## 7. Badges

Three badge categories, each with 4–5 tier levels (Bronze → Silver → Gold → Platinum → Diamond).

### 7.1 Contest Contender Badge
Awarded for participating in rated contests.

|
 Tier 
|
 Threshold 
|
|
---
|
---
|
|
 Bronze 
|
 First rated contest 
|
|
 Silver 
|
 ~10 contests (estimated) 
|
|
 Gold 
|
 ~50 contests (estimated) 
|
|
 Platinum 
|
 ~75 contests (estimated) 
|
|
 Diamond 
|
 100 contests 
|

### 7.2 Problem Solver Badge
Awarded for solving problems on CodeChef (practice or contest).

|
 Tier 
|
 Threshold 
|
|
---
|
---
|
|
 Bronze 
|
 Solve first problem 
|
|
 Silver 
|
 ~50 problems (estimated) 
|
|
 Gold 
|
 500 problems 
|
|
 Platinum 
|
 ~1000 problems (estimated) 
|
|
 Diamond 
|
 (high threshold) 
|

### 7.3 Daily Streak Badge
Awarded for making a submission (any verdict) on consecutive days — in contests, learning, or practice.

|
 Tier 
|
 Threshold 
|
|
---
|
---
|
|
 Bronze 
|
 5-day streak 
|
|
 Silver 
|
 (longer streak) 
|
|
 Gold 
|
 (longer streak) 
|
|
 Diamond 
|
 (extended streak) 
|

### Badge Data Schema (per badge)

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`badgeType`
|
`string`
|
`"contest_contender"`
, 
`"problem_solver"`
, 
`"daily_streak"`
|
|
`badgeTier`
|
`string`
|
`"bronze"`
, 
`"silver"`
, 
`"gold"`
, 
`"platinum"`
, 
`"diamond"`
|
|
`badgeIconUrl`
|
`URL string`
|
 CDN URL to the badge SVG image 
|
|
`badgeDescription`
|
`string`
|
 e.g. 
`"Received for participating in 100 Contests"`
|
|
`currentProgress`
|
`integer`
|
 Current count (e.g. 102 contests for diamond) 
|

---

## 8. Learning Paths

Tracks from CodeChef's structured course roadmaps (Python, Java, C++, DSA, etc.)

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`learningPaths`
|
`array`
|
 List of enrolled/completed learning paths 
|
|
`learningPaths[].name`
|
`string`
|
 Name of the course/path 
|
|
`learningPaths[].completionStatus`
|
`string/float`
|
 Completion % or status 
|
|
`learningPathsCount`
|
`integer`
|
 Total number of learning paths enrolled 
|

---

## 9. Practice Paths

Separate from learning paths; focused on problem-solving tracks by difficulty or topic.

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`practicePaths`
|
`array`
|
 List of enrolled/completed practice paths 
|
|
`practicePaths[].name`
|
`string`
|
 Name of the practice track 
|
|
`practicePaths[].completionStatus`
|
`string/float`
|
 Completion % or status 
|
|
`practicePathsCount`
|
`integer`
|
 Total number of practice paths enrolled 
|

---

## 10. Rating Graph (Visual Data)

Two historical graphs are available on the profile:

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`currentRatingGraph`
|
`array`
|
 Rating over time under the 
**
Elo-MMR
**
 system (post Dec 2022) 
|
|
`oldRatingGraph`
|
`array`
|
 Rating over time under the 
**
old
**
 CodeChef system (pre Dec 2022) 
|

Each entry in a graph array:

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`contestName`
|
`string`
|
 Contest name at that data point 
|
|
`date`
|
`datetime`
|
 Timestamp of the contest 
|
|
`rating`
|
`integer`
|
 Rating value at that point 
|
|
`globalRank`
|
`integer`
|
 Global rank in that contest 
|
|
`ratingChange`
|
`integer`
|
 Delta from prior contest 
|

---

## 11. Recent Activity (Dynamic / AJAX)

Loaded asynchronously when the profile page is visited. Not directly embedded in the HTML.

|
 Field 
|
 Type 
|
 Notes 
|
|
---
|
---
|
---
|
|
`recentActivity`
|
`array`
|
 List of recent submission/activity events 
|
|
`recentActivity[].type`
|
`string`
|
 e.g. 
`"submission"`
, 
`"contest_join"`
|
|
`recentActivity[].problemName`
|
`string`
|
 Name of the problem 
|
|
`recentActivity[].contestCode`
|
`string`
|
 Contest this submission was in (if applicable) 
|
|
`recentActivity[].verdict`
|
`string`
|
`"AC"`
, 
`"WA"`
, 
`"TLE"`
, 
`"CE"`
, etc. 
|
|
`recentActivity[].language`
|
`string`
|
 Programming language used 
|
|
`recentActivity[].timestamp`
|
`datetime`
|
 Submission time 
|

---

## 12. Full JSON Schema (Community API Reference)

This is the consolidated JSON shape returned by unofficial CodeChef scraping APIs, cross-referenced from multiple open-source projects:

```json
{
  "status": "success",
  "data": {

    // === Identity ===
    "username": "string",
    "name": "string",
    "profilePictureUrl": "string (URL)",
    "country": "string",
    "countryFlag": "string (URL)",
    "studentOrProfessional": "Student | Professional",
    "institution": "string",
    "isProUser": "boolean",
    "isActiveUser": "boolean",

    // === Contest Rating ===
    "currentRating": "integer",
    "highestRating": "integer",
    "stars": "integer (1–7)",
    "division": "Div 1 | Div 2 | Div 3 | Div 4",
    "globalRank": "integer | null",
    "countryRank": "integer | null",

    // === DSA Rating ===
    "dsaRating": "integer",
    "dsaHighestRating": "integer",
    "dsaGlobalRank": "integer | null",
    "dsaCountryRank": "integer | null",

    // === Problem Solving ===
    "totalProblemsSolved": "integer",
    "problemsFullySolved": "integer",
    "problemsPartiallySolved": "integer",

    // === Contest History ===
    "contestsParticipated": "integer",
    "ratingData": [
      {
        "name": "contest name",
        "code": "contest code / slug",
        "getyear": "integer",
        "getmonth": "integer",
        "getday": "integer",
        "date": "YYYY-MM-DD HH:MM:SS",
        "rank": "integer",
        "rating": "integer",
        "ratingChange": "integer",
        "isProvisional": "boolean",
        "division": "string",
        "problemsSolved": ["Problem A", "Problem B"]
      }
    ],

    // === Heatmap (last 6 months only) ===
    "heatMap": [
      {
        "date": "YYYY-MM-DD",
        "submissionCount": "integer"
      }
    ],

    // === Badges ===
    "badges": [
      {
        "type": "contest_contender | problem_solver | daily_streak",
        "tier": "bronze | silver | gold | platinum | diamond",
        "iconUrl": "string (URL)",
        "description": "string",
        "currentProgress": "integer"
      }
    ],

    // === Learning Paths ===
    "learningPathsCount": "integer",
    "learningPaths": [
      {
        "name": "string",
        "completionPercent": "float"
      }
    ],

    // === Practice Paths ===
    "practicePathsCount": "integer",
    "practicePaths": [
      {
        "name": "string",
        "completionPercent": "float"
      }
    ]
  }
}
```

---

## 13. Data Availability Summary (for Dashboard Planning)

|
 Data Category 
|
 Available via Profile Page Scrape 
|
 Availability Limitation 
|
|
---
|
---
|
---
|
|
 Username / Name / Country 
|
 ✅ Yes 
|
 Always available 
|
|
 Profile Picture 
|
 ✅ Yes 
|
 May fall back to default avatar 
|
|
 Institution / Status 
|
 ✅ Yes 
|
 May be empty if user hasn't filled in 
|
|
 Current Rating & Stars 
|
 ✅ Yes 
|
`null`
 if user has never participated 
|
|
 Highest Rating 
|
 ✅ Yes 
|
`0`
 if never participated 
|
|
 Global / Country Rank 
|
 ✅ Yes 
|
`null`
 if inactive 
|
|
 DSA Rating 
|
 ✅ Yes 
|
`0`
 if never done DSA contests 
|
|
 Contest History (per contest) 
|
 ✅ Yes 
|
 Full history from first contest 
|
|
 Problems Solved (total) 
|
 ✅ Yes 
|
 Always available 
|
|
 Problems by name 
|
 ✅ Yes 
|
 Grouped by contest only 
|
|
 Heatmap / Daily Submissions 
|
 ✅ Yes 
|
**
Last 6 months only
**
 (per half-year period) 
|
|
 Badges 
|
 ✅ Yes 
|
 Up to 3 badges; may be fewer if not yet earned 
|
|
 Learning Paths 
|
 ✅ Yes 
|
 May be empty (
`0`
) 
|
|
 Practice Paths 
|
 ✅ Yes 
|
 May be empty (
`0`
) 
|
|
 Rating Graph (post-2022) 
|
 ✅ Yes 
|
 Elo-MMR system graph 
|
|
 Rating Graph (pre-2022) 
|
 ✅ Yes 
|
 Legacy system graph; shows up if user participated before Dec 2022 
|
|
 Recent Activity 
|
 ⚠️ Partial 
|
 Loaded via AJAX; requires JS rendering 
|
|
 Submission Language breakdown 
|
 ❌ Not on profile page 
|
 Not directly available 
|
|
 Per-problem submission history 
|
 ❌ Not on profile page 
|
 Not publicly exposed in bulk 
|
|
 Friends list 
|
 ❌ Not available 
|
 No social graph exposed 
|
|
 Pro subscription details 
|
 ✅ Status only 
|
 Just Active/No Active Plan 
|

---

## 14. Access Methods

|
 Method 
|
 Notes 
|
|
---
|
---
|
|
**
Direct HTML scraping
**
|
`GET https://www.codechef.com/users/<handle>`
 — returns full HTML with embedded JSON 
`__INITIAL_STATE__`
 or SSR data in some cases 
|
|
**
Community scraper APIs
**
|
`codechef-api.vercel.app/handle/<handle>`
 (unofficial, may have rate limits/downtime) 
|
|
**
`competeapi.vercel.app`
**
|
 Aggregator API covering CodeChef + Codeforces + LeetCode 
|
|
**
Puppeteer/Cheerio scraping
**
|
 For dynamic data (recent activity, heatmap JSON) that loads via AJAX 
|
|
**
No official public API
**
|
 CodeChef's official API was deprecated; all data access is via scraping 
|

---

## 15. Derived / Computed Fields (useful for dashboard widgets)

These aren't directly stored but can be computed from raw data:

|
 Computed Field 
|
 How to Compute 
|
|
---
|
---
|
|
`averageRatingChange`
|
 Mean of all 
`ratingChange`
 across 
`ratingData[]`
|
|
`bestContestRank`
|
 Min value of 
`rank`
 across 
`ratingData[]`
|
|
`ratingTrend`
|
 Last 5 contest rating deltas — going up / down / flat 
|
|
`winRate`
 (positive delta contests) 
|
 Count of contests where 
`ratingChange > 0`
 / 
`contestsParticipated`
|
|
`contestFrequency`
|
 Average contests per month over the profile's lifetime 
|
|
`peakStreakDays`
|
 Max consecutive days from heatmap data 
|
|
`currentStreakDays`
|
 Days from today working backwards on heatmap 
|
|
`activeDaysInPeriod`
|
 Count of days with 
`submissionCount > 0`
 in heatmap 
|
|
`totalSubmissionsInPeriod`
|
 Sum of all 
`submissionCount`
 in the heatmap window 
|
|
`ratingBand`
|
 Derived from 
`currentRating`
 using star band table 
|
|
`ratingGapToNextStar`
|
`nextBandMin - currentRating`
|
|
`percentileEstimate`
|
 Approximate percentile based on global rank 
|

---

*Last verified against `codechef.com/users/gennady.korotkevich` — June 2026.*
