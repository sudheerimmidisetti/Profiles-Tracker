// src/modules/leaderboard/leaderboard.service.js
const { query } = require('../../config/db');

const VALID_PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'hackerrank'];
const VALID_FILTERS   = ['all', 'contest', 'consistency', 'problems'];

/**
 * Return leaderboard for a given platform + filter.
 * Blocklisted students are ALWAYS excluded.
 *
 * Filters:
 *   all         — sorted by total_solved DESC (default)
 *   contest     — sorted by contest rating DESC (platform-specific table)
 *   consistency — sorted by active days DESC (leetcode calendar; others by recent activity)
 *   problems    — sorted by total_solved DESC (same as all but explicit)
 */
async function getLeaderboard(platform, filter = 'all', page = 1, limit = 50) {
  if (!VALID_PLATFORMS.includes(platform)) {
    const err = new Error(`Invalid platform. Choose from: ${VALID_PLATFORMS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  if (!VALID_FILTERS.includes(filter)) {
    const err = new Error(`Invalid filter. Choose from: ${VALID_FILTERS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const offset = (page - 1) * limit;

  let sql, params;

  if (filter === 'contest') {
    // Contest-rating sort — join with platform-specific table
    sql = buildContestLeaderboard(platform, limit, offset);
    params = [platform, limit, offset];
  } else if (filter === 'consistency') {
    sql = buildConsistencyLeaderboard(platform, limit, offset);
    params = [platform, limit, offset];
  } else {
    // 'all' and 'problems' — sort by total_solved in platform_profiles
    sql = `
      SELECT
        s.email, s.full_name, s.roll_number, s.branch,
        pp.username, pp.current_rating, pp.global_rank,
        pp.total_solved, pp.easy_solved, pp.medium_solved, pp.hard_solved,
        pp.last_updated,
        ROW_NUMBER() OVER (ORDER BY pp.total_solved DESC) AS rank
      FROM platform_profiles pp
      JOIN students s ON s.email = pp.student_email
      WHERE pp.platform_name = $1
        AND s.is_verified    = TRUE
        AND s.is_blocklisted = FALSE
      ORDER BY pp.total_solved DESC
      LIMIT $2 OFFSET $3`;
    params = [platform, limit, offset];
  }

  const res   = await query(sql, params);
  const count = await query(
    `SELECT COUNT(*) FROM platform_profiles pp
     JOIN students s ON s.email = pp.student_email
     WHERE pp.platform_name = $1 AND s.is_verified = TRUE AND s.is_blocklisted = FALSE`,
    [platform]
  );

  return {
    platform,
    filter,
    page,
    limit,
    total:  parseInt(count.rows[0].count, 10),
    data:   res.rows
  };
}

function buildContestLeaderboard(platform, limit, offset) {
  const tableMap = {
    leetcode:   'leetcode_profiles   lp ON lp.student_email = pp.student_email',
    codeforces: 'codeforces_profiles cp ON cp.student_email = pp.student_email',
    codechef:   'codechef_profiles   dp ON dp.student_email = pp.student_email',
    hackerrank: 'hackerrank_profiles hp ON hp.student_email = pp.student_email'
  };

  const ratingColMap = {
    leetcode:   'lp.contest_rating',
    codeforces: 'cp.current_rating',
    codechef:   'dp.current_rating',
    hackerrank: 'hp.total_points'
  };

  const joinTable  = tableMap[platform];
  const ratingCol  = ratingColMap[platform];

  return `
    SELECT
      s.email, s.full_name, s.roll_number, s.branch,
      pp.username, pp.total_solved,
      ${ratingCol} AS contest_rating,
      ROW_NUMBER() OVER (ORDER BY ${ratingCol} DESC) AS rank
    FROM platform_profiles pp
    JOIN students s ON s.email = pp.student_email
    JOIN ${joinTable}
    WHERE pp.platform_name = $1
      AND s.is_verified    = TRUE
      AND s.is_blocklisted = FALSE
    ORDER BY ${ratingCol} DESC
    LIMIT $2 OFFSET $3`;
}

function buildConsistencyLeaderboard(platform, limit, offset) {
  // LeetCode: we can count active days from the contribution_calendar JSON
  // Other platforms: fallback to most_recently updated (proxy for activity)
  if (platform === 'leetcode') {
    return `
      SELECT
        s.email, s.full_name, s.roll_number, s.branch,
        pp.username, pp.total_solved,
        lp.contest_rating,
        jsonb_array_length(
          COALESCE(
            (SELECT jsonb_agg(v) FROM jsonb_each_text(lp.contribution_calendar) AS t(k,v)
             WHERE v::int > 0),
            '[]'::jsonb
          )
        ) AS active_days,
        ROW_NUMBER() OVER (
          ORDER BY jsonb_array_length(
            COALESCE(
              (SELECT jsonb_agg(v) FROM jsonb_each_text(lp.contribution_calendar) AS t(k,v)
               WHERE v::int > 0),
              '[]'::jsonb
            )
          ) DESC
        ) AS rank
      FROM platform_profiles pp
      JOIN students s  ON s.email  = pp.student_email
      JOIN leetcode_profiles lp ON lp.student_email = pp.student_email
      WHERE pp.platform_name = $1
        AND s.is_verified    = TRUE
        AND s.is_blocklisted = FALSE
      ORDER BY active_days DESC
      LIMIT $2 OFFSET $3`;
  }

  // Fallback for other platforms: sort by last_updated (most active recently)
  return `
    SELECT
      s.email, s.full_name, s.roll_number, s.branch,
      pp.username, pp.current_rating, pp.total_solved,
      pp.last_updated,
      ROW_NUMBER() OVER (ORDER BY pp.last_updated DESC) AS rank
    FROM platform_profiles pp
    JOIN students s ON s.email = pp.student_email
    WHERE pp.platform_name = $1
      AND s.is_verified    = TRUE
      AND s.is_blocklisted = FALSE
    ORDER BY pp.last_updated DESC
    LIMIT $2 OFFSET $3`;
}

module.exports = { getLeaderboard };
