Viewed api.js:51-75

## 🟤 CodeChef Weekly Score — Deep Dive

From [`weekly.scorer.js`](file:///home/prasanna/Downloads/Tracker_Antigravity/backend/src/modules/leaderboard/scoring/weekly.scorer.js#L64):

---

### The CC Weekly Formula

```
CC Score = divFloor + rankComponent + solveComponent + ratingBonus
```

Four parts stacked together. Max ≈ 115 (then clamped to 115).

---

### Part 1 — Division Floor (`divFloor`)

A **head-start** just for being in a harder division:

| Division | Floor |
|---|---|
| Div 1 | 60 pts |
| Div 2 | 40 pts |
| Div 3 | 20 pts |
| Div 4 | 0 pts |

**Why?** A Div 1 contestant competing against the top 2000 coders globally deserves credit even if they rank poorly. A Div 4 contestant gets no floor — they must earn through rank and solves.

---

### Part 2 — Rank Component (0–40 pts)

```
rankComponent = 40 × max(0, 1 − rank / typicalDivSize)
```

**Typical division sizes** (estimated from observed Starters ~2026):

| Division | Typical participants |
|---|---|
| Div 1 | 2,000 |
| Div 2 | 8,000 |
| Div 3 | 12,000 |
| Div 4 | 18,000 |

**Effect:** Your rank as a percentile within your division. Rank 1 in Div 2 (8000 participants) → `1 − 1/8000 ≈ 1.0` → **40 pts**. Rank 4000 in Div 2 → `1 − 4000/8000 = 0.5` → **20 pts**. Rank 8000+ → 0 pts.

**Why different pool sizes?** Because ranking 500th in Div 1 (2000 ppl) is a top 25% finish — much harder than ranking 500th in Div 4 (18000 ppl), which is top 2.7%.

---

### Part 3 — Solve Component (0–40 pts)

```
solveComponent = 40 × min(1, problemsSolved / typicalDivProblems)
```

**Typical scoreable problems per division:**

| Division | Typical problems |
|---|---|
| Div 1 | 8 |
| Div 2 | 7 |
| Div 3 | 6 |
| Div 4 | 5 |

**Effect:** How many problems you solved as a fraction of what's "expected" for your division. Solve all 6 in Div 3 → `min(1, 6/6) = 1.0` → **40 pts**. Solve 3 of 5 in Div 4 → `min(1, 3/5) = 0.6` → **24 pts**.

**Why separate from rank?** Two students can have the same rank but one solved more problems in less time. This rewards actual throughput, not just luck of who else showed up.

---

### Part 4 — Rating Bonus (−5 to +5 pts)

```
ratingBonus = 5 × tanh(ratingChange / 100)
```

A small tie-breaker. If two students have identical rank and solves:

| Rating change | Bonus |
|---|---|
| +200 | +4.93 pts |
| +100 | +3.80 pts |
| 0 | 0 pts |
| −100 | −3.80 pts |
| −200 | −4.93 pts |

`tanh` keeps it bounded. Only matters when rank + solves are identical.

---

### Full Worked Examples

**Student A — Div 3, Rank 1200, Solved 5/6, Rating +40:**
```
divFloor      = 20
rankComponent = 40 × (1 − 1200/12000) = 40 × 0.90 = 36.0
solveComponent= 40 × (5/6) = 33.3
ratingBonus   = 5 × tanh(40/100) = 5 × 0.38 = 1.9
────────────────────────────────────────────
CC Score = 20 + 36 + 33.3 + 1.9 = 91.2
```

**Student B — Div 4, Rank 200, Solved 4/5, Rating +80:**
```
divFloor      = 0
rankComponent = 40 × (1 − 200/18000) = 40 × 0.989 = 39.6
solveComponent= 40 × (4/5) = 32.0
ratingBonus   = 5 × tanh(0.8) = 5 × 0.664 = 3.3
────────────────────────────────────────────
CC Score = 0 + 39.6 + 32 + 3.3 = 74.9
```

Student A (Div 3) wins despite a worse rank than Student B (Div 4) — because the **divFloor +20 head-start** rewards them for competing in a harder division.

---

### Why rank in Div 1 is more valuable per point

| Situation | rankComponent |
|---|---|
| Rank 500 in Div 1 (2000 total) | `40 × (1 − 500/2000)` = **30 pts** |
| Rank 500 in Div 2 (8000 total) | `40 × (1 − 500/8000)` = **37.5 pts** |
| Rank 500 in Div 3 (12000 total) | `40 × (1 − 500/12000)` = **38.3 pts** |
| Rank 500 in Div 4 (18000 total) | `40 × (1 − 500/18000)` = **38.9 pts** |

Rank 500 in Div 4 gives **more rank points** than Div 1 — but Div 1 gets +60 floor. Net result for rank 500:

| Division | Floor | Rank pts | Total (rank only) |
|---|---|---|---|
| Div 1 | 60 | 30.0 | **90.0** |
| Div 2 | 40 | 37.5 | **77.5** |
| Div 3 | 20 | 38.3 | **58.3** |
| Div 4 | 0 | 38.9 | **38.9** |

Div 1 correctly dominates even at the same absolute rank — which is fair because getting rank 500 in Div 1 is **far harder** than rank 500 in Div 4.