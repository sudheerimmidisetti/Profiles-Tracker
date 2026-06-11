// src/modules/leaderboard/scoring/udg.js
// Unified Difficulty Grade (UDG) — one 6-tier scale for all platforms.
// Maps a problem's known metadata to a tier (1–6) and its base points.
//
// Tier points: T1=1, T2=2, T3=4, T4=7, T5=11, T6=16

'use strict';

const TIER_POINTS = [0, 1, 2, 4, 7, 11, 16]; // index = tier (1-based)

/**
 * Compute UDG tier for a LeetCode problem.
 * Uses difficulty tag + acceptance rate per the spec.
 * Falls back to tag-only when totalSubmissions < 1000.
 *
 * @param {string}  tag            - 'Easy' | 'Medium' | 'Hard'
 * @param {number}  acceptanceRate - 0–100 (percentage)
 * @param {number}  totalSubmissions
 * @returns {number} tier 1–6
 */
function lcTier(tag, acceptanceRate, totalSubmissions = 999999) {
  const acc  = Number(acceptanceRate) || 0;
  const subs = Number(totalSubmissions);
  const t    = (tag || '').toLowerCase();

  // Low-data guard: trust tag alone (or T3 default if no tag either)
  if (subs < 1000) {
    if (t === 'easy')   return 2;
    if (t === 'medium') return 4;
    if (t === 'hard')   return 5;
    return 3;  // no tag at all → T3 (conservative median default)
  }

  if (t === 'easy') {
    if (acc > 65) return 1;   // T1 Warm-Up
    return 2;                  // T2 Elementary (acc 40–65)
  }
  if (t === 'medium') {
    if (acc > 60)  return 2;  // T2 (easy-medium)
    if (acc > 55)  return 3;  // T3 Intermediate
    if (acc > 39)  return 3;  // T3
    if (acc > 25)  return 4;  // T4 Standard
    return 5;                  // T5 Advanced (acc < 25%)
  }
  // hard
  if (acc > 45) return 5;    // T5
  return 6;                   // T6 Elite
}

/**
 * Compute UDG tier for a Codeforces problem.
 * @param {number} cfRating - problem rating (e.g. 1200)
 * @returns {number} tier 1–6
 */
function cfTier(cfRating) {
  const r = Number(cfRating) || 0;
  if (r <= 800)  return 1;
  if (r <= 1000) return 2;
  if (r <= 1200) return 3;
  if (r <= 1400) return 4;
  if (r <= 1600) return 5;
  return 6;
}

/**
 * Compute UDG tier for a CodeChef problem.
 * @param {number} ccRating - problem difficulty rating
 * @returns {number} tier 1–6
 */
function ccTier(ccRating) {
  const r = Number(ccRating) || 0;
  if (r <= 900)  return 1;
  if (r <= 1100) return 2;
  if (r <= 1300) return 3;
  if (r <= 1500) return 4;
  if (r <= 1700) return 5;
  return 6;
}

/**
 * Conservative tag-only fallback for unknown ratings.
 * @param {string} tag - 'Easy' | 'Medium' | 'Hard' | 'School' | 'Basic'
 */
function tagFallback(tag) {
  const t = (tag || '').toLowerCase();
  if (t === 'easy' || t === 'school' || t === 'basic') return 2;
  if (t === 'medium')                                   return 3;
  return 5; // hard
}

/**
 * Master tier resolver — pick the right sub-function based on platform + available data.
 *
 * @param {object} meta
 *   platform        - 'leetcode' | 'codeforces' | 'codechef'
 *   difficulty_tag  - Easy/Medium/Hard (LC) or School/Basic/Easy/Medium/Hard (CC)
 *   cf_rating       - CF problem rating (CF only)
 *   cc_rating       - CC difficulty rating (CC only)
 *   acceptance_rate - LC acceptance %
 *   total_submissions
 * @returns {{ tier: number, points: number }}
 */
function resolveTier(meta = {}) {
  const { platform, difficulty_tag, cf_rating, cc_rating, acceptance_rate, total_submissions } = meta;

  let tier;
  if (platform === 'leetcode') {
    tier = lcTier(difficulty_tag, acceptance_rate, total_submissions);
  } else if (platform === 'codeforces') {
    if (cf_rating > 0) {
      tier = cfTier(cf_rating);
    } else {
      tier = tagFallback(difficulty_tag);
    }
  } else if (platform === 'codechef') {
    if (cc_rating > 0) {
      tier = ccTier(cc_rating);
    } else {
      tier = tagFallback(difficulty_tag);
    }
  } else {
    // HackerRank — not UDG-scored per-problem; handled separately in HR badge scoring
    tier = 1;
  }

  return { tier, points: TIER_POINTS[tier] };
}

/**
 * Batch-compute tier for a list of problem metadata objects.
 * @param {object[]} problems
 * @returns {Map<string, {tier, points}>}  keyed by problem_id
 */
function batchResolveTiers(problems) {
  const out = new Map();
  for (const p of problems) {
    out.set(p.problem_id, resolveTier(p));
  }
  return out;
}

/**
 * Apply anti-grinding weekly cap:
 * Per platform per week: only the first 10 T1 + 10 T2 solves earn points.
 * T3+ is uncapped.
 *
 * @param {Array<{week, tier, points}>} solves  - already sorted by submitted_at ASC
 * @returns {number} total capped points
 */
function applyWeeklyCap(solves) {
  // Track weekly T1/T2 counts per platform
  const weekCounts = {}; // key: `${week}` -> { t1: n, t2: n }

  let total = 0;
  for (const s of solves) {
    const wk = s.week || 'unknown';
    if (!weekCounts[wk]) weekCounts[wk] = { t1: 0, t2: 0 };

    if (s.tier === 1) {
      if (weekCounts[wk].t1 < 10) { total += s.points; weekCounts[wk].t1++; }
      // else: over the cap, no points
    } else if (s.tier === 2) {
      if (weekCounts[wk].t2 < 10) { total += s.points; weekCounts[wk].t2++; }
    } else {
      total += s.points; // T3+ uncapped
    }
  }
  return total;
}

module.exports = { resolveTier, batchResolveTiers, applyWeeklyCap, TIER_POINTS, lcTier, cfTier, ccTier };
