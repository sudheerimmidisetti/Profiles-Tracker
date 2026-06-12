# Weekly Leaderboard — Final Verdict

**Scope:** Purpose 2 — the weekly award board, computed **only from contests held this week** (Mon 00:00 → Sun 23:59 IST). No practice solves, no past ratings, no history of any kind enters this board — it answers exactly one question: *who performed best in this week's contests?*

**Verdict in one line:** every contest is scored with the **log-ratio percentile anchored to the college's best rank in that contest**; CodeChef's four divisions are merged through **overlapping bands** (never flat bonuses, never truncation); the week's single number is **0.35 × LC + 0.30 × CC + 0.35 × CF**, with non-attendance scoring 0 and the award requiring ≥ 2 platforms.

---

## 1. What "fair and unbiased" must mean at weekly granularity

1. **This week only.** A student's old rating, badge, or reputation must buy zero points. Division membership may only set *which field* you're compared against — never add points by itself.
2. **Field-relative, not college-relative beyond the anchor.** Performance is measured against the real global field of each contest; the college's best rank serves only as the 100-point anchor so scores are comparable week to week.
3. **Equal information loss everywhere.** One formula, one decay shape, for every platform and every division — a student must never gain by choosing where to be measured.
4. **Attendance is performance.** At weekly granularity there is nothing else to measure; skipping a platform is a 0 on that platform by definition, not a gap to be imputed.

---

## 2. The Core Formula (all platforms, all divisions)

For a contest with `N` ranked participants, college best rank `base`, student rank `r`:

```
S = 100 × ln(N / r) / ln(N / base)        // 100 for the base student, → 0 at the tail
```

**Why log-ratio is the verdict** (over the two natural alternatives):

| Candidate | Failure mode |
|---|---|
| Ratio `100·base/r` | Hyperbolic collapse: with base = 985, rank 9,850 scores 10 — the entire mid-college compresses below 15 points and the board stops ordering people exactly where most students are |
| Global percentile `100·(1−r/N)` | Ceiling collapse: in a 30,000-field, everyone under rank 6,000 scores > 80 — the top of the college all tie |
| **Log-ratio (✅)** | Every **doubling of rank costs equal points** — matching the heavy-tailed shape of real ranklists, so the scale stays discriminative from the college's best student to its last |

Shared rules: ties share scores; only **rated, official** participation counts (no virtual/practice); plagiarism-flagged runs score 0 and raise an integrity strike; if only one college student attended a contest, they are the base and score 100 (the composite balances this across platforms).

---

## 3. Per-Platform Verdicts

**LeetCode (B1).** Weekly + (alternating) Biweekly both fall in the window. Score each attended contest with the core formula (own `N`, own `base` per contest); the board score = **best of the two**. Never sum — summing pays students for the calendar accident of a biweekly week. Attending both is the first tie-breaker instead.

**Codeforces (B2).** A week may hold several rated rounds. Same rule: score each attended round within itself, take the **best round**; rounds attended is the tie-breaker. Because each round is scored against its own field, the occasional case of students writing different divisions resolves itself — no cross-division arithmetic is ever needed on CF.

**CodeChef (B3).** Four division boards: core formula within each division's ranklist (own `N_div`, own college `base` per div). The **unified board** uses overlapping bands on the plain within-div percentile `p = 1 − rank/N_div`:

```
U = Floor(div) + p × 55
```

| Division | Band |
|---|---|
| Div 4 | 0 – 55 |
| Div 3 | 20 – 75 |
| Div 2 | 40 – 95 |
| Div 1 | 60 – 115 |

**Why bands are the verdict and the +100/200/300 idea is rejected:** flat bonuses pay for division membership — i.e., for *rating earned in the past* — violating Principle 1 outright (a Div 1 no-show-performance would outscore a Div 4 sweep). Truncating everyone at Div 4's last problem makes upper divisions full-solve and tie, turning their board into a typing race. Bands instead encode one defensible claim — *median of Div N ≈ ~35th percentile of Div N+1* — with a 20-point stagger sized to the real rating overlap between adjacent divisions (which is exactly the overlap that makes promotion possible at all). Result: a 92nd-pct Div 3 week (70.6) beats a 15th-pct Div 2 week (48.3); an average Div 1 week (87.5) beats both. Performance decides, division only locates the field. Tie-break within the unified board: penalty time from the student's own division ranklist.

*(Documented upgrade path, not part of this verdict: the virtual combined ranklist via per-problem UDG points — adopt only if band disputes actually arise; it costs four ranklist scrapes per week for a refinement the bands already approximate.)*

---

## 4. The Week's Single Number and the Award

```
Weekly = 0.35 × LC + 0.30 × CC_unified + 0.35 × CF        // each 0–100; 0 if not attended
```

- Near-equal weights are deliberate: at weekly granularity each platform contributes one contest of evidence, so the placements 30/30/20 asymmetry has no basis here. CC takes 0.30 only because its unified score already carries a division-merging approximation — the slightly noisier signal gets the slightly smaller weight.
- **Zeros are real.** Not attending a platform is this week's performance on it (Principle 4). No averaging over attended-only — that would let a single lucky contest win the week.
- **Award eligibility: ≥ 2 platforms attended.** One contest is too small a sample to certify anyone as the week's best performer.
- **Tie-breaks, in order:** platforms attended → best single-board score → total penalty time.
- Publish all boards (LC, CF, CC×4, CC-unified, composite). Transparency is itself a fairness mechanism — every constant above survives the "why did I lose by 40 points?" question with a one-sentence answer.
- The board **freezes Monday 06:00 IST**. Later platform-side cheater removals annotate the frozen row and feed integrity strikes forward; they never retroactively reshuffle a published award.

---

## 5. The Verdict, Compressed

| Question | Verdict | The fairness argument |
|---|---|---|
| Scoring shape? | Log-ratio anchored to college best | Equal points per rank-doubling; only shape that discriminates across the whole college |
| Two LC contests in one week? | Best counts, other is tie-break | Summing pays calendar luck, not skill |
| Multiple CF rounds? | Best round, scored within itself | Each field judges its own |
| CC unified: bonuses or truncation? | **Both rejected** — overlapping bands | Points must come from this week's rank, never from past rating; upper divs must be measured on their real problems |
| Composite weights? | 0.35 / 0.30 / 0.35 | One contest each ⇒ near-equal; the merged (noisier) signal gets marginally less |
| Missed platform? | Hard 0 | At weekly granularity, attendance *is* the performance |
| Award bar? | ≥ 2 platforms | One contest cannot certify a week's best |
| Published board changes later? | Never — freeze + annotate | Awards must be stable to be trusted |
