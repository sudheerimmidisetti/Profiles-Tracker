// src/modules/analytics/analytics.service.js
const { query } = require('../../config/db');

/**
 * Get historical daily snapshots for a student on all platforms
 * Used to build rating/solved charts on the frontend
 */
async function getSnapshots(email) {
  const res = await query(
    `SELECT platform_name, snapshot_date, rating, total_solved_snapshot
     FROM platform_daily_snapshots
     WHERE student_email = $1
     ORDER BY platform_name, snapshot_date ASC`,
    [email]
  );

  // Group by platform for convenience
  const grouped = {};
  for (const row of res.rows) {
    if (!grouped[row.platform_name]) grouped[row.platform_name] = [];
    grouped[row.platform_name].push({
      date:         row.snapshot_date,
      rating:       row.rating,
      totalSolved:  row.total_solved_snapshot
    });
  }

  return grouped;
}

/**
 * Cross-platform aggregated summary for a student
 */
async function getSummary(email) {
  const studentRes = await query(
    `SELECT email, full_name, roll_number, branch, is_verified
     FROM students WHERE email = $1`,
    [email]
  );

  if (!studentRes.rows.length) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }

  const platformRes = await query(
    `SELECT platform_name, username, current_rating, global_rank,
            total_solved, easy_solved, medium_solved, hard_solved, last_updated
     FROM platform_profiles WHERE student_email = $1`,
    [email]
  );

  // Fetch LeetCode-specific data (contribution_calendar for heatmap, contest_rating)
  const lcRes = await query(
    `SELECT contest_rating, global_ranking, top_percentage, contribution_calendar
     FROM leetcode_profiles WHERE student_email = $1`,
    [email]
  );

  // Aggregate totals across all platforms
  const totalSolved  = platformRes.rows.reduce((s, p) => s + (p.total_solved || 0), 0);
  const platforms    = {};
  for (const row of platformRes.rows) {
    platforms[row.platform_name] = row;
  }

  // Attach LeetCode-specific fields so dashboard heatmap + contest rating work
  if (lcRes.rows.length && platforms.leetcode) {
    const lc = lcRes.rows[0];
    platforms.leetcode.contest_rating       = lc.contest_rating;
    platforms.leetcode.global_ranking       = lc.global_ranking;
    platforms.leetcode.top_percentage       = lc.top_percentage;
    platforms.leetcode.contribution_calendar = lc.contribution_calendar;
  }

  return {
    student:    studentRes.rows[0],
    platforms,
    aggregate:  { totalSolved }
  };
}

module.exports = { getSnapshots, getSummary };
