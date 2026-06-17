// src/modules/leaderboard/scoring/monthly.scorer.js
// Monthly leaderboard: 100% Contest score
//
// Score = average of ALL weekly composite scores in the month.
// Every week counts equally. Missing a week = 0 for that week.
//
// WeekComposite (from weekly_board) = 0.35×LC + 0.35×CF + 0.30×CC
// Practice is NOT considered in the monthly leaderboard.

'use strict';

const { isoWeek } = require('./placements.scorer');

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
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  while (true) {
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
 * Compute monthly score for one student — contest only.
 *
 * @param {object} data
 *   weeklyScores — Map<weekStart(YYYY-MM-DD), composite(0–100)>
 *                  (0 for weeks where student didn't compete)
 *   solves       — ignored (kept for API compatibility)
 *   year, month  — e.g. 2025, 5 (0-indexed)
 *
 * @returns {{ monthlyScore, contestPts, weeksAttended, eligible, breakdown }}
 */
function computeMonthlyScore(data) {
  const { weeklyScores = {}, year, month } = data;

  const monthWeeks = weeksInMonth(year, month);
  const W          = monthWeeks.length; // typically 4 or 5

  // Weekly composite scores — 0 for weeks not competed
  const composites = monthWeeks.map(w => weeklyScores[w] || 0);

  // Monthly score = simple average of ALL weeks (no drop-one)
  const contestMonth = W > 0
    ? composites.reduce((s, v) => s + v, 0) / W
    : 0;

  // Scale to 100
  const monthlyScore = +contestMonth.toFixed(4);
  const contestPts   = monthlyScore; // alias for backward compat

  // Weeks where student actually competed
  const weeksAttended = composites.filter(c => c > 0).length;

  // Eligibility: competed in at least 2 weeks of the month
  const eligible = weeksAttended >= 2;

  return {
    monthlyScore,
    contestPts,
    practicePts:  0,   // kept for API shape compatibility
    monthUdg:     0,   // kept for API shape compatibility
    activeWeeks:  weeksAttended,
    eligible,
    breakdown: {
      W,
      composites,
      contestMonth,
      weeksAttended,
    },
  };
}

module.exports = { computeMonthlyScore, weeksInMonth };
