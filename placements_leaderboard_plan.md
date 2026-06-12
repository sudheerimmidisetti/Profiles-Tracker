# Placements Leaderboard — Scoring System Plan (6-Month Window)

**Total: 100 pts = LeetCode (30) + CodeChef (30) + Codeforces (20) + HackerRank (20)**

Window: last 26 weeks (182 days) from "today", recomputed on every refresh (rolling window, not calendar-fixed). The same pipeline with a 13-week window gives you the 3-month variant.

---

## 1. Unified Difficulty Grade (UDG) — One Scale for All Platforms

The core problem you identified: a LeetCode "Easy" is not equal to another LeetCode "Easy", and none of them map cleanly to CodeChef/Codeforces ratings. The fix is to stop trusting platform labels and map every problem into **one of 6 universal tiers** using objective signals: CF/CC problem rating where available, and (difficulty tag × acceptance rate) on LeetCode.

| Tier | Name | LeetCode (tag + acceptance) | Codeforces rating | CodeChef rating | Base points/problem |
|------|------|------------------------------|-------------------|-----------------|---------------------|
| T1 | Warm-Up / Basics | Easy, acc > 65% | ≤ 800 | 0 – 900 | 1 |
| T2 | Elementary | Easy acc 40–65%, or Medium acc > 60% | 801 – 1000 | 901 – 1100 | 2 |
| T3 | Intermediate Logic | Medium, acc 40–55% | 1001 – 1200 | 1101 – 1300 | 4 |
| T4 | Standard Core DSA | Medium, acc 25–39% | 1201 – 1400 | 1301 – 1500 | 7 |
| T5 | Advanced DS/Algo | Hard, acc > 45%, or Medium acc < 25% | 1401 – 1600 | 1501 – 1700 | 11 |
| T6 | Elite / CP-grade | Hard, acc ≤ 45% | 1601+ | 1701+ | 16 |

Design notes:

- **Points grow super-linearly** (1, 2, 4, 7, 11, 16). One T6 problem ≈ 16 warm-ups. This is intentional: placements interviewers care about T3–T5 mastery, and the curve makes grinding 200 warm-ups strictly worse than solving 25 real problems.
- LeetCode acceptance rate is fetched per-problem from its GraphQL API; CF rating comes from the `problemset.problems` API; CodeChef difficulty rating comes from the problem page/API. If a problem has **no rating** (very new CF problems, some CC practice problems), fall back to the platform's own label mapped conservatively (Easy→T2, Medium→T3, Hard→T5).
- Only the **first accepted submission** of a problem ever counts. Re-solves, resubmissions, and solving the same problem on two platforms (where detectable by title match) count once.
- **Edge guard on LeetCode acceptance:** acceptance rate is skewed for very new or premium problems (few submissions). If a problem has < 1,000 total submissions, trust the difficulty tag alone (Easy→T2, Medium→T4, Hard→T5).

---

## 2. Problem-Solving Score (50% of each CP platform's weight)

So: 15 pts on LC, 15 pts on CC, 10 pts on CF.

### Step 1 — Raw quality points
For each platform, sum the UDG base points of all unique problems first-solved inside the 6-month window:

```
RawPoints = Σ (tier_points of each unique accepted problem in window)
```

**Diminishing returns on low tiers (anti-grinding):** per platform, per week, only the first **10 T1 + 10 T2** solves earn points. T3+ is uncapped. This kills the "solve 50 easies on Sunday night" exploit without punishing genuine beginners.

### Step 2 — Consistency multiplier
Split the window into 26 weeks. A week is **active** if the student has ≥ 3 accepted solves (any tier) that week on that platform.

```
ActiveWeeks  = number of active weeks (0–26)
Coverage     = ActiveWeeks / 26
Streak bonus = longest run of consecutive active weeks / 26

ConsistencyFactor = 0.5 + 0.35 × Coverage + 0.15 × StreakBonus
```

- Range is **0.5 → 1.0**. Someone who solved everything in one burst month keeps only ~55–60% of their raw points; someone active 24+ weeks keeps ~95–100%.
- The floor of 0.5 ensures raw skill is never erased — a genuinely strong student who only had 3 active months still ranks above a weak-but-regular one, just not above a strong-and-regular one. That's the fair ordering.

