// src/modules/leaderboard/scoring/monthly.scorer.js
// Monthly leaderboard: 100% Contest, contest-only.
//
// Score = (Week1 + Week2 + Week3 + Week4) / 4
//   Always 4 weeks per month. Divide by 4. No practice.
//
// IMPORTANT: weekly_board stores week_start as the SUNDAY (end of IST week).
//   e.g. the week of Jun 1–7 is stored as week_start = 2026-06-07 (Sunday).
//   So this scorer uses Sundays as week keys to match weekly_board exactly.

'use strict';

/**
 * Get the 4 "week keys" (Sundays) for the given month.
 * Each key matches what weekly_board stores as week_start.
 *
 * Logic:
 *   - Find the first Sunday that falls in the month
 *   - Collect exactly 4 consecutive Sundays from there
 *
 * Example for June 2026:
 *   June 7, 14, 21, 28  (all Sundays in June)
 */
function weeksInMonth(year, month) {
  // month is 0-indexed
  const sundays = [];
  const d = new Date(year, month, 1);
  // Advance to the first Sunday of the month
  const dow = d.getDay(); // 0=Sun, 1=Mon, ...
  if (dow !== 0) {
    d.setDate(d.getDate() + (7 - dow)); // next Sunday
  }
  // Collect exactly 4 Sundays
  for (let i = 0; i < 4; i++) {
    if (d.getMonth() !== month) break; // safety guard
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    sundays.push(key);
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

/**
 * Convert a contest timestamp (ms) to its week key (Sunday YYYY-MM-DD in IST).
 * Matches the format written by the weekly leaderboard to weekly_board.
 */
function contestWeekKey(tsMs) {
  // Shift to IST (UTC+5:30)
  const ist = new Date(tsMs + (5.5 * 60 * 60 * 1000));
  const dow  = ist.getUTCDay(); // 0=Sun
  // Days until next Sunday (0 if already Sunday)
  const daysToSunday = dow === 0 ? 0 : 7 - dow;
  const sunday = new Date(ist.getTime() + daysToSunday * 86400000);
  sunday.setUTCHours(0, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
}

/**
 * Compute monthly score for one student — contest only.
 *
 * @param {object} data
 *   weeklyScores — Map<weekStart(YYYY-MM-DD Sunday), composite(0–100)>
 *   weekKeys     — optional ordered array of Sunday keys from weekly_board.
 *                  When provided, these real keys are used instead of arithmetic.
 *                  When absent (fallback), weeksInMonth() derives the keys.
 *   year, month  — e.g. 2026, 5 (0-indexed for June)
 *
 * @returns {{ monthlyScore, contestPts, activeWeeks, eligible, breakdown }}
 */
function computeMonthlyScore(data) {
  const { weeklyScores = {}, weekKeys, year, month } = data;

  // Use real week keys from weekly_board when available; otherwise derive them.
  // Always cap at 4 weeks. Always divide by 4.
  const allKeys    = weekKeys || weeksInMonth(year, month);
  const monthWeeks = allKeys.slice(0, 4); // hard cap at 4
  const W = 4;

  // Score for each of the 4 weeks (0 if student didn't compete that week)
  const composites = monthWeeks.map(w => weeklyScores[w] || 0);

  // Monthly score = (W1 + W2 + W3 + W4) / 4
  const total = composites.reduce((s, v) => s + v, 0);
  const monthlyScore = +(total / W).toFixed(4);

  // How many weeks did the student actually compete?
  const weeksAttended = composites.filter(c => c > 0).length;

  // Eligible if competed in at least 2 of the 4 weeks
  const eligible = weeksAttended >= 2;

  return {
    monthlyScore,
    contestPts:  monthlyScore,
    practicePts: 0,
    monthUdg:    0,
    activeWeeks: weeksAttended,
    eligible,
    breakdown: {
      W,
      weeks:     monthWeeks,
      composites,
      weeksAttended,
    },
  };
}

module.exports = { computeMonthlyScore, weeksInMonth, contestWeekKey };
