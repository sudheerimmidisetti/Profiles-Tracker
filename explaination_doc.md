This is entirely explained by the **CF weekly scoring formula**. Let me break it down:

---

## The CF Weekly Score Formula

From [`weekly.scorer.js`](file:///home/prasanna/Downloads/Tracker_Antigravity/backend/src/modules/leaderboard/scoring/weekly.scorer.js#L105):

```
CF Score (0–100) = ratingNorm + solveNorm + speedBonus

ratingNorm = 30 + 30 × tanh(rating_change / 150)   ← 0 to 60 pts
solveNorm  = 30 × (problems_solved / total_problems) ← 0 to 30 pts
speedBonus = 10 × (1 - finish_time/7200) × solveRatio ← 0 to 10 pts
```

### The critical insight: **Rating change = 60% of the score. Problems solved = 30%.**

---

## Worked example for Umar (23.31)

Umar solved 4 problems — great! But he clearly had a **negative rating change** (lost rating in the contest):

```
ratingNorm = 30 + 30 × tanh(−X / 150)   ← negative tanh → drops below 30
```

If `rating_change = −100`:
```
ratingNorm = 30 + 30 × tanh(−0.667) = 30 + 30 × (−0.58) = 30 − 17.4 = 12.6
solveNorm  = 30 × (4/7) = 17.1                  ← assuming 7 total problems
Total ≈ 29.7  (before speed)
```

If `rating_change = −150`:
```
ratingNorm = 30 + 30 × tanh(−1.0) = 30 + 30 × (−0.76) = 30 − 22.9 = 7.1
solveNorm  = 30 × (4/7) = 17.1
Total ≈ 24.2
```

So **Umar very likely had a rating drop of ~−150 or more**, which crushed his `ratingNorm` down to near 7. Even solving 4 problems couldn't save him.

---

## Worked example for Bhargav (52.1)

Bhargav solved only 1 problem but got **52.1** — meaning he had a big **positive rating change**:

If `rating_change = +120`, solved 1 of 6:
```
ratingNorm = 30 + 30 × tanh(0.8) = 30 + 30 × 0.664 = 30 + 19.9 = 49.9
solveNorm  = 30 × (1/6) = 5.0
speedBonus ≈ ~1.5
Total ≈ 56.4
```

If `rating_change = +80`, solved 1 of 5:
```
ratingNorm = 30 + 30 × tanh(0.53) = 30 + 30 × 0.485 = 30 + 14.6 = 44.6
solveNorm  = 30 × (1/5) = 6.0
Total ≈ 50.6
```

So **Bhargav gained significant rating (+80 to +120)** from that 1 problem. That's possible if he solved it quickly in a contest where most participants solved 0 — rank would be very high even with 1 solve.

---

## Why is rating change weighted so heavily?

**Design intent:** Problems solved alone is a misleading metric. On Codeforces:

- A **Div 4 student** can solve 4 problems and still lose rating (because even Div 4 regulars solve 4)
- A **Div 2 student** solving 1 problem in the first 20 minutes and outranking 8000 people gains massive rating

Rating change **captures your relative performance** against everyone in the contest. Problems solved doesn't.

---

## TL;DR

| Student | Rating change | Problems solved | Score |
|---|---|---|---|
| Umar | **Negative (~−150)** | 4 | 23.31 — rating drag kills it |
| Bhargav | **Positive (~+100)** | 1 | 52.1 — rating gain carries it |

Umar's 4 solves still gave him +17 pts from `solveNorm`, but his negative rating took `ratingNorm` below 10. Bhargav's 1 solve only gave +5 pts, but his positive rating pushed `ratingNorm` up to ~45.

> **If you want a high weekly CF score: win rating, not just problems.**