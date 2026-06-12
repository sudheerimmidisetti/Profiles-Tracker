# Monthly Leaderboard — Final Verdict

**Scope:** Purpose 3 — "students performing for a month's duration / this month."
**Verdict in one line:** the monthly board is a **0.60 × Contest + 0.40 × Practice** blend, where Contest = the mean of the student's weekly composite scores for the month **with the single worst week dropped**, and Practice = the month's difficulty-weighted (UDG) solve points passed through the same consistency-multiplier-and-saturation curve as the placements board. Everything reuses the already-frozen weekly and UDG machinery — no new constants are invented except two, justified below.

---

## 1. What "fair and unbiased" must mean at monthly granularity

A month is the awkward middle ground: too short for the placements board's 26-week consistency statistics, too long for a single contest to decide it. The mathematical requirements that follow from this:

1. **Bounded forgiveness.** One bad week (internals, illness, fest) must not sink a month — but two bad weeks must. Dropping exactly the one worst week is the only rule that forgives bad luck without rewarding cherry-picking; drop two and a student can skip half the month strategically.
2. **No double normalization.** Weekly composites are already field-anchored (log-ratio vs. each contest's global field) and division-fair (CC overlapping bands). Re-normalizing them against the college's monthly topper would re-introduce the single-outlier distortion we removed in the placements doc. So monthly contest scores are **averaged, never re-ranked against the best student**.
3. **Verified signal outweighs self-paced signal.** Contest ranks are externally adjudicated and hard to game; practice solving is self-paced and the more gameable surface (even with UDG caps). Hence 60/40, not 50/50 — the weighting follows gameability, not taste.
4. **Same difficulty currency everywhere.** Practice points use the identical UDG tiers (1/2/4/7/11/16) and identical low-tier weekly caps as the placements board. A T4 problem is worth the same in every board in the system — students must never discover that a problem "pays" differently depending on which leaderboard looks at it.
5. **Frozen constants.** All constants below are fixed before the first monthly board is published and never tuned mid-month.

---

## 2. Definitions

- **Month** = calendar month. A scoring week belongs to the month containing its **Monday**. So a month has `W` = 4 or 5 weekly boards. ("This month" live view: same formulas on month-to-date weeks, labeled *provisional* until month close.)
- All inputs come from existing tables: `weekly_board` (composites) and `weekly_agg` / `solves` (UDG points, active flags).

---

## 3. Contest Component — 60 pts

Let `c₁ … c_W` be the student's weekly composite scores (0–100) for the month's weeks, with **0 for any week not attended** (attendance discipline is part of monthly performance, exactly as in the weekly composite philosophy).

```
ContestMonth = mean of the best (W − 1) values of {c₁ … c_W}     // drop exactly one
             = mean of all W values, if W < 4                     // no drop in rare 3-week edge months
ContestPts   = 0.60 × ContestMonth
```

Why drop-one is optimal and not arbitrary: with W = 4–5, dropping one week removes 20–25% of the sample — large enough to absorb a legitimate emergency, small enough that a student must still deliver 3–4 strong, externally-verified weeks. Any forgiveness scheme stronger than this (drop-two, "best week counts double", median-only) is strictly more exploitable by selective participation; any scheme weaker (plain mean) punishes documented one-off life events. Drop-one is the unique minimum-forgiveness rule, which is why it's the verdict.

## 4. Practice Component — 40 pts

```
MonthUDG     = Σ UDG tier-points of unique first-solves this month,
               across all four platforms, with the standing per-week caps
               (first 10 T1 + 10 T2 per platform per week; T3+ uncapped)

ActiveWeeks  = weeks of the month with ≥ 3 accepted solves on any platform
MonthCF      = 0.6 + 0.4 × (ActiveWeeks / W)            // consistency factor, 0.6 → 1.0

PracticePts  = 40 × min(1, (MonthUDG × MonthCF) / B_m) ^ 0.7
```

The two new constants, and why they are what they are:

- **B_m = 185 UDG points.** Not invented — derived: it is the sum of the placements benchmarks (450 + 350 + 300 = 1,100 over 6 months) divided by 6. A student on a placement-ready trajectory hits the practice ceiling in an ordinary month; the monthly and 6-month boards therefore *agree by construction* on what "enough" means, which is the strongest unbiasedness property available — no student can be "good" on one board and "lazy" on another for identical behavior.
- **MonthCF floor = 0.6** (vs. 0.5 on the placements board). A month has only 4–5 weeks, so each inactive week is already a much larger proportional hit than in a 26-week window; a deeper floor would double-punish the same gap. The floor rises exactly as the window shrinks — same principle, scaled.

The exponent 0.7 and the saturation cap are inherited unchanged (concavity separates the mid-field, compresses the gap between excellent and superhuman — the correct geometry for picking a *set* of strong performers rather than worshiping one outlier).

## 5. Final Score, Eligibility, Tie-breaks

```
Monthly = ContestPts + PracticePts          // 0 – 100
```

- **Award eligibility:** attended ≥ 2 weekly boards in the month AND ActiveWeeks ≥ 2. A pure contest-tourist or a pure grinder can appear *on* the board but cannot win the monthly award — the award certifies the complete profile.
- **Tie-breaks, in order:** (1) more weekly top-3 finishes this month, (2) higher raw MonthUDG, (3) lower total penalty time across the month's contests.
- **Integrity:** any platform plagiarism flag during the month zeroes that week's composite *before* the drop-one rule is applied — meaning the flagged week is the week that gets kept, not dropped. A cheater spends their forgiveness on their cheating. Second flag in a month → removed from the monthly board, strikes forwarded to the placements board.

## 6. Worked Example (W = 4)

Student Y: weekly composites **72, 0 (missed — fest week), 64, 81**; solves 47 problems → MonthUDG = 232 (post-caps); active 3 of 4 weeks.

- ContestMonth = mean(81, 72, 64) = 72.3 → **ContestPts = 43.4**
- MonthCF = 0.6 + 0.4 × (3/4) = 0.90 → 232 × 0.90 = 208.8 ≥ 185 → ratio capped at 1 → **PracticePts = 40.0**
- **Monthly = 83.4 / 100**, eligible for the award.

The missed week cost nothing (forgiven once), but note: had Y missed *two* weeks, a 0 enters the mean and the score collapses to ~62 — bounded forgiveness working exactly as designed. And Y's strong practice month hit the ceiling because Y is on the placement trajectory — the boards agree.

## 7. Schema & Pipeline Addition

```
monthly_board(student, month, contest_pts, practice_pts, month_udg,
              active_weeks, monthly_score, eligible, award_rank, frozen_at)
```

Computed on the 1st of each month at 06:00 IST from frozen weekly rows; the monthly row itself freezes immediately after publication. The all-time board (purpose 4) will read `weekly_board.award_rank` and `monthly_board.award_rank` as its inputs — nothing about this design will need to change for it.

---

## 8. The Verdict, Compressed

| Question | Verdict | The fairness argument |
|---|---|---|
| Aggregate weekly contests how? | Mean with **exactly one** worst week dropped | Unique point between punishing bad luck and rewarding cherry-picking |
| Re-anchor to college's monthly best? | **No** — weekly scores are already field-normalized | Avoids single-outlier distortion twice over |
| Contest vs practice split? | **60 / 40** | Weight follows verifiability: external ranks > self-paced solving |
| Practice benchmark? | **185 = 1,100 / 6**, derived not invented | Monthly and 6-month boards agree by construction |
| Consistency floor? | **0.6**, raised from 0.5 | Floor scales with window length; no double-punishment |
| Can a one-dimensional student win? | On the board yes, the **award no** (≥2 contests + ≥2 active weeks) | The award certifies the complete placement profile |
| Cheating interaction with forgiveness? | Flagged week is **excluded from dropping** | Forgiveness is for bad luck, never for misconduct |
