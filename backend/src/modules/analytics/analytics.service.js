// src/modules/analytics/analytics.service.js
const { query } = require('../../config/db');

/**
 * Get historical daily snapshots for a student on all platforms
 */
async function getSnapshots(email) {
  const res = await query(
    `SELECT platform_name, snapshot_date, rating, total_solved_snapshot
     FROM platform_daily_snapshots
     WHERE student_email = $1
     ORDER BY platform_name, snapshot_date ASC`,
    [email]
  );

  const grouped = {};
  for (const row of res.rows) {
    if (!grouped[row.platform_name]) grouped[row.platform_name] = [];
    grouped[row.platform_name].push({
      date:        row.snapshot_date,
      rating:      row.rating,
      totalSolved: row.total_solved_snapshot
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

  const totalSolved = platformRes.rows.reduce((s, p) => s + (p.total_solved || 0), 0);
  const platforms   = {};
  for (const row of platformRes.rows) {
    platforms[row.platform_name] = row;
  }

  // Enrich LeetCode with heatmap + contest data (non-fatal if missing)
  try {
    const lcRes = await query(
      `SELECT contest_rating, global_ranking, top_percentage, contribution_calendar
       FROM leetcode_profiles WHERE student_email = $1`,
      [email]
    );
    if (lcRes.rows.length && platforms.leetcode) {
      const lc = lcRes.rows[0];
      platforms.leetcode.contest_rating        = lc.contest_rating;
      platforms.leetcode.global_ranking        = lc.global_ranking;
      platforms.leetcode.top_percentage        = lc.top_percentage;
      platforms.leetcode.contribution_calendar = lc.contribution_calendar;
    }
  } catch (lcErr) {
    const logger = require('../../utils/logger');
    logger.warn(`[Analytics] leetcode_profiles enrichment skipped for ${email}: ${lcErr.message}`);
  }

  return { student: studentRes.rows[0], platforms, aggregate: { totalSolved } };
}

/**
 * Full platform-specific profile — ALL data from the detail tables
 * Returns: { base, detail, contests/submissions, snapshots }
 */
async function getPlatformDetail(email, platform) {
  // Base normalised row
  const baseRes = await query(
    `SELECT platform_name, username, current_rating, global_rank,
            total_solved, easy_solved, medium_solved, hard_solved, last_updated
     FROM platform_profiles WHERE student_email = $1 AND platform_name = $2`,
    [email, platform]
  );

  if (!baseRes.rows.length) {
    const err = new Error(`No ${platform} profile linked for this student`);
    err.statusCode = 404;
    throw err;
  }

  const base = baseRes.rows[0];

  // Daily snapshots for rating chart
  const snapRes = await query(
    `SELECT snapshot_date AS date, rating, total_solved_snapshot AS total_solved
     FROM platform_daily_snapshots
     WHERE student_email = $1 AND platform_name = $2
     ORDER BY snapshot_date ASC`,
    [email, platform]
  );

  let detail = {}, contests = [], submissions = [];

  if (platform === 'leetcode') {
    const d = await query(
      `SELECT username, global_ranking, contest_rating, top_percentage, contribution_calendar, last_synced
       FROM leetcode_profiles WHERE student_email = $1`,
      [email]
    );
    detail = d.rows[0] || {};

    const c = await query(
      `SELECT contest_title, contest_time, rank_achieved, problems_solved,
              rating_after_contest, finish_time_seconds
       FROM leetcode_contest_history WHERE student_email = $1
       ORDER BY contest_time DESC LIMIT 30`,
      [email]
    );
    contests = c.rows;

  } else if (platform === 'codeforces') {
    const d = await query(
      `SELECT username, current_rating, max_rating, current_rank, max_rank, contribution, avatar_url,
              solved_rating_under_1200, solved_rating_1200_1599, solved_rating_1600_1899,
              solved_rating_1900_2199, solved_rating_above_2200, last_synced
       FROM codeforces_profiles WHERE student_email = $1`,
      [email]
    );
    detail = d.rows[0] || {};

    const c = await query(
      `SELECT contest_name, rank_achieved, old_rating, new_rating, rating_change, timestamp_seconds
       FROM codeforces_contest_history WHERE student_email = $1
       ORDER BY timestamp_seconds DESC LIMIT 30`,
      [email]
    );
    contests = c.rows;

  } else if (platform === 'codechef') {
    const d = await query(
      `SELECT username, stars_string, current_rating, highest_rating, global_rank,
              country_rank, current_division, starters_solved, practice_solved,
              peer_solved, total_solved, last_synced
       FROM codechef_profiles WHERE student_email = $1`,
      [email]
    );
    detail = d.rows[0] || {};

    const c = await query(
      `SELECT contest_code, contest_name, rank_achieved, rating_after_contest, rating_change
       FROM codechef_contest_history WHERE student_email = $1
       ORDER BY id DESC LIMIT 30`,
      [email]
    );
    contests = c.rows;

  } else if (platform === 'hackerrank') {
    const d = await query(
      `SELECT username, total_points, global_rank,
              problem_solving_stars, problem_solving_score,
              cpp_stars, java_stars, python_stars, sql_stars, last_synced
       FROM hackerrank_profiles WHERE student_email = $1`,
      [email]
    );
    detail = d.rows[0] || {};

    const s = await query(
      `SELECT challenge_name, language, status, submitted_at
       FROM hackerrank_recent_submissions WHERE student_email = $1
       ORDER BY submitted_at DESC LIMIT 20`,
      [email]
    );
    submissions = s.rows;

  } else {
    const err = new Error(`Unknown platform: ${platform}`);
    err.statusCode = 400;
    throw err;
  }

  return { platform, base, detail, contests, submissions, snapshots: snapRes.rows };
}

module.exports = { getSnapshots, getSummary, getPlatformDetail };

