# External Placements Leaderboard

> **Standalone tool for DR Batch 7.0 — completely separate from the main website.**
> Uses data from `Coding-Profiles-DR-7.0-04-06-2026.ods` and fetches live data from LeetCode, CodeChef, and HackerRank APIs.

---

## Setup

```bash
cd ext-leaderboard/backend
npm install
```

---

## Step 1 — Sync student data (fetch from APIs)

This reads all 670 student handles from the ODS file and fetches their live profiles.

```bash
# Sync only missing students (safe to re-run — skips already-fetched)
npm run sync

# Re-fetch everyone from scratch
npm run sync:refetch

# Quick test: only sync first 5 students
npm run sync:test
```

> ⏱️ Full sync of 670 students takes ~30–40 minutes (API rate limiting, ~1.2s per student).
> The `db.json` file caches fetched data — partial syncs are saved and resumed on re-run.

---

## Step 2 — Start the server

```bash
npm start
```

Open: **http://localhost:4500**

---

## Features

- 📊 **Leaderboard** — ranked by total score (0–100)
- 🔍 **Search** — by Student ID, LC/CC/HR handle
- 🔀 **Sort** — by total score, LC/CC/HR score, problems solved, rating
- 📋 **Detail drawer** — click "Details" to see full score breakdown per platform
- 📥 **Export CSV** — downloads all student scores + breakdown as a spreadsheet

---

## Scoring Formula

| Platform | Weight | Notes |
|----------|--------|-------|
| LeetCode | **40 pts** | Was 30 — +10 from CF (no Codeforces in dataset) |
| CodeChef | **40 pts** | Was 30 — +10 from CF |
| HackerRank | **20 pts** | Unchanged (badge-based) |

**Per platform split: 50% Problem Solving + 50% Contest**

### LeetCode (40 pts = 20 prob + 20 contest)
- Problems: Easy×2 + Medium×4 + Hard×11 pts (UDG tiers), normalized to benchmark
- Contest: `20 × (0.4 × participation + 0.6 × rating_level)`

### CodeChef (40 pts = 20 prob + 20 contest)
- Problems: count × 4 pts avg (T3 estimate), normalized to benchmark
- Contest: `20 × (0.4 × participation + 0.6 × star_level)`

### HackerRank (20 pts)
- Problem Solving stars: non-linear [1,2,3,5,7,10]
- SQL × 0.7, Java × 0.7, Python × 0.6

---

## Files

```
ext-leaderboard/
├── backend/
│   ├── package.json
│   ├── server.js          ← Express API + serves frontend
│   ├── sync.js            ← CLI: fetch all students from APIs
│   ├── parse-ods.js       ← Reads the ODS file, extracts usernames
│   ├── db.js              ← Flat JSON file "database" (db.json)
│   ├── scrapers/
│   │   ├── lc.js          ← LeetCode GraphQL
│   │   ├── cc.js          ← CodeChef HTML scraper
│   │   └── hr.js          ← HackerRank REST API
│   └── scoring/
│       ├── udg.js         ← Unified Difficulty Grade tiers
│       └── placements.js  ← Scoring formula (LC=40, CC=40, HR=20)
└── frontend/
    └── index.html         ← Complete dark-mode UI
```

---

## To Remove Later

Just delete the entire `ext-leaderboard/` folder. Nothing else is touched.