### Step 3 — Normalize to the platform's allotted points
Don't normalize against the college topper (one outlier crushes everyone). Use a **saturation curve** against a fixed benchmark:

```
EffectivePoints = RawPoints × ConsistencyFactor
Score = MaxPts × min(1, EffectivePoints / Benchmark) ^ 0.7
```

- `Benchmark` = the effective points of a model "placement-ready" student over 6 months. Suggested starting values: **LC = 450, CC = 350, CF = 300** (≈ 4–5 quality problems/week skewed T3–T4). Tune after the first real data pull — set it near the 90th percentile of your college.
- The exponent 0.7 makes the curve concave: mid-performers are well separated, while the gap between "excellent" and "insane" compresses. Good for shortlisting, where you care about the top 30%, not crowning one god.

---

## 3. Contest Score (50% of each CP platform's weight) — and the 4-Case Problem

The trap in your four cases is treating **participation** and **rating delta** as one axis. They're independent signals, plus two more that disambiguate the nuanced cases. Score contests as a weighted blend of four sub-signals (each normalized to 0–1):

```
ContestScore = MaxPts × (0.30×P + 0.25×Q + 0.25×T + 0.20×L)
```

**P — Participation (30%).** `min(1, attended / expected)` where `expected` ≈ 18 contests in 6 months for CF/CC (≈3/month of rated contests they're eligible for) and ≈ 20 for LeetCode (weekly + biweekly). Attendance means actually submitting, not just registering.

**Q — In-contest Quality (25%).** Average **rank percentile** across attended contests: `1 − rank/participants`, averaged. This is the key disambiguator — it measures how well they perform *against the field each time*, independent of what their rating did.

**T — Trajectory (25%).** Recency-weighted rating change, bounded so one disaster or one lucky contest can't dominate:

```
Δ = EWMA-weighted (rating_end − rating_start over window), recent months weighted ~2×
T = 0.5 + 0.5 × tanh(Δ / 150)     // 150 ≈ one CF/CC division of movement
```

A flat rating gives T = 0.5 (neutral), +150 gives ≈ 0.88, −150 gives ≈ 0.12.

**L — Absolute Level (20%).** Current rating mapped to 0–1 via fixed anchors, e.g. CF: 800→0.05, 1200→0.35, 1400→0.55, 1600→0.75, 1900→0.95. (Equivalent anchors for CC stars and LC contest rating.) This protects already-strong students who have little room to "gain".

### How this resolves your four cases

| Case | Signals | Outcome and why it's fair |
|------|---------|---------------------------|
| 1. Many contests, rating ↑ | P high, T high, Q usually high | Top score. Correct — this is the ideal placements profile. |
| 2. Many contests, rating ↓ | P high, T low — **Q decides** | If Q is decent (they place mid-field but rating bleeds from volatility or harder divisions), they land mid-tier: participation + quality + level carry 75% of the score and T only drags 25%. If Q is also poor, they score low — which is honest: showing up and consistently underperforming isn't placement-readiness. The `tanh` bound also stops a −300 collapse from zeroing them out. |
| 3. Few contests, rating ↑ | P low, T high — **P caps it** | They keep full credit for T, Q, L, but the missing 30% participation weight means they can't beat a Case-1 student with the same rating. This handles both sub-types correctly: the cherry-picker (joins only easy contests) gets dampened, and the genuinely-strong-but-busy student still scores respectably off Q and L — they're just told, transparently, that attendance is 30% of the rubric. |
| 4. Few contests, rating ↓ | All four low | Lowest score, as expected. |

One extra anti-cherry-picking guard for Case 3: if `attended < 5` in the window, cap the contest score at 60% of MaxPts regardless of formula output. Five contests is too small a sample to certify anyone.

---

## 4. HackerRank (20 pts) — Badge-Based

Per your spec, with the gaps filled in:

**Problem Solving badge (10 pts)** — non-linear so the 6th star is genuinely hard-earned:

| Stars | 1★ | 2★ | 3★ | 4★ | 5★ | 6★ |
|-------|----|----|----|----|----|----|
| Points | 1 | 2 | 3 | 5 | 7 | 10 |

**SQL badge (3.5 pts)** and **Java badge (3.5 pts)** — proportional, 0.7/star:

| Stars | 1★ | 2★ | 3★ | 4★ | 5★ |
|-------|-----|-----|-----|-----|-----|
| Points | 0.7 | 1.4 | 2.1 | 2.8 | 3.5 |

**Python badge (3 pts)** — 0.6/star: 0.6 / 1.2 / 1.8 / 2.4 / 3.0.

> ⚠️ Note: your message says Python is worth 3 pts in the header but "3.5" in the rule text. I've used **3.0** so the platform totals 10 + 3.5 + 3.5 + 3 = 20 exactly. Flip Java to 3 and Python to 3.5 if you meant the reverse.

One honest caveat: badges are **cumulative-lifetime**, not windowed — a student who earned 5★ two years ago and stopped still gets full HackerRank points. Since HR is only 20% of the total and its badges map well to placement screening tests (many companies use HackerRank), this is acceptable. If you want it time-sensitive later, snapshot badge levels monthly and award points only on *current* level (so they at least can't lose access and still hold points).

---

## 5. Integrity & Anti-Gaming Rules (apply before any scoring)

1. **Codeforces "skipped" verdicts** (their plagiarism flag) → exclude those solves; ≥ 2 flags in the window → contest score zeroed for that platform and admin review.
2. Solves during a contest count once — never as both contest performance *and* a practice solve duplicate.
3. Sudden burst anomaly: > 40 accepted solves in a single day triggers manual review (typical of solution-dumping).
4. Handle verification: each student registers their 4 handles once through a form; verify ownership by asking them to place a random token in their profile bio (standard technique, takes them 1 minute).

---

## 6. Data Collection Feasibility (important reality check)

| Platform | Method | Reliability |
|----------|--------|-------------|
| Codeforces | Official REST API (`user.status`, `user.rating`, `contest.list`) | Excellent — full submission history with timestamps and problem ratings |
| LeetCode | Public GraphQL endpoint (recent submissions, contest history, per-problem acceptance %) | Good, but `recentAcSubmissionList` returns only recent items — you **must poll weekly and store snapshots**; you cannot reconstruct 6 months retroactively for a new student |
| CodeChef | Unofficial API / profile scraping (rating history is available; full solve list is scrape-only) | Medium — build a scraper with caching, expect occasional breakage |
| HackerRank | Profile page scraping for badge stars | Medium — badges are public on profiles |

**Architectural consequence:** this must be a **continuously running pipeline** (weekly cron job that pulls, normalizes to UDG tiers, and stores per-student-per-week aggregates in a DB), not an on-demand script. The stored weekly aggregates are exactly what your other three leaderboards (weekly awards, monthly board, all-time board) will read from — so build the storage schema once and all four boards become queries over the same table:

```
solves(student, platform, problem_id, tier, solved_at)
contests(student, platform, contest_id, rank, participants, rating_after, date)
weekly_agg(student, platform, week, raw_pts, active, contests_attended, avg_percentile)
```

---

## 7. Worked Example (sanity check)

Student X, LeetCode, 6 months: 140 unique solves → 18×T2 + 70×T3 + 40×T4 + 12×T5 = 36+280+280+132 = **728 raw pts**, active 21/26 weeks, best streak 12 → ConsistencyFactor = 0.5 + 0.35(0.81) + 0.15(0.46) = **0.85** → Effective = 619 ≥ benchmark 450 → **Problem score = 15/15**.
Contests: attended 14/20 (P=0.70), avg percentile 0.62 (Q), rating +90 (T=0.77), rating 1680 (L≈0.55) → 0.30(.70)+0.25(.62)+0.25(.77)+0.20(.55) = 0.67 → **Contest score = 10.1/15**. LeetCode total ≈ **25.1/30**. Feels right for a strong-but-not-elite candidate.

---

## 8. Open Decisions for You

1. Benchmark values (Section 2, Step 3) — confirm after first real data pull; aim for ~90th percentile of your college.
2. "Expected contests" counts per platform (Section 3, P) — depends on which divisions your students are eligible for.
3. Python vs Java point split on HackerRank (3 vs 3.5).
4. Whether the 3-month variant uses identical weights or boosts contest weight (shorter windows make problem counts noisier; I'd suggest 40% problems / 60% contests for the 3-month board).

Once you confirm these, the same UDG + weekly-aggregate foundation directly powers the weekly awards, monthly, and all-time leaderboards — send me their criteria whenever you're ready.
