## 🟡 LeetCode Scoring — Deep Dive (40 pts total)

---

### What data we fetch from LeetCode

LeetCode has a **public GraphQL API** (`leetcode.com/graphql`). The scraper sends two queries:

| Query | Fields fetched | What it means |
|---|---|---|
| `userPublicProfile` | `totalSolved`, `easySolved`, `medSolved`, `hardSolved` | Practice/problem history |
| `userContestRanking` | `rating`, `attendedContestsCount`, `globalRanking` | Contest performance |

If `userContestRanking` returns `null` → student has **never entered a contest**.

---

## Part 1 — LC Problem Score (20 pts)

This measures **how deeply you've practiced** on LeetCode, weighted by difficulty.

---

### Step 1: Weighted Raw Points

Different difficulties are worth different amounts because **Hard problems signal real skill**:

```
raw_pts = (easy × 2) + (medium × 4) + (hard × 11)
```

**Why these weights specifically?**

| Difficulty | LC difficulty range | Real-world signal | Weight |
|---|---|---|---|
| Easy | Basic DSA, brute force | Can code at all | 2 |
| Medium | Arrays, DP, graphs | Placement-ready | 4 |
| Hard | Advanced DP, segment trees | FAANG-level | 11 |

Hard is weighted `11` (not `8` or `10`) because the **ratio of skill** between Medium and Hard is non-linear — a student who solves 10 Hard problems is much stronger than one with 20 Medium problems.

**Examples:**

| Student profile | Raw pts |
|---|---|
| 200E + 50M + 0H | 200×2 + 50×4 + 0×11 = **600** |
| 50E + 100M + 10H | 50×2 + 100×4 + 10×11 = **610** |
| 10E + 20M + 30H | 10×2 + 20×4 + 30×11 = **430** |
| 500E + 0M + 0H | 500×2 = **1000** (Easy grinders) |

---

### Step 2: Consistency Factor

We don't have week-by-week submission data from LC's public API. So we **estimate consistency** from total volume — a student who solved 500 problems didn't do it all in one day:

| Total solved | Factor | Reasoning |
|---|---|---|
| ≥ 300 | **0.85** | Very consistent, daily solver |
| ≥ 150 | **0.75** | Regular, solid effort |
| ≥ 50 | **0.65** | Sporadic but trying |
| < 50 | **0.55** | Just started or inactive |

```
effective = raw_pts × consistency_factor
```

**Why not 1.0 for ≥ 300?** Even the most consistent student gets a 0.85 cap because we can't verify *how* they solved them — contest cheating, copy-paste solutions, etc. are all possible. The cap represents **realistic uncertainty**.

---

### Step 3: Ratio against Benchmark

The benchmark = **450 UDG points** — what a "perfect" LC problem student should accumulate:

```
ratio = clamp(effective / 450, 0, 1)
```

**What is 450?** It's calibrated for a student who solved roughly:
- 200 Medium problems + 15 Hard problems + some Easy → effective ≈ 450

This is a realistic target for a placement-ready student with ~1.5 years of practice.

---

### Step 4: Power Curve (the most important step)

```
prob_score = 20 × ratio^0.7
```

The `^0.7` exponent is **deliberately less than 1** (concave curve). Here's why this matters:

| Ratio | Linear (ratio × 20) | Power curve (ratio^0.7 × 20) | Difference |
|---|---|---|---|
| 0.10 | 2.0 | 3.5 | +1.5 |
| 0.20 | 4.0 | 6.1 | +2.1 |
| 0.30 | 6.0 | 8.2 | +2.2 |
| 0.50 | 10.0 | 12.1 | +2.1 |
| 0.75 | 15.0 | 16.6 | +1.6 |
| 1.00 | 20.0 | 20.0 | 0 |

**Effect:** Students who've done 30–50% of the benchmark aren't crushed to near-zero. The curve is **fair to mid-range students** while still rewarding top performers maximally.

---

### Full Problem Score Example

**Student A** — 120E + 80M + 5H solved, total = 205 problems:
```
raw_pts      = (120×2) + (80×4) + (5×11) = 240 + 320 + 55 = 615
factor       = 0.75  (≥150 total)
effective    = 615 × 0.75 = 461.25
ratio        = min(461.25/450, 1.0) = 1.0  (just exceeded benchmark!)
prob_score   = 20 × 1.0^0.7 = 20.0 pts
```

