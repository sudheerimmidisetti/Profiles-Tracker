// src/modules/leaderboard/leaderboard.service.js
// Handles all 4 leaderboard types:
//   1. Platform leaderboard (existing)
//   2. Placements leaderboard (6-month rolling, 100pts)
//   3. Weekly leaderboard (current week's contests)
//   4. Monthly leaderboard (calendar month, drop-one)

'use strict';

const { query }                  = require('../../config/db');
const { computePlacementsScore } = require('./scoring/placements.scorer');
const { computeWeeklyScore, weekStart } = require('./scoring/weekly.scorer');
const { computeMonthlyScore }    = require('./scoring/monthly.scorer');

const VALID_PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'hackerrank'];
const VALID_FILTERS   = ['all', 'contest', 'consistency', 'problems'];

// ─────────────────────────────────────────────────────────────────────────────
// 1. ORIGINAL PLATFORM LEADERBOARD (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
async function getLeaderboard(platform, filter = 'all', page = 1, limit = 50) {
  if (!VALID_PLATFORMS.includes(platform)) {
    const err = new Error(`Invalid platform. Choose from: ${VALID_PLATFORMS.join(', ')}`);
    err.statusCode = 400; throw err;
  }
  if (!VALID_FILTERS.includes(filter)) {
    const err = new Error(`Invalid filter. Choose from: ${VALID_FILTERS.join(', ')}`);
    err.statusCode = 400; throw err;
  }

  const offset = (page - 1) * limit;
  let sql, params;

  if (filter === 'contest') {
    sql    = buildContestLeaderboard(platform, limit, offset);
    params = [platform, limit, offset];
  } else if (filter === 'consistency') {
    sql    = buildConsistencyLeaderboard(platform, limit, offset);
    params = [platform, limit, offset];
  } else {
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

  return { platform, filter, page, limit, total: parseInt(count.rows[0].count, 10), data: res.rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PLACEMENTS LEADERBOARD (6-month rolling)
// ─────────────────────────────────────────────────────────────────────────────
async function getPlacementsLeaderboard(page = 1, limit = 50) {
  const offset      = (page - 1) * limit;
  const windowStart = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000);
  const windowISO   = windowStart.toISOString();

  // 1. Fetch all verified, non-blocklisted students
  const studentsRes = await query(
    `SELECT s.email, s.full_name, s.roll_number, s.branch,
            pp_lc.username  AS lc_handle,
            pp_cc.username  AS cc_handle,
            pp_cf.username  AS cf_handle,
            pp_hr.username  AS hr_handle,
            lp.contest_rating AS lc_rating,
            cp.current_rating AS cf_rating,
            dp.current_rating AS cc_rating
     FROM students s
     LEFT JOIN platform_profiles pp_lc ON pp_lc.student_email = s.email AND pp_lc.platform_name = 'leetcode'
     LEFT JOIN platform_profiles pp_cc ON pp_cc.student_email = s.email AND pp_cc.platform_name = 'codechef'
     LEFT JOIN platform_profiles pp_cf ON pp_cf.student_email = s.email AND pp_cf.platform_name = 'codeforces'
     LEFT JOIN platform_profiles pp_hr ON pp_hr.student_email = s.email AND pp_hr.platform_name = 'hackerrank'
     LEFT JOIN leetcode_profiles   lp  ON lp.student_email   = s.email
     LEFT JOIN codeforces_profiles cp  ON cp.student_email   = s.email
     LEFT JOIN codechef_profiles   dp  ON dp.student_email   = s.email
     WHERE s.is_verified = TRUE AND s.is_blocklisted = FALSE`,
    []
  );

  const students = studentsRes.rows;

  // 2. Batch-fetch all data we need (one query per data-type, not per student)
  const emails = students.map(s => s.email);
  if (emails.length === 0) return { page, limit, total: 0, data: [] };

  const [subRes, lcContRes, ccContRes, cfContRes, hrRes] = await Promise.all([
    // AC submissions in window (all platforms)
    query(
      `SELECT student_email, platform, problem_id, difficulty_tag,
              acceptance_rate, total_submissions, submitted_at
       FROM student_submissions
       WHERE student_email = ANY($1)
         AND status = 'AC'
         AND submitted_at >= $2
       ORDER BY submitted_at ASC`,
      [emails, windowISO]
    ),
    // LC contest history
    query(
      `SELECT student_email, contest_title, contest_time, rank_achieved,
              finish_time_seconds, problems_solved, rating_after_contest, total_problems,
              trend_direction
       FROM leetcode_contest_history
       WHERE student_email = ANY($1) AND contest_time >= $2`,
      [emails, Math.floor(windowStart.getTime() / 1000)]
    ),
    // CC contest history
    query(
      `SELECT student_email, contest_code, contest_name, rank_achieved,
              rating_after_contest, rating_change, contest_date, division, problems_solved_count
       FROM codechef_contest_history
       WHERE student_email = ANY($1) AND contest_date >= $2`,
      [emails, windowISO]
    ),
    // CF contest history
    query(
      `SELECT student_email, contest_id, contest_name, rank_achieved,
              old_rating, new_rating, rating_change, timestamp_seconds, problems_solved
       FROM codeforces_contest_history
       WHERE student_email = ANY($1) AND timestamp_seconds >= $2`,
      [emails, Math.floor(windowStart.getTime() / 1000)]
    ),
    // HackerRank profiles
    query(
      `SELECT student_email, problem_solving_stars, sql_stars, java_stars, python_stars
       FROM hackerrank_profiles WHERE student_email = ANY($1)`,
      [emails]
    ),
  ]);

  // Also fetch CF problem ratings from recent_ac_submissions JSON (best effort)
  const cfProfileRes = await query(
    `SELECT student_email, recent_ac_submissions FROM codeforces_profiles WHERE student_email = ANY($1)`,
    [emails]
  );

  // Index everything by email
  const byEmail = {};
  for (const s of students) byEmail[s.email] = { ...s, lcSolves: [], ccSolves: [], cfSolves: [], lcContests: [], ccContests: [], cfContests: [], hrProfile: null };

  // CF problem rating lookup from recent_ac_submissions JSON
  const cfProbRating = {}; // problem_id → cf_rating
  for (const row of cfProfileRes.rows) {
    const subs = typeof row.recent_ac_submissions === 'string'
      ? JSON.parse(row.recent_ac_submissions)
      : (row.recent_ac_submissions || []);
    for (const sub of subs) {
      if (sub.problemId && sub.problemRating) cfProbRating[sub.problemId] = sub.problemRating;
    }
  }

  for (const row of subRes.rows) {
    if (!byEmail[row.student_email]) continue;
    const solve = {
      problem_id: row.problem_id,
      difficulty_tag: row.difficulty_tag,
      acceptance_rate: row.acceptance_rate,
      total_submissions: row.total_submissions,
      submitted_at: row.submitted_at,
      cf_rating: cfProbRating[row.problem_id] || 0,
      cc_rating: 0,
    };
    if (row.platform === 'leetcode')   byEmail[row.student_email].lcSolves.push(solve);
    if (row.platform === 'codechef')   byEmail[row.student_email].ccSolves.push(solve);
    if (row.platform === 'codeforces') {
      solve.cf_rating = cfProbRating[row.problem_id] || 0;
      byEmail[row.student_email].cfSolves.push(solve);
    }
  }
  for (const row of lcContRes.rows)   byEmail[row.student_email]?.lcContests.push(row);
  for (const row of ccContRes.rows)   byEmail[row.student_email]?.ccContests.push({ ...row, rating_change: row.rating_change });
  for (const row of cfContRes.rows)   byEmail[row.student_email]?.cfContests.push({ ...row, timestamp_seconds: row.timestamp_seconds });
  for (const row of hrRes.rows)       { if (byEmail[row.student_email]) byEmail[row.student_email].hrProfile = row; }

  // 3. Score every student
  const scored = students.map(s => {
    const d = byEmail[s.email];
    const result = computePlacementsScore({
      lcSolves:    d.lcSolves,
      ccSolves:    d.ccSolves,
      cfSolves:    d.cfSolves,
      lcContests:  d.lcContests.map(c => ({ ...c, timestamp_seconds: c.contest_time })),
      ccContests:  d.ccContests,
      cfContests:  d.cfContests,
      lcRating:    s.lc_rating || 0,
      ccRating:    s.cc_rating || 0,
      cfRating:    s.cf_rating || 0,
      hrProfile:   d.hrProfile,
    });

    return {
      email:      s.email,
      full_name:  s.full_name,
      roll_number: s.roll_number,
      branch:     s.branch,
      lc_handle:  s.lc_handle,
      cc_handle:  s.cc_handle,
      cf_handle:  s.cf_handle,
      hr_handle:  s.hr_handle,
      total:      result.total,
      lc:         result.lc,
      cc:         result.cc,
      cf:         result.cf,
      hr:         result.hr,
    };
  });

  // 4. Sort + paginate
  scored.sort((a, b) => b.total - a.total);
  scored.forEach((s, i) => { s.rank = i + 1; });

  // 5. Upsert into placements_board cache
  for (const s of scored) {
    await query(
      `INSERT INTO placements_board
         (student_email, computed_at, lc_score, cc_score, cf_score, hr_score, total_score,
          lc_breakdown, cc_breakdown, cf_breakdown, hr_breakdown)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (student_email) DO UPDATE SET
         computed_at = NOW(), lc_score = EXCLUDED.lc_score, cc_score = EXCLUDED.cc_score,
         cf_score = EXCLUDED.cf_score, hr_score = EXCLUDED.hr_score,
         total_score = EXCLUDED.total_score,
         lc_breakdown = EXCLUDED.lc_breakdown, cc_breakdown = EXCLUDED.cc_breakdown,
         cf_breakdown = EXCLUDED.cf_breakdown, hr_breakdown = EXCLUDED.hr_breakdown`,
      [s.email, s.lc.score, s.cc.score, s.cf.score, s.hr.score, s.total,
       JSON.stringify(s.lc), JSON.stringify(s.cc), JSON.stringify(s.cf), JSON.stringify(s.hr)]
    ).catch(() => {}); // non-fatal
  }

  const page_data = scored.slice(offset, offset + limit);
  return { page, limit, total: scored.length, data: page_data };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WEEKLY LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────
async function getWeeklyLeaderboard(weekParam, page = 1, limit = 50) {
  const offset   = (page - 1) * limit;
  const wkStart  = weekParam || weekStart(); // 'YYYY-MM-DD' (Monday)
  const wkEnd    = new Date(new Date(wkStart).getTime() + 7 * 86400000).toISOString().slice(0, 10);

  // Fetch all students
  const studentsRes = await query(
    `SELECT s.email, s.full_name, s.roll_number, s.branch,
            pp_lc.username AS lc_handle,
            pp_cc.username AS cc_handle,
            pp_cf.username AS cf_handle
     FROM students s
     LEFT JOIN platform_profiles pp_lc ON pp_lc.student_email = s.email AND pp_lc.platform_name = 'leetcode'
     LEFT JOIN platform_profiles pp_cc ON pp_cc.student_email = s.email AND pp_cc.platform_name = 'codechef'
     LEFT JOIN platform_profiles pp_cf ON pp_cf.student_email = s.email AND pp_cf.platform_name = 'codeforces'
     WHERE s.is_verified = TRUE AND s.is_blocklisted = FALSE`,
    []
  );
  const students = studentsRes.rows;
  const emails   = students.map(s => s.email);
  if (!emails.length) return { week: wkStart, page, limit, total: 0, data: [] };

  // Fetch this week's contests from each platform history
  const [lcRes, ccRes, cfRes] = await Promise.all([
    query(
      `SELECT student_email, contest_title, rank_achieved AS rank,
              problems_solved, total_problems,
              finish_time_seconds, rating_after_contest,
              (rating_after_contest - LAG(rating_after_contest) OVER (PARTITION BY student_email ORDER BY contest_time)) AS rating_change,
              contest_time
       FROM leetcode_contest_history
       WHERE student_email = ANY($1)
         AND to_timestamp(contest_time) >= $2::date
         AND to_timestamp(contest_time) <  $3::date`,
      [emails, wkStart, wkEnd]
    ),
    query(
      `SELECT student_email, contest_code, rank_achieved AS rank,
              problems_solved_count AS problems_solved, 0 AS total_problems,
              rating_change, division, contest_date
       FROM codechef_contest_history
       WHERE student_email = ANY($1)
         AND contest_date >= $2::date
         AND contest_date <  $3::date`,
      [emails, wkStart, wkEnd]
    ),
    query(
      `SELECT student_email, contest_id, rank_achieved AS rank,
              problems_solved, 0 AS total_problems,
              rating_change, timestamp_seconds
       FROM codeforces_contest_history
       WHERE student_email = ANY($1)
         AND to_timestamp(timestamp_seconds) >= $2::date
         AND to_timestamp(timestamp_seconds) <  $3::date`,
      [emails, wkStart, wkEnd]
    ),
  ]);

  // Find best college rank per platform (for log-ratio base)
  const bestLCRank = lcRes.rows.reduce((mn, r) => (!mn || r.rank < mn) ? r.rank : mn, null);
  const bestCFRank = cfRes.rows.reduce((mn, r) => (!mn || r.rank < mn) ? r.rank : mn, null);
  const bestCCRank = ccRes.rows.reduce((mn, r) => (!mn || r.rank < mn) ? r.rank : mn, null);

  // Group by email
  const byEmail = {};
  for (const s of students) byEmail[s.email] = { ...s, lcContests: [], ccContests: [], cfContests: [] };
  for (const r of lcRes.rows)  byEmail[r.student_email]?.lcContests.push(r);
  for (const r of ccRes.rows)  byEmail[r.student_email]?.ccContests.push(r);
  for (const r of cfRes.rows)  byEmail[r.student_email]?.cfContests.push(r);

  const scored = students.map(s => {
    const d = byEmail[s.email];
    const result = computeWeeklyScore({
      lcContests: d.lcContests,
      cfContests: d.cfContests,
      ccContests: d.ccContests,
      collegeBase: { lc: bestLCRank, cf: bestCFRank, cc: bestCCRank },
    });
    return {
      email:       s.email,
      full_name:   s.full_name,
      roll_number: s.roll_number,
      branch:      s.branch,
      lc_handle:   s.lc_handle,
      cc_handle:   s.cc_handle,
      cf_handle:   s.cf_handle,
      ...result,
    };
  }).filter(s => s.platformsAttended > 0);

  scored.sort((a, b) => b.composite - a.composite);
  scored.forEach((s, i) => { s.rank = i + 1; });

  // Upsert weekly_board rows
  for (const s of scored) {
    await query(
      `INSERT INTO weekly_board (student_email, week_start, lc_score, cf_score, cc_score, composite, platforms_attended, eligible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (student_email, week_start) DO UPDATE SET
         lc_score = EXCLUDED.lc_score, cf_score = EXCLUDED.cf_score,
         cc_score = EXCLUDED.cc_score, composite = EXCLUDED.composite,
         platforms_attended = EXCLUDED.platforms_attended, eligible = EXCLUDED.eligible`,
      [s.email, wkStart, s.lcScore, s.cfScore, s.ccScore, s.composite, s.platformsAttended, s.eligible]
    ).catch(() => {});
  }

  return {
    week:  wkStart,
    page, limit,
    total: scored.length,
    data:  scored.slice(offset, offset + limit),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MONTHLY LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────
async function getMonthlyLeaderboard(monthParam, page = 1, limit = 50) {
  const offset  = (page - 1) * limit;
  // monthParam = 'YYYY-MM', default = current month
  const now     = new Date();
  const [yr, mo] = monthParam
    ? monthParam.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const year  = yr;
  const month = mo - 1; // 0-indexed

  const monthStart = new Date(year, month, 1).toISOString();
  const monthEnd   = new Date(year, month + 1, 1).toISOString();

  const studentsRes = await query(
    `SELECT s.email, s.full_name, s.roll_number, s.branch,
            pp_lc.username AS lc_handle, pp_cc.username AS cc_handle, pp_cf.username AS cf_handle
     FROM students s
     LEFT JOIN platform_profiles pp_lc ON pp_lc.student_email = s.email AND pp_lc.platform_name = 'leetcode'
     LEFT JOIN platform_profiles pp_cc ON pp_cc.student_email = s.email AND pp_cc.platform_name = 'codechef'
     LEFT JOIN platform_profiles pp_cf ON pp_cf.student_email = s.email AND pp_cf.platform_name = 'codeforces'
     WHERE s.is_verified = TRUE AND s.is_blocklisted = FALSE`,
    []
  );
  const students = studentsRes.rows;
  const emails   = students.map(s => s.email);
  if (!emails.length) return { month: `${yr}-${String(mo).padStart(2,'0')}`, page, limit, total: 0, data: [] };

  // Fetch this month's weekly_board scores
  const weeklyRes = await query(
    `SELECT student_email, week_start, composite
     FROM weekly_board
     WHERE student_email = ANY($1)
       AND week_start >= $2::date
       AND week_start <  $3::date`,
    [emails, monthStart, monthEnd]
  );

  // Fetch this month's solves
  const solvesRes = await query(
    `SELECT student_email, platform, problem_id, difficulty_tag,
            acceptance_rate, total_submissions, submitted_at
     FROM student_submissions
     WHERE student_email = ANY($1)
       AND status = 'AC'
       AND submitted_at >= $2
       AND submitted_at <  $3`,
    [emails, monthStart, monthEnd]
  );

  // Group by email
  const byEmail = {};
  for (const s of students) byEmail[s.email] = { ...s, weeklyScores: {}, solves: [] };
  for (const r of weeklyRes.rows) {
    if (byEmail[r.student_email]) {
      byEmail[r.student_email].weeklyScores[r.week_start.toISOString().slice(0,10)] = parseFloat(r.composite);
    }
  }
  for (const r of solvesRes.rows) {
    byEmail[r.student_email]?.solves.push(r);
  }

  const scored = students.map(s => {
    const d = byEmail[s.email];
    const result = computeMonthlyScore({
      weeklyScores: d.weeklyScores,
      solves:       d.solves,
      year, month,
    });
    return {
      email:       s.email,
      full_name:   s.full_name,
      roll_number: s.roll_number,
      branch:      s.branch,
      lc_handle:   s.lc_handle,
      cc_handle:   s.cc_handle,
      cf_handle:   s.cf_handle,
      ...result,
    };
  }).filter(s => s.monthlyScore > 0 || s.activeWeeks > 0);

  scored.sort((a, b) => b.monthlyScore - a.monthlyScore);
  scored.forEach((s, i) => { s.rank = i + 1; });

  // Upsert monthly_board
  const monthDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  for (const s of scored) {
    await query(
      `INSERT INTO monthly_board
         (student_email, month, contest_pts, practice_pts, month_udg, active_weeks, monthly_score, eligible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (student_email, month) DO UPDATE SET
         contest_pts = EXCLUDED.contest_pts, practice_pts = EXCLUDED.practice_pts,
         month_udg = EXCLUDED.month_udg, active_weeks = EXCLUDED.active_weeks,
         monthly_score = EXCLUDED.monthly_score, eligible = EXCLUDED.eligible`,
      [s.email, monthDate, s.contestPts, s.practicePts, s.monthUdg, s.activeWeeks, s.monthlyScore, s.eligible]
    ).catch(() => {});
  }

  return {
    month:  `${yr}-${String(mo).padStart(2, '0')}`,
    page, limit,
    total:  scored.length,
    data:   scored.slice(offset, offset + limit),
  };
}

// ─── Existing helpers (unchanged) ─────────────────────────────────────────────
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
  const joinTable = tableMap[platform];
  const ratingCol = ratingColMap[platform];
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
  if (platform === 'leetcode') {
    return `
      SELECT
        s.email, s.full_name, s.roll_number, s.branch,
        pp.username, pp.total_solved, lp.contest_rating,
        jsonb_array_length(
          COALESCE(
            (SELECT jsonb_agg(v) FROM jsonb_each_text(lp.contribution_calendar) AS t(k,v) WHERE v::int > 0),
            '[]'::jsonb
          )
        ) AS active_days,
        ROW_NUMBER() OVER (
          ORDER BY jsonb_array_length(
            COALESCE(
              (SELECT jsonb_agg(v) FROM jsonb_each_text(lp.contribution_calendar) AS t(k,v) WHERE v::int > 0),
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

module.exports = { getLeaderboard, getPlacementsLeaderboard, getWeeklyLeaderboard, getMonthlyLeaderboard };
