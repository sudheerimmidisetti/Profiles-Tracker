// src/modules/leaderboard/scoring/weekly.scorer.js
// Weekly leaderboard — contests held this week only.
//
// SCORING PHILOSOPHY (v2 — fair across divisions)
// ─────────────────────────────────────────────────
// We have: rank, problems_solved, rating_change, division (CC), total_problems (LC only)
// We do NOT have: total participant count (not scraped)
//
// Formula per platform:
//
//  CodeChef:
//    S_cc = divBase + rankScore × 0.50 + solveScore × 0.50
//    divBase:   Div1=60, Div2=40, Div3=20, Div4=0
//    rankScore: 40 × (1 - rank / typicalDivSize)  clamped [0,40]
//    solveScore: 40 × (problems_solved / typicalDivProblems) clamped [0,40]
//    The two 50/50 split means rank AND number of problems both matter equally.
//    A Div3 student who solves 3 can outscore a Div4 student who solves 4
//    because divBase gives Div3 a +20 head-start AND their rank percentile is
//    evaluated within Div3's pool (smaller → higher percentile for same rank).
//
//  LeetCode / Codeforces (unchanged):
//    proxyScore uses rating_change + solve ratio + speed bonus (0–100)
//
// Composite: 0.35×LC + 0.35×CF + 0.30×CC  (unchanged weights)
//
// NOTE: When we eventually scrape real div_participants, ccUnifiedScore() with
//       the actual count replaces the typicalDivSize constants.

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
 * Score = divFloor + rankComponent + solveComponent   (max ≈ 100)
 *
 * rankComponent  = 40 × max(0, 1 − rank / typicalDivSize)
 * solveComponent = 40 × min(1, solved / typicalDivProblems)
 */
function ccScore(rank, problemsSolved, division, ratingChange) {
  const div         = division || 'Div 4';
  const floor       = CC_DIV_FLOOR[div]    ?? 0;
  const divSize     = CC_DIV_SIZE[div]     ?? 18000;
  const divProblems = CC_DIV_PROBLEMS[div] ?? 5;

  const rankComponent  = rank > 0
    ? 40 * Math.max(0, 1 - rank / divSize)
    : 0;

  const solveComponent = 40 * Math.min(1, (problemsSolved || 0) / divProblems);

  // Small rating bonus/penalty: ±5 points based on tanh of rating change
  // Prevents ties when rank+solves are identical
  const ratingBonus = 5 * Math.tanh((ratingChange || 0) / 100);

  return Math.max(0, Math.min(115, floor + rankComponent + solveComponent + ratingBonus));
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
 * Uses rating change + problems solved ratio + speed bonus.
 * Score range: 0–100
 */
function proxyScore(ratingChange, problemsSolved, totalProblems, finishTimeSeconds) {
  // Rating change component (0–60): tanh-normalized
  const ratingNorm = 30 + 30 * Math.tanh((ratingChange || 0) / 150);

  // Problems solved ratio (0–30)
  const solveRatio = totalProblems > 0 ? Math.min(1, (problemsSolved || 0) / totalProblems) : 0;
  const solveNorm  = 30 * solveRatio;

  // Speed bonus (0–10): inversely proportional to finish time
  let speedNorm = 0;
  if (finishTimeSeconds > 0 && finishTimeSeconds < 7200) {
    speedNorm = 10 * (1 - finishTimeSeconds / 7200) * solveRatio;
  }

  return Math.max(0, Math.min(100, ratingNorm + solveNorm + speedNorm));
}

/**
 * Legacy ccUnifiedScore — kept for when we have actual div_participants.
 */
function ccUnifiedScore(rank, divParticipants, division) {
  const divFloor = { 'Div 1': 60, 'Div 2': 40, 'Div 3': 20, 'Div 4': 0 };
  const floor    = divFloor[division] ?? 0;
  const p        = divParticipants > 0 ? Math.max(0, 1 - rank / divParticipants) : 0;
  return Math.min(115, floor + p * 55);
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
