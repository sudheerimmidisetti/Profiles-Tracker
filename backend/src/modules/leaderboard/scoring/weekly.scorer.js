// src/modules/leaderboard/scoring/weekly.scorer.js
// Weekly leaderboard — contests held this week only.
//
// SCORING PHILOSOPHY (v2 — bugs fixed)
// ─────────────────────────────────────
// Bug fixes applied in v2:
//   1. CF: total_problems was hardcoded 0 in SQL → solveRatio always 0 → pure rating scoring.
//          Fixed: SQL now uses 5 AS total_problems (typical CF round size).
//   2. LC/CF proxyScore: rating_change had 60% weight, solve ratio only 30%.
//          Fixed: solve ratio now 70% primary, rating change ±15pt tiebreaker.
//   3. CC: max score was 115 (not 100) → CC students had disproportionate
//          composite weight vs LC/CF. Fixed: cap changed to 100.
//   4. CC: division floor (60/40/20/0) was given even for 0 problems solved.
//          Fixed: floor only awarded if problemsSolved ≥ 1.
//
// Formula per platform (post-fix):
//
//  LeetCode / Codeforces (proxy path):
//    score = 5 + 70×solveRatio + 15×tanh(ratingChange/200) + speedBonus
//    solveRatio = problemsSolved / totalProblems  (CF defaults to 5)
//
//  CodeChef:
//    score = divFloor(if solved≥1) + 40×rankPct + 40×solvePct + ±5 ratingBonus
//    divFloor: Div1=60, Div2=40, Div3=20, Div4=0
//    Cap: 100 (was 115)
//
// Composite: 0.35×LC + 0.35×CF + 0.30×CC  (weights unchanged)
//
// NOTE: When log-ratio path is active (participant count available),
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
 * Proxy score for LC/CF when we don't have live standings.
 *
 * FIX (v2): Problems solved is now the primary signal (70 pts max).
 * Rating change is a tiebreaker only (±15 pts).
 *
 * OLD formula: 60% rating change + 30% solves → newbies with high delta
 *              always outranked students who solved more problems.
 * NEW formula: 70% solve ratio + 15pt rating adjustment + speed bonus
 *   → Umar solving 4/6 will always outscore Bhargav solving 1/6
 *     regardless of rating delta.
 *
 * Score range: 0–100
 */
function proxyScore(ratingChange, problemsSolved, totalProblems, finishTimeSeconds) {
  // PRIMARY: Problems solved ratio (0–70 pts)
  const solveRatio = totalProblems > 0 ? Math.min(1, (problemsSolved || 0) / totalProblems) : 0;
  const solveNorm  = 70 * solveRatio;

  // SECONDARY: Rating change bonus/penalty (±15 pts)
  // Reduced divisor (200 vs old 150) → less extreme for newbie jumps
  const ratingBonus = 15 * Math.tanh((ratingChange || 0) / 200);

  // Speed bonus (0–10 pts): only meaningful if you solved something
  let speedBonus = 0;
  if (finishTimeSeconds > 0 && finishTimeSeconds < 7200 && solveRatio > 0) {
    speedBonus = 10 * (1 - finishTimeSeconds / 7200) * solveRatio;
  }

  // Base 5 pts for participation (so a student who solved 0 isn't exactly at 0)
  return Math.max(0, Math.min(100, 5 + solveNorm + ratingBonus + speedBonus));
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
  let lcScore = 0;
  let lcBest  = null;
  for (const c of lcContests) {
    let s = null;
    if (c.total_participants && collegeBase.lc) {
      s = logRatioScore(c.rank, c.total_participants, collegeBase.lc);
    }
    if (s === null) {
      s = proxyScore(c.rating_change, c.problems_solved, c.total_problems, c.finish_time_seconds);
    }
    if (s > lcScore) { lcScore = s; lcBest = c; }
  }

  // ── Codeforces ─────────────────────────────────────────────────────────────
  let cfScore = 0;
  let cfBest  = null;
  for (const c of cfContests) {
    let s = null;
    if (c.total_participants && collegeBase.cf) {
      s = logRatioScore(c.rank, c.total_participants, collegeBase.cf);
    }
    if (s === null) {
      s = proxyScore(c.rating_change, c.problems_solved, c.total_problems, c.finish_time_seconds);
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