**Student B** — 40E + 15M + 0H solved, total = 55 problems:
```
raw_pts      = (40×2) + (15×4) + (0×11) = 80 + 60 = 140
factor       = 0.65  (≥50 total)
effective    = 140 × 0.65 = 91
ratio        = 91 / 450 = 0.202
prob_score   = 20 × 0.202^0.7 = 20 × 0.304 = 6.1 pts
```

**Student C** — 0 problems solved:
```
prob_score = 0
```

---

## Part 2 — LC Contest Score (20 pts)

This measures **how actively you compete** and **how good you are at timed contests**.

```
contest_score = 20 × (0.40 × P + 0.60 × L)
```

Two sub-components with different importance:

| Component | Weight | What it measures |
|---|---|---|
| P (Participation) | 40% | Did you actually show up? |
| L (Level/Rating) | 60% | How good are you when you show up? |

**Why L > P?** Because entering 40 contests at rating 1200 is less impressive than entering 5 contests and reaching rating 1900. Quality > quantity for contests.

---

### P — Participation

```
P = clamp(contest_count / 20, 0, 1)
```

Benchmark = **20 contests** (roughly 1 per month over 1.5 years — LC holds weekly contests).

| Contests attended | P value | Full participation points (0.40 × P × 20) |
|---|---|---|
| 0 | 0.00 | 0.0 |
| 5 | 0.25 | 2.0 |
| 10 | 0.50 | 4.0 |
| 15 | 0.75 | 6.0 |
| 20+ | 1.00 | 8.0 |

---

### L — Level from Rating (the critical one)

The rating is mapped to a **0–1 level score** using linear interpolation between anchors:

| LC Rating | L value | What it means |
|---|---|---|
| ≤ 1400 | **0.05** | Participated but never placed |
| 1500 | **0.20** | Average performer |
| 1600 | **0.35** | Consistent top-half finisher |
| 1700 | **0.50** | ~Top 25% consistently |
| 1800 | **0.65** | Very strong, solves 3/4 problems |
| 1900 | **0.80** | Near-expert, sometimes solves all 4 |
| 2100+ | **1.00** | Top 1%, expert/master level |

**Linear interpolation** between anchors — e.g., rating 1650:
```
L = 0.35 + (1650 - 1600) / (1700 - 1600) × (0.50 - 0.35)
  = 0.35 + 0.5 × 0.15
  = 0.35 + 0.075
  = 0.425
```

**IMPORTANT — BUG-10 fix applied:**
```
if contest_count == 0 → L = 0  (not 0.05)
```
Before the fix, a student who **never entered a single contest** still got L = 0.05 (the floor anchor). That was wrong — no participation = no level score at all.

---

### Full Contest Score Example

**Student: rating = 1714, contests = 24**
```
P = min(24/20, 1.0) = 1.0
L = lerp(1700→0.50, 1800→0.65, at rating=1714)
  = 0.50 + (14/100) × (0.65 - 0.50)
  = 0.50 + 0.021
  = 0.521

contest_score = 20 × (0.40 × 1.0 + 0.60 × 0.521)
              = 20 × (0.40 + 0.313)
              = 20 × 0.713
              = 14.26 pts
```

**Student: rating = 1450, contests = 8**
```
P = 8/20 = 0.40
L = lerp(1400→0.05, 1500→0.20, at rating=1450)
  = 0.05 + (50/100) × (0.20 - 0.05)
  = 0.05 + 0.075
  = 0.125

contest_score = 20 × (0.40 × 0.40 + 0.60 × 0.125)
              = 20 × (0.16 + 0.075)
              = 20 × 0.235
              = 4.7 pts
```

**Student: 0 contests ever**
```
P = 0, L = 0
contest_score = 20 × 0 = 0 pts
```

---

## 📊 How to maximize your LC score

| Action | Points gained |
|---|---|
| Solve your first 50 problems (any difficulty) | ~6–8 problem pts |
| Get from 50→150 total (Medium focused) | +4–6 more pts |
| Enter your first 5 LC contests | +2.0 contest pts (just for showing up) |
| Get rating from 1400 → 1600 | L goes 0.05 → 0.35, **+3.6 pts** |
| Get rating from 1600 → 1800 | L goes 0.35 → 0.65, **+3.6 pts** |
| Get rating from 1800 → 2000 | L goes 0.65 → 0.95, **+3.6 pts** |
| Solve 10 Hard problems (instead of 30 Easy) | +75 raw pts (same effort, 3.75× reward) |

> **Biggest bang for effort:** Enter contests regularly. Even a rating of 1600 with 20 contests = ~11.2 contest pts out of 20. Just showing up beats most students who never contest.