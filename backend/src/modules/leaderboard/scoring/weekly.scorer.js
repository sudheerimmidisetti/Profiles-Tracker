// src/modules/leaderboard/scoring/weekly.scorer.js
// Weekly leaderboard — contests held this week only.
//
// SCORING PHILOSOPHY (v3 — rank-based, no rating change)
// ────────────────────────────────────────────────────────
// v3 changes (per explicit requirement):
//   LC / CF proxy score uses ONLY:
//     1. Global rank  — rank percentile vs typical contest size (0–15 pts)
//     2. Problems solved — solve ratio  (0–70 pts)
//     3. Finish time  — speed bonus     (0–15 pts)
//   Rating change is REMOVED entirely from LC and CF scoring.
//
// Formula per platform (v3):
//
//  LeetCode (proxy path):
//    score = 5 + 70×solveRatio + 15×speedBonus + 10×rankBonus
//    solveRatio = solved / totalProblems
//    speedBonus = (1 − finishTime/7200) × solveRatio  (0 if time ≥ 2h or no solve)
//    rankBonus  = max(0, 1 − rank / 35000)  (LC typical ~30–35k participants)
//
//  Codeforces (proxy path):
//    score = 5 + 70×solveRatio + 15×speedBonus + 10×rankBonus
//    solveRatio = solved / 5  (CF stores total_problems = 5)
//    speedBonus = 0 (CF does not store individual finish time)
//    rankBonus  = max(0, 1 − rank / 25000)  (CF Div2 typical ~20–25k)
//
//  CodeChef:
//    score = divFloor(if solved≥1) + 40×rankPct + 40×solvePct + ±5 ratingBonus
//    divFloor: Div1=60, Div2=40, Div3=20, Div4=0  (typical division sizes used for rank%)
//    Cap: 100
//
// Composite: 0.35×LC + 0.35×CF + 0.30×CC  (weights unchanged)
//
// NOTE: When log-ratio path is active (total_participants + collegeBase available),
//       it uses rank directly — already fair, no change needed.

'use strict';

const { isoWeek } = require('./placements.scorer');

// ── Typical CodeChef division sizes (Starters ~2026) ──────────────────────────
// These are approximate median participation counts per division.
// Source: observed across ~10 recent Starters rounds.
const CC_DIV_SIZE = {
  'Div 1':  2000,
  'Div 2':  8000,
  'Div 3': 12000,
  'Div 4': 18000,
};
// Typical number of scoreable problems per division (problems that matter for rank)
const CC_DIV_PROBLEMS = {
  'Div 1': 8,
  'Div 2': 7,
  'Div 3': 6,
  'Div 4': 5,
};
// Division floor scores (head-start for being in a harder division)
const CC_DIV_FLOOR = {
  'Div 1': 60,
  'Div 2': 40,
  'Div 3': 20,
  'Div 4':  0,
};

/**
 * CodeChef score — fair across divisions.
 *
 * FIX (v2):
 *   1. Cap changed from 115 → 100 (consistent with LC/CF proxy max).
 *   2. Division floor now requires ≥ 1 problem solved.
 *      Previously a Div1 student who solved 0 and placed last still got 60pts
 *      just for being Div1 — that's unfair vs a Div4 student who solved 4/5.
 *
 * Score = divFloor + rankComponent + solveComponent + ratingBonus
 *   divFloor      = Div1:60, Div2:40, Div3:20, Div4:0  (only if solved ≥ 1)
 *   rankComponent = 40 × max(0, 1 − rank / typicalDivSize)
 *   solveComponent= 40 × min(1, solved / typicalDivProblems)
 *   ratingBonus   = ±5 (tiebreaker only)
 */
