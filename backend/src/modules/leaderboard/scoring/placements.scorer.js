// src/modules/leaderboard/scoring/placements.scorer.js
// 6-month rolling window placements score.
// Total = 100 pts = LC(30) + CC(30) + CF(20) + HR(20)
// Each CP platform: 50% problem-solving + 50% contest
//
// Problem-solving uses COHORT-RELATIVE benchmarking (v3):
//   The student with the highest effectivePoints in the cohort scores full marks
//   on the problem component. Everyone else is scaled relative to them.
//   This removes arbitrary fixed benchmarks (450/350/300) entirely.

'use strict';

const { applyWeeklyCap, cfTier, ccTier, lcTier } = require('./udg');

// ─── Benchmarks & Weights ─────────────────────────────────────────────────────────────
const WINDOW_DAYS  = 182;   // 26 weeks
const WINDOW_WEEKS = 26;

const PLATFORM_WEIGHTS = { leetcode: 30, codechef: 30, codeforces: 20 };
const HR_TOTAL_PTS     = 20;

// Fallback floor benchmark used ONLY when cohortMax is 0
// (e.g. no student solved a single problem — prevents division by zero).
// Set low intentionally so even a few problems give meaningful score.
const FLOOR_BENCHMARKS = { leetcode: 10, codechef: 8, codeforces: 6 };

// Expected contests in 6 months (for participation score)
const EXPECTED_CONTESTS = { leetcode: 20, codechef: 18, codeforces: 18 };

// CF rating anchors for absolute-level score (L)
const CF_ANCHORS = [
  [800, 0.05], [1000, 0.15], [1200, 0.35], [1400, 0.55],
  [1600, 0.75], [1900, 0.95], [9999, 1.0],
];

// CC stars → L score proxy
const CC_STAR_L = [0, 0.1, 0.25, 0.45, 0.65, 0.80, 0.95]; // index = stars (1-6)

