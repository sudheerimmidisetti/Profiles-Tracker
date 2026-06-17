// src/modules/leaderboard/scoring/monthly.scorer.js
// Monthly leaderboard: 100% Contest, contest-only.
//
// Score = (Week1 + Week2 + Week3 + Week4) / 4
//   Always 4 weeks. Always divide by 4. No practice. No drop-one.
//   WeekComposite comes from weekly_board: 0.35×LC + 0.35×CF + 0.30×CC

'use strict';

/**
 * Get the 4 week-start Mondays for the given month.
 * Week N starts on the Nth Monday that falls inside the month.
 * If the month has a 5th Monday, it is ignored — always exactly 4 weeks.
 */
function weeksInMonth(year, month) {
  // month is 0-indexed
  const mondays = [];
  const d = new Date(year, month, 1);
  // Find the first Monday on or after the 1st of the month
  const dow = d.getDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  d.setDate(d.getDate() + daysToMonday);
  // Collect exactly 4 Mondays
  for (let i = 0; i < 4; i++) {
    if (d.getMonth() !== month) break; // safety — shouldn't happen for ≥4 weeks
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    mondays.push(key);
    d.setDate(d.getDate() + 7);
  }
  return mondays;
}

/**
 * Compute monthly score for one student — contest only.
 *
 * @param {object} data
 *   weeklyScores — Map<weekStart(YYYY-MM-DD), composite(0–100)>
 *                  0 for weeks the student didn't compete.
 *   year, month  — e.g. 2026, 5 (0-indexed for June)
 *
 * @returns {{ monthlyScore, contestPts, activeWeeks, eligible, breakdown }}
 */
function computeMonthlyScore(data) {
  const { weeklyScores = {}, year, month } = data;

  // Always exactly 4 weeks
  const monthWeeks = weeksInMonth(year, month);
  const W = 4;

  // Score for each week: from weekly_board, or 0 if student didn't compete
  const composites = monthWeeks.map(w => weeklyScores[w] || 0);

  // Monthly score = (W1 + W2 + W3 + W4) / 4
  const total = composites.reduce((s, v) => s + v, 0);
  const monthlyScore = +(total / W).toFixed(4);

  // How many weeks did the student actually compete in?
  const weeksAttended = composites.filter(c => c > 0).length;

  // Eligible if competed in at least 2 of the 4 weeks
  const eligible = weeksAttended >= 2;

  return {
    monthlyScore,
    contestPts:   monthlyScore,
    practicePts:  0,   // kept for API compatibility
    monthUdg:     0,   // kept for API compatibility
    activeWeeks:  weeksAttended,
    eligible,
    breakdown: {
      W,
      weeks: monthWeeks,
      composites,
      weeksAttended,
    },
  };
}

module.exports = { computeMonthlyScore, weeksInMonth };