function ccScore(rank, problemsSolved, division, ratingChange) {
  const div         = division || 'Div 4';
  const divSize     = CC_DIV_SIZE[div]     ?? 18000;
  const divProblems = CC_DIV_PROBLEMS[div] ?? 5;

  // Division floor: only granted if student solved at least 1 problem
  // Prevents "0 solves in Div1 = 60pts" anomaly
  const solved = problemsSolved || 0;
  const floor  = solved >= 1 ? (CC_DIV_FLOOR[div] ?? 0) : 0;

  const rankComponent   = rank > 0
    ? 40 * Math.max(0, 1 - rank / divSize)
    : 0;

  const solveComponent  = 40 * Math.min(1, solved / divProblems);

  // Small rating bonus/penalty: ±5 pts (tiebreaker only, unchanged)
  const ratingBonus = 5 * Math.tanh((ratingChange || 0) / 100);

  // Cap at 100 (was 115) — keeps CC comparable to LC/CF in composite
  return Math.max(0, Math.min(100, floor + rankComponent + solveComponent + ratingBonus));
}

/**
 * Log-ratio score (used when we have N, rank, and college base rank).
 * S = 100 × ln(N/r) / ln(N/base)
 * Returns null if inputs missing so caller can fall back.
 */
function logRatioScore(rank, participants, collegeBaseRank) {
  if (!rank || !participants || !collegeBaseRank) return null;
  if (rank <= 0 || participants <= 0) return 0;
  const base = Math.max(1, collegeBaseRank);
  const r    = Math.max(1, rank);
  const N    = Math.max(r + 1, participants);
  const num  = Math.log(N / r);
  const den  = Math.log(N / base);
  if (den <= 0) return 100;
  return Math.max(0, Math.min(100, 100 * num / den));
}

/**
 * Proxy score for LC/CF — uses ONLY global rank, problems solved, and finish time.
 * Rating change is NOT used.
 *
 * Buckets:
 *   5  pts  — base participation bonus
 *   70 pts  — solve ratio  (solved / total)
 *   15 pts  — speed bonus  (finish time < 2h, scaled by solve ratio)
 *   10 pts  — rank bonus   (percentile vs typicalParticipants)
 *   ─────────────────────────────────
 *   100 pts max
 *
 * @param {number} problemsSolved
 * @param {number} totalProblems    — 0 treated as unknown (score 0 on solve component)
 * @param {number} finishTimeSeconds — 0 if not available (CF)
 * @param {number} rank              — global contest rank (lower = better)
 * @param {number} typicalParticipants — expected contest size (LC≈35000, CF≈25000)
 */
function proxyScore(problemsSolved, totalProblems, finishTimeSeconds, rank, typicalParticipants) {
  // PRIMARY: Problems solved ratio (0–70 pts)
  const solveRatio = totalProblems > 0 ? Math.min(1, (problemsSolved || 0) / totalProblems) : 0;
  const solveNorm  = 70 * solveRatio;

  // SECONDARY: Speed bonus (0–15 pts) — only if solved something and finished within 2h
  let speedBonus = 0;
  if (finishTimeSeconds > 0 && finishTimeSeconds < 7200 && solveRatio > 0) {
    speedBonus = 15 * (1 - finishTimeSeconds / 7200) * solveRatio;
  }

  // TERTIARY: Global rank percentile (0–10 pts)
  // rank=1 → 10pts, rank=typicalSize → 0pts, rank > typicalSize → 0pts
  let rankBonus = 0;
  if (rank > 0 && typicalParticipants > 0) {
    rankBonus = 10 * Math.max(0, 1 - rank / typicalParticipants);
  }

  // Base 5 pts for participation
  return Math.max(0, Math.min(100, 5 + solveNorm + speedBonus + rankBonus));
}

/**
 * Legacy ccUnifiedScore — used when we have actual div_participants count.
 * FIX: Cap changed from 115 → 100 to match ccScore and LC/CF proxy caps.
 */
function ccUnifiedScore(rank, divParticipants, division) {
  const divFloor = { 'Div 1': 60, 'Div 2': 40, 'Div 3': 20, 'Div 4': 0 };
  const floor    = divFloor[division] ?? 0;
  const p        = divParticipants > 0 ? Math.max(0, 1 - rank / divParticipants) : 0;
  return Math.min(100, floor + p * 55);
}

/**
 * Determine week start (Monday 00:00 IST) for a given date.
 */
