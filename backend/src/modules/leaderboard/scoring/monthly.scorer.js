// src/modules/leaderboard/scoring/monthly.scorer.js
// Monthly leaderboard: 0.60×Contest + 0.40×Practice
//
// Contest = average of ALL weekly composite scores in the month (no drop-one).
//   Every week counts equally. If a student misses a week they get 0 for it.
//   This is fairer than drop-one because:
//     - Students who compete every week are properly rewarded
//     - Missing a week genuinely affects the score (no free pass)
//
// Practice = UDG solve points with MonthCF consistency factor

'use strict';

const { lcTier, cfTier, ccTier, applyWeeklyCap } = require('./udg');
const { isoWeek } = require('./placements.scorer');

const MONTH_BENCHMARK = 185;   // = placements benchmark / 6 months

/**
 * Get ISO week number for grouping.
 * Returns "YYYY-WW"
 */
function weekKey(date) { return isoWeek(date); }

/**
 * Get all week-start Mondays that belong to this calendar month.
 * A week belongs to the month containing its Monday.
 */
function weeksInMonth(year, month) {
  // month is 0-indexed
  const weeks = new Set();
  const d = new Date(year, month, 1);
  // Start from the Monday of the week containing the 1st
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  // Iterate until we're past the month
  while (true) {
    // If this Monday falls in the target month, include it
    if (d.getMonth() === month || d.getFullYear() * 12 + d.getMonth() < year * 12 + month + 1) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (d.getMonth() <= month && d.getFullYear() <= year) {
        weeks.add(key);
      }
    }
    d.setDate(d.getDate() + 7);
    if (d.getFullYear() > year || (d.getFullYear() === year && d.getMonth() > month)) break;
  }
  return Array.from(weeks);
}

/**
 * Compute monthly score for one student.
 *
 * @param {object} data
 *   weeklyScores    — Map<weekStart(YYYY-MM-DD), composite(0–100)>
 *                     (0 for weeks in the month where student didn't attend)
 *   solves          — this month's accepted solves from student_submissions
 *                     [{problem_id, platform, difficulty_tag, cf_rating, cc_rating,
 *                       acceptance_rate, total_submissions, submitted_at}]
 *   year, month     — e.g. 2025, 5 (0-indexed)
 *
 * @returns {{ contestPts, practicePts, monthUdg, activeWeeks, monthlyScore, eligible, breakdown }}
 */
function computeMonthlyScore(data) {
  const { weeklyScores = {}, solves = [], year, month } = data;

  const monthWeeks = weeksInMonth(year, month);
  const W = monthWeeks.length; // typically 4 or 5

  // ── Contest component (60pts) ─────────────────────────────────────────────
  // Build list of weekly composite scores (0 for weeks with no contests)
  const composites = monthWeeks.map(w => weeklyScores[w] || 0);

  // ALL weeks count equally — no drop-one rule.
  // A missed week contributes 0, which genuinely lowers the monthly score.
  const contestMonth = W > 0
    ? composites.reduce((s, v) => s + v, 0) / W
    : 0;

  const contestPts = +(0.60 * contestMonth).toFixed(4);

  // ── Practice component (40pts) ────────────────────────────────────────────
  // Tag each solve with tier + week
  const tagged = solves.map(s => {
    let tier;
    if (s.platform === 'leetcode') {
      tier = lcTier(s.difficulty_tag, s.acceptance_rate, s.total_submissions);
    } else if (s.platform === 'codeforces') {
      tier = s.cf_rating > 0 ? cfTier(s.cf_rating) : 3;
    } else if (s.platform === 'codechef') {
      tier = s.cc_rating > 0 ? ccTier(s.cc_rating) : 3;
    } else {
      tier = 1; // HackerRank - not UDG-scored
    }
    const points = [0, 1, 2, 4, 7, 11, 16][tier];
    return { tier, points, week: weekKey(s.submitted_at) };
  });

  const monthUdg = applyWeeklyCap(tagged);

  // Active weeks: weeks with ≥ 3 accepted solves on any platform
  const weekSolveCounts = {};
  for (const t of tagged) {
    weekSolveCounts[t.week] = (weekSolveCounts[t.week] || 0) + 1;
  }
  const activeWeeks = Object.values(weekSolveCounts).filter(c => c >= 3).length;

  // Monthly consistency factor: floor 0.6
  const monthCF    = Math.max(0.6, 0.6 + 0.4 * (activeWeeks / W));
  const effective  = monthUdg * monthCF;
  const ratio      = Math.min(1, effective / MONTH_BENCHMARK);
  const practicePts = +(40 * Math.pow(ratio, 0.7)).toFixed(4);

  const monthlyScore = +(contestPts + practicePts).toFixed(4);

  // Eligibility: ≥2 weekly boards attended AND ≥2 active practice weeks
  const weeksAttended = composites.filter(c => c > 0).length;
  const eligible      = weeksAttended >= 2 && activeWeeks >= 2;

  return {
    contestPts,
    practicePts,
    monthUdg:   +monthUdg.toFixed(2),
    activeWeeks,
    monthlyScore,
    eligible,
    breakdown: {
      W, composites, contestMonth, contestPts,
      monthUdg, monthCF, effective, ratio, practicePts,
      weeksAttended, activeWeeks
    }
  };
}

module.exports = { computeMonthlyScore, weeksInMonth };