// LC contest rating → L score
const LC_ANCHORS = [
  [1400, 0.05], [1500, 0.20], [1600, 0.35], [1700, 0.50],
  [1800, 0.65], [1900, 0.80], [2100, 0.95], [9999, 1.0],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** ISO week string for a Date: "YYYY-WW" */
function isoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const wn    = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-${String(wn).padStart(2, '0')}`;
}

function lerp(anchors, val) {
  if (val <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    if (val <= anchors[i][0]) {
      const [x0, y0] = anchors[i - 1];
      const [x1, y1] = anchors[i];
      return y0 + (y1 - y0) * ((val - x0) / (x1 - x0));
    }
  }
  return anchors[anchors.length - 1][1];
}

function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }

// ─── Problem-solving score for one CP platform ────────────────────────────────

/**
 * Compute raw effectivePoints for a student on one platform.
 * Used in the service's FIRST PASS to find the cohort maximum.
 *
 * Returns: { effectivePoints, cappedPts, consistencyFactor, activeWeeks, maxStreak }
 */
function computeRawProblemPts(solves, platform, windowStart) {
  const tagged = solves
    .filter(s => s.submitted_at && new Date(s.submitted_at).getTime() >= windowStart)
    .map(s => {
      let tier;
      if (platform === 'leetcode') {
        tier = lcTier(s.difficulty_tag, s.acceptance_rate, s.total_submissions);
      } else if (platform === 'codeforces') {
        tier = s.cf_rating > 0 ? cfTier(s.cf_rating) : 3;
      } else {
        tier = s.cc_rating > 0 ? ccTier(s.cc_rating) : 3;
      }
      const points = [0, 1, 2, 4, 7, 11, 16][tier];
      return { tier, points, week: isoWeek(s.submitted_at) };
    })
    .sort((a, b) => a.week.localeCompare(b.week));

  const cappedPts = applyWeeklyCap(tagged);

  const weekSolveCounts = {};
  for (const t of tagged) weekSolveCounts[t.week] = (weekSolveCounts[t.week] || 0) + 1;
  const activeWeeks = Object.values(weekSolveCounts).filter(c => c >= 3).length;
  const coverage    = clamp(activeWeeks / WINDOW_WEEKS);

  let run = 0, maxStreak = 0, prev = null;
  for (const w of Array.from(new Set(tagged.map(t => t.week))).sort()) {
    if (weekSolveCounts[w] >= 3) { run = prev ? run + 1 : 1; maxStreak = Math.max(maxStreak, run); }
    else run = 0;
    prev = w;
  }
  const streakBonus       = clamp(maxStreak / WINDOW_WEEKS);
  const consistencyFactor = clamp(0.5 + 0.35 * coverage + 0.15 * streakBonus, 0.5, 1.0);
  const effectivePoints   = cappedPts * consistencyFactor;

  return { effectivePoints, cappedPts, consistencyFactor, activeWeeks, maxStreak };
}

/**
 * @param {object[]} solves   - from student_submissions filtered to platform+window
 *   Each: { problem_id, difficulty_tag, cf_rating, cc_rating, acceptance_rate,
 *            total_submissions, submitted_at }
 * @param {string} platform   - 'leetcode' | 'codeforces' | 'codechef'
 * @param {number} windowStart - timestamp ms (6 months ago)
 * @param {number} cohortMaxPts - highest effectivePoints in the cohort for this platform.
 *                                Pass 0 to fall back to FLOOR_BENCHMARKS.
 * @returns {{ rawPts, cappedPts, consistencyFactor, score, breakdown }}
 */
function problemScore(solves, platform, windowStart, cohortMaxPts = 0) {
  const maxPts  = PLATFORM_WEIGHTS[platform] * 0.5;  // 50% of platform weight

  // Tag each solve with its week + UDG tier
  const tagged = solves
    .filter(s => s.submitted_at && new Date(s.submitted_at).getTime() >= windowStart)
    .map(s => {
      let tier;
      if (platform === 'leetcode') {
        tier = lcTier(s.difficulty_tag, s.acceptance_rate, s.total_submissions);
      } else if (platform === 'codeforces') {
        tier = s.cf_rating > 0 ? cfTier(s.cf_rating) : 3; // default T3
      } else {
        tier = s.cc_rating > 0 ? ccTier(s.cc_rating) : 3;
      }
      const points = [0, 1, 2, 4, 7, 11, 16][tier];
      return { tier, points, week: isoWeek(s.submitted_at) };
    })
    .sort((a, b) => a.week.localeCompare(b.week));

  const rawPts    = tagged.reduce((s, t) => s + t.points, 0);
  const cappedPts = applyWeeklyCap(tagged);

  // Consistency: how many weeks were active (≥3 solves)?
  const weekSolveCounts = {};
  for (const t of tagged) {
    weekSolveCounts[t.week] = (weekSolveCounts[t.week] || 0) + 1;
  }
  const activeWeeks = Object.values(weekSolveCounts).filter(c => c >= 3).length;
  const coverage    = clamp(activeWeeks / WINDOW_WEEKS);

  // Streak: longest consecutive-active-week run
  const weeks   = Array.from(new Set(tagged.map(t => t.week))).sort();
  let streak    = 0, maxStreak = 0, run = 0, prev = null;
  for (const w of weeks) {
    if (weekSolveCounts[w] >= 3) {
      run = prev ? run + 1 : 1;
      maxStreak = Math.max(maxStreak, run);
    } else { run = 0; }
    prev = w;
  }
  const streakBonus       = clamp(maxStreak / WINDOW_WEEKS);
  const consistencyFactor = clamp(0.5 + 0.35 * coverage + 0.15 * streakBonus, 0.5, 1.0);

  const effectivePoints = cappedPts * consistencyFactor;

  // ── COHORT-RELATIVE BENCHMARK ───────────────────────────────────────────
  // benchmark = the highest effectivePoints scored by any student in this cohort.
  // Falls back to FLOOR_BENCHMARKS when cohortMax = 0 (empty cohort edge case).
  const benchmark = cohortMaxPts > 0 ? cohortMaxPts : FLOOR_BENCHMARKS[platform];

  const ratio = clamp(effectivePoints / benchmark);
  const score = maxPts * Math.pow(ratio, 0.7);

  return {
    rawPts, cappedPts, consistencyFactor, effectivePoints,
    activeWeeks, maxStreak,
    benchmark,           // expose for tooltip / debug
    score: +score.toFixed(4),
    breakdown: { rawPts, cappedPts, activeWeeks, maxStreak, consistencyFactor, effectivePoints, benchmark, score }
  };
}

// ─── Contest score for one CP platform ───────────────────────────────────────

/**
 * @param {object[]} contests  - from *_contest_history filtered to window
 *   Each: { rank_achieved, rating_change, new_rating, old_rating, timestamp_seconds,
 *            finish_time_seconds, total_participants (may be null) }
 * @param {string}  platform
 * @param {number}  currentRating
 * @param {number}  windowStart  - ms
 * @returns {{ score, breakdown }}
 */
function contestScore(contests, platform, currentRating, windowStart, expectedOverride = null) {
  const maxPts = PLATFORM_WEIGHTS[platform] * 0.5; // 50% of platform weight

  const inWindow = contests.filter(c => {
    const ts = (c.timestamp_seconds || 0) * 1000 || (c.contest_date ? new Date(c.contest_date).getTime() : 0);
    return ts >= windowStart;
  });

  const attended  = inWindow.length;
  const expected  = expectedOverride !== null ? expectedOverride : EXPECTED_CONTESTS[platform];


  // P — Participation (30%)
  const P = clamp(attended / expected);

  // Q — In-contest quality: average rank percentile (25%)
  // If we have participant counts, use them; otherwise use rating-change proxy
  let Q;
  const hasParticipants = inWindow.some(c => c.total_participants > 0);
  if (hasParticipants) {
    const percentiles = inWindow.map(c => {
      if (!c.total_participants) return 0.5; // no data → neutral
      return clamp(1 - c.rank_achieved / c.total_participants);
    });
    Q = percentiles.reduce((s, v) => s + v, 0) / percentiles.length;
  } else {
    // Proxy: fraction of contests where rating_change > 0 (positive performance)
    if (attended === 0) {
      Q = 0;
    } else {
      const positiveRuns = inWindow.filter(c => (c.rating_change || 0) > 0).length;
      Q = clamp(positiveRuns / attended * 0.75 + 0.25); // 0.25–1.0 range proxy
    }
  }

  // T — Trajectory (25%): EWMA-weighted rating delta, bounded by tanh
  let T = 0.5; // neutral default
  if (inWindow.length > 0) {
    // Recency-weighted: recent contests count 2×
    const sorted = [...inWindow].sort((a, b) => {
      const ta = (a.timestamp_seconds || 0) || (a.contest_date ? new Date(a.contest_date).getTime() / 1000 : 0);
      const tb = (b.timestamp_seconds || 0) || (b.contest_date ? new Date(b.contest_date).getTime() / 1000 : 0);
      return ta - tb;
    });
    const n = sorted.length;
    let weightSum = 0, deltaSum = 0;
    sorted.forEach((c, i) => {
      const w = 1 + (i / n); // 1× for oldest, ~2× for newest
      const delta = c.rating_change || (c.new_rating - c.old_rating) || 0;
      deltaSum  += w * delta;
      weightSum += w;
    });
    const ewmaDelta = weightSum > 0 ? deltaSum / weightSum : 0;
    T = clamp(0.5 + 0.5 * Math.tanh(ewmaDelta / 150));
  }

  // L — Absolute Level (20%): current rating → 0–1
  let L = 0;
  if (platform === 'leetcode') {
    L = lerp(LC_ANCHORS, currentRating);
  } else if (platform === 'codeforces') {
    L = lerp(CF_ANCHORS, currentRating);
  } else {
    // CodeChef: map stars (derived from rating)
    const stars = currentRating >= 2500 ? 6 : currentRating >= 2000 ? 5 :
                  currentRating >= 1600 ? 4 : currentRating >= 1400 ? 3 :
                  currentRating >= 1200 ? 2 : 1;
    L = CC_STAR_L[stars] || 0;
  }

  // Anti-cherry-picking guard: < 5 contests → cap at 60%
  const raw       = clamp(0.30 * P + 0.25 * Q + 0.25 * T + 0.20 * L);
  const capped    = attended < 5 ? Math.min(raw, 0.60) : raw;
  const score     = maxPts * capped;

  return {
    score: +score.toFixed(4),
    breakdown: { attended, expected, P, Q, T, L, raw, capped, score }
  };
}

// ─── HackerRank score (badge-based, lifetime) ─────────────────────────────────

/**
 * @param {object} hrProfile  - from hackerrank_profiles
 * @returns {{ score, breakdown }}
 */
function hackerrankScore(hrProfile) {
  if (!hrProfile) return { score: 0, breakdown: {} };

  const psStars  = clamp(hrProfile.problem_solving_stars || 0, 0, 6);
  const sqlStars = clamp(hrProfile.sql_stars             || 0, 0, 5);
  const javStars = clamp(hrProfile.java_stars            || 0, 0, 5);
  const pytStars = clamp(hrProfile.python_stars          || 0, 0, 5);

  // Problem Solving: non-linear (1,2,3,5,7,10)
  const PS_PTS = [0, 1, 2, 3, 5, 7, 10];
  const ps     = PS_PTS[psStars];
  const sql    = sqlStars * 0.7;           // max 3.5
  const java   = javStars * 0.7;           // max 3.5
  const python = pytStars * 0.6;           // max 3.0
  const score  = clamp(ps + sql + java + python, 0, 20);

  return {
    score: +score.toFixed(4),
    breakdown: { psStars, sqlStars, javStars, pytStars, ps, sql, java, python, score }
  };
}

// ─── Full placements score for one student ────────────────────────────────────

/**
 * @param {object} data
 *   lcSolves, ccSolves, cfSolves  — arrays of solve rows from student_submissions
 *   lcContests, ccContests, cfContests — arrays from *_contest_history
 *   lcRating, ccRating, cfRating  — current ratings
 *   hrProfile                     — row from hackerrank_profiles
 *   cohortMaxPts                  — { lc, cc, cf } cohort-max effectivePoints (from service first pass)
 * @returns {object} full score object with total + platform breakdowns
 */
function computePlacementsScore(data) {
  const windowStart = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const cmp = data.cohortMaxPts || {};

  // LC
  const lcProb    = problemScore(data.lcSolves    || [], 'leetcode',   windowStart, cmp.lc || 0);
  const lcContest = contestScore(data.lcContests  || [], 'leetcode',   data.lcRating  || 0, windowStart);
  const lcTotal   = lcProb.score + lcContest.score;

  // CC
  const ccProb    = problemScore(data.ccSolves    || [], 'codechef',   windowStart, cmp.cc || 0);
  const ccContest = contestScore(data.ccContests  || [], 'codechef',   data.ccRating  || 0, windowStart);
  const ccTotal   = ccProb.score + ccContest.score;

  // CF
  const cfProb    = problemScore(data.cfSolves    || [], 'codeforces', windowStart, cmp.cf || 0);
  const cfContest = contestScore(data.cfContests  || [], 'codeforces', data.cfRating  || 0, windowStart);
  const cfTotal   = cfProb.score + cfContest.score;

  // HR
  const hr        = hackerrankScore(data.hrProfile);

  const total = clamp(lcTotal + ccTotal + cfTotal + hr.score, 0, 100);

  return {
    total: +total.toFixed(4),
    lc:    { score: +lcTotal.toFixed(4), prob: lcProb.breakdown, contest: lcContest.breakdown },
    cc:    { score: +ccTotal.toFixed(4), prob: ccProb.breakdown, contest: ccContest.breakdown },
    cf:    { score: +cfTotal.toFixed(4), prob: cfProb.breakdown, contest: cfContest.breakdown },
    hr:    { score: hr.score, ...hr.breakdown },
  };
}

// ─── Full overall (all-time) score for one student ───────────────────────────

/**
 * Same metric as computePlacementsScore but uses windowStart = 0 (all-time).
 * WINDOW_WEEKS and EXPECTED_CONTESTS are scaled dynamically from journey length.
 *
 * @param {object} data - same shape as computePlacementsScore
 * @param {number} journeyStartMs - timestamp of first ever activity (ms)
 * @returns {object} full score object with total + platform breakdowns
 */
function computeOverallScore(data, journeyStartMs = 0) {
  const windowStart = journeyStartMs || 0; // include everything
  const nowMs       = Date.now();

  // Dynamic journey length in weeks (minimum 26 so scores aren't inflated for newcomers)
  const journeyWeeks = Math.max(26, Math.round((nowMs - windowStart) / (7 * 24 * 60 * 60 * 1000)));

  // Scale expected contests proportionally (capped at 3× the 6-month baseline)
  const scale = journeyWeeks / 26;
  const expectedLC = Math.min(Math.round(20 * scale), 120); // LC runs weekly
  const expectedCC = Math.min(Math.round(18 * scale), 100);
  const expectedCF = Math.min(Math.round(18 * scale), 100);

  const cmp = data.cohortMaxPts || {};

  const lcProb    = problemScore(data.lcSolves    || [], 'leetcode',   windowStart, cmp.lc || 0);
  const lcContest = contestScore(data.lcContests  || [], 'leetcode',   data.lcRating  || 0, windowStart, expectedLC);
  const lcTotal   = lcProb.score + lcContest.score;

  const ccProb    = problemScore(data.ccSolves    || [], 'codechef',   windowStart, cmp.cc || 0);
  const ccContest = contestScore(data.ccContests  || [], 'codechef',   data.ccRating  || 0, windowStart, expectedCC);
  const ccTotal   = ccProb.score + ccContest.score;

  const cfProb    = problemScore(data.cfSolves    || [], 'codeforces', windowStart, cmp.cf || 0);
  const cfContest = contestScore(data.cfContests  || [], 'codeforces', data.cfRating  || 0, windowStart, expectedCF);
  const cfTotal   = cfProb.score + cfContest.score;

  const hr    = hackerrankScore(data.hrProfile);
  const total = clamp(lcTotal + ccTotal + cfTotal + hr.score, 0, 100);

  return {
    total: +total.toFixed(4),
    lc:    { score: +lcTotal.toFixed(4), prob: lcProb.breakdown, contest: lcContest.breakdown },
    cc:    { score: +ccTotal.toFixed(4), prob: ccProb.breakdown, contest: ccContest.breakdown },
    cf:    { score: +cfTotal.toFixed(4), prob: cfProb.breakdown, contest: cfContest.breakdown },
    hr:    { score: hr.score, ...hr.breakdown },
  };
}

module.exports = { computePlacementsScore, computeOverallScore, problemScore, contestScore, hackerrankScore, isoWeek, computeRawProblemPts };