function weekStart(date = new Date()) {
  const d = new Date(date);
  // IST = UTC+5:30
  const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  const day = ist.getUTCDay(); // 0=Sun
  const monday = new Date(ist.getTime() - ((day === 0 ? 6 : day - 1) * 86400000));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

/**
 * Compute weekly score for one student.
 *
 * @param {object} data
 *   lcContests — LC contests this week
 *   cfContests — CF rounds this week
 *   ccContests — CC contests this week: [{rank_achieved, division, problems_solved, rating_change}]
 *   collegeBase — { lc, cf, cc } best rank among college students
 *
 * @returns {{ lcScore, cfScore, ccScore, composite, platformsAttended, eligible }}
 */
function computeWeeklyScore(data) {
  const { lcContests = [], cfContests = [], ccContests = [], collegeBase = {} } = data;

  // ── LeetCode ───────────────────────────────────────────────────────────────
  // Typical LC weekly contest: ~30,000–35,000 global participants.
  const LC_TYPICAL_PARTICIPANTS = 35000;
  let lcScore = 0;
  let lcBest  = null;
  for (const c of lcContests) {
    let s = null;
    if (c.total_participants && collegeBase.lc) {
      s = logRatioScore(c.rank, c.total_participants, collegeBase.lc);
    }
    if (s === null) {
      s = proxyScore(
        c.problems_solved,
        c.total_problems,
        c.finish_time_seconds,
        c.rank,
        LC_TYPICAL_PARTICIPANTS
      );
    }
    if (s > lcScore) { lcScore = s; lcBest = c; }
  }

  // ── Codeforces ─────────────────────────────────────────────────────────────
  // Typical CF Div2/Div3 contest: ~20,000–30,000 participants.
  // CF does not store individual finish_time_seconds → speedBonus = 0.
  const CF_TYPICAL_PARTICIPANTS = 25000;
  let cfScore = 0;
  let cfBest  = null;
  for (const c of cfContests) {
    let s = null;
    if (c.total_participants && collegeBase.cf) {
      s = logRatioScore(c.rank, c.total_participants, collegeBase.cf);
    }
    if (s === null) {
      s = proxyScore(
        c.problems_solved,
        c.total_problems || 5,
        0,              // CF has no per-submission finish time stored
        c.rank,
        CF_TYPICAL_PARTICIPANTS
      );
    }
    if (s > cfScore) { cfScore = s; cfBest = c; }
  }

  // ── CodeChef ───────────────────────────────────────────────────────────────
  let ccScoreVal = 0;
  let ccBest     = null;
  for (const c of ccContests) {
    let s;
    // Use actual participant count if available (future scraper upgrade)
    if (c.div_participants && c.div_participants > 0) {
      s = ccUnifiedScore(c.rank, c.div_participants, c.division);
    } else {
      // Use our fair rank+solve formula with typical division sizes
      s = ccScore(
        c.rank_achieved ?? c.rank,
        c.problems_solved_count ?? c.problems_solved ?? 0,
        c.division,
        c.rating_change
      );
    }
    if (s > ccScoreVal) { ccScoreVal = s; ccBest = c; }
  }

  const platformsAttended =
    (lcContests.length > 0 ? 1 : 0) +
    (cfContests.length > 0 ? 1 : 0) +
    (ccContests.length > 0 ? 1 : 0);

  // Composite: 0.35×LC + 0.30×CC + 0.35×CF
  const composite = 0.35 * lcScore + 0.30 * ccScoreVal + 0.35 * cfScore;

  return {
    lcScore:           +lcScore.toFixed(4),
    cfScore:           +cfScore.toFixed(4),
    ccScore:           +ccScoreVal.toFixed(4),
    composite:         +composite.toFixed(4),
    platformsAttended,
    eligible:          platformsAttended >= 2,
    breakdown: { lcBest, cfBest, ccBest },
  };
}

module.exports = {
  computeWeeklyScore,
  logRatioScore,
  proxyScore,
  ccScore,
  ccUnifiedScore,
  weekStart,
};
