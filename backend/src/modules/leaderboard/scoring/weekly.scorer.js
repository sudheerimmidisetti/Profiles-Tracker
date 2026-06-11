// src/modules/leaderboard/scoring/weekly.scorer.js
// Weekly leaderboard — contests held this week only.
// Formula: Weekly = 0.35×LC + 0.30×CC_unified + 0.35×CF
//
// Simplified proxy (v1): We don't have live standings data yet.
// Score = weighted blend of:
//   - Rating change this week (normalized via tanh)
//   - Rank percentile proxy from problems_solved / total_problems
//   - Problems solved in contest (UDG-weighted) where available
//
// Full log-ratio formula (activate when standings are scraped):
//   S = 100 × ln(N/r) / ln(N/base)

'use strict';

const { isoWeek } = require('./placements.scorer');

/**
 * Log-ratio score (used when we have N, rank, and college base rank).
 * S = 100 × ln(N/r) / ln(N/base)
 * Returns 0 if not attended; 100 for the base student.
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
 * Proxy score when we don't have live standings.
 * Uses rating change + problems solved ratio.
 * Score range: 0–100
 */
function proxyScore(ratingChange, problemsSolved, totalProblems, finishTimeSeconds) {
  // Rating change component (0–60): tanh-normalized
  const ratingNorm = 30 + 30 * Math.tanh((ratingChange || 0) / 150);

  // Problems solved ratio (0–30)
  const solveRatio = totalProblems > 0 ? Math.min(1, (problemsSolved || 0) / totalProblems) : 0;
  const solveNorm  = 30 * solveRatio;

  // Speed bonus (0–10): inversely proportional to finish time
  // finishTimeSeconds: 0 = max speed. 7200s (2h) = no bonus.
  let speedNorm = 0;
  if (finishTimeSeconds > 0 && finishTimeSeconds < 7200) {
    speedNorm = 10 * (1 - finishTimeSeconds / 7200) * solveRatio;
  }

  return Math.max(0, Math.min(100, ratingNorm + solveNorm + speedNorm));
}

/**
 * CodeChef unified score using overlapping division bands.
 * U = Floor(div) + p × 55   where p = within-div percentile
 *
 * Band floors: Div4=0, Div3=20, Div2=40, Div1=60
 * Band ranges: each div spans 0–55 points above floor.
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
  // Return as YYYY-MM-DD
  return monday.toISOString().slice(0, 10);
}

/**
 * Compute weekly score for one student.
 *
 * @param {object} data
 *   lcContests    — LC contests this week: [{rank, total_participants, problems_solved, total_problems, finish_time_seconds, rating_change}]
 *   cfContests    — CF rounds this week: same structure
 *   ccContests    — CC contests this week: [{rank, div_participants, division, problems_solved, total_problems, rating_change}]
 *   collegeBase   — { lc: minRankLC, cf: minRankCF, cc: minRankCC } (best rank from any college student)
 *
 * @returns {{ lcScore, cfScore, ccScore, composite, platformsAttended, eligible, breakdown }}
 */
function computeWeeklyScore(data) {
  const { lcContests = [], cfContests = [], ccContests = [], collegeBase = {} } = data;

  // ── LeetCode: best of the week's contests ──────────────────────────────────
  let lcScore = 0;
  let lcBest  = null;
  for (const c of lcContests) {
    // Try log-ratio first (needs N + base rank)
    let s = null;
    if (c.total_participants && collegeBase.lc) {
      s = logRatioScore(c.rank, c.total_participants, collegeBase.lc);
    }
    // Fallback to proxy
    if (s === null) {
      s = proxyScore(c.rating_change, c.problems_solved, c.total_problems, c.finish_time_seconds);
    }
    if (s > lcScore) { lcScore = s; lcBest = c; }
  }

  // ── Codeforces: best round of the week ─────────────────────────────────────
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

  // ── CodeChef: unified band score ───────────────────────────────────────────
  let ccScore = 0;
  let ccBest  = null;
  for (const c of ccContests) {
    let s;
    if (c.division && c.div_participants) {
      s = ccUnifiedScore(c.rank, c.div_participants, c.division);
    } else {
      s = proxyScore(c.rating_change, c.problems_solved, c.total_problems, c.finish_time_seconds);
    }
    if (s > ccScore) { ccScore = s; ccBest = c; }
  }

  const platformsAttended =
    (lcContests.length > 0 ? 1 : 0) +
    (cfContests.length > 0 ? 1 : 0) +
    (ccContests.length > 0 ? 1 : 0);

  // Composite: 0.35×LC + 0.30×CC + 0.35×CF (each 0–100; 0 if not attended)
  const composite = 0.35 * lcScore + 0.30 * ccScore + 0.35 * cfScore;

  return {
    lcScore:  +lcScore.toFixed(4),
    cfScore:  +cfScore.toFixed(4),
    ccScore:  +ccScore.toFixed(4),
    composite: +composite.toFixed(4),
    platformsAttended,
    eligible: platformsAttended >= 2,   // must attend ≥ 2 platforms
    breakdown: { lcBest, cfBest, ccBest }
  };
}

module.exports = { computeWeeklyScore, logRatioScore, proxyScore, ccUnifiedScore, weekStart };
