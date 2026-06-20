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

  // Enrich Codeforces with current_rank (needed for tier badge in PlatformCard)
  try {
    const cfRes = await query(
      `SELECT current_rank FROM codeforces_profiles WHERE student_email = $1`,
      [email]
    );
    if (cfRes.rows.length && platforms.codeforces) {
      platforms.codeforces.current_rank = cfRes.rows[0].current_rank;
    }
  } catch (_) {}

  // Enrich HackerRank with badges + total_points (needed for badge chips)
  try {
    const hrRes = await query(
      `SELECT badges, total_points FROM hackerrank_profiles WHERE student_email = $1`,
      [email]
    );
    if (hrRes.rows.length && platforms.hackerrank) {
      platforms.hackerrank.badges       = hrRes.rows[0].badges;
      platforms.hackerrank.total_points = hrRes.rows[0].total_points;
    }
  } catch (_) {}

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
      `SELECT
         -- profile info
         username, real_name, avatar_url, about_me, school, company, job_title,
         country, reputation,
         -- ranking + stats
         global_ranking, contest_rating, top_percentage, total_solved,
         easy_solved, medium_solved, hard_solved, acceptance_rate,
         -- calendar
         streak, total_active_days, contribution_calendar,
         -- contest
         attended_contests_count, total_participants,
         contest_badge_name, contest_badge_icon, contest_badge_expired,
         -- JSONB rich data
         language_stats, skill_tags, badges, upcoming_badges,
         active_badge, recent_ac_submissions,
         last_synced
       FROM leetcode_profiles WHERE student_email = $1`,
      [email]
    );
    detail = d.rows[0] || {};

    const c = await query(
      `SELECT contest_title, contest_time, rank_achieved, problems_solved,
              total_problems, rating_after_contest, finish_time_seconds,
              trend_direction
       FROM leetcode_contest_history WHERE student_email = $1
       ORDER BY contest_time ASC`,
      [email]
    );
    contests = c.rows;

  } else if (platform === 'codeforces') {
    const d = await query(
      `SELECT
         username, first_name, last_name, country, city, organization,
         avatar_url, title_photo,
         current_rating, max_rating, current_rank, max_rank,
         contribution, friend_of_count,
         last_online_seconds, registration_seconds,
         total_solved, total_submissions, accepted_submissions, acceptance_rate,
         highest_rated_problem, most_frequent_tag,
         solved_rating_under_1200, solved_rating_1200_1599, solved_rating_1600_1899,
         solved_rating_1900_2199, solved_rating_above_2200,
         language_stats, tag_stats, submission_calendar, recent_ac_submissions,
         last_synced
       FROM codeforces_profiles WHERE student_email = $1`,
      [email]
    );
    detail = d.rows[0] || {};

    const c = await query(
      `SELECT contest_id, contest_name, rank_achieved, old_rating, new_rating,
              rating_change, timestamp_seconds, division, problems_solved
       FROM codeforces_contest_history WHERE student_email = $1
       ORDER BY timestamp_seconds ASC`,
      [email]
    );
    contests = c.rows;

  } else if (platform === 'codechef') {
    const d = await query(
      `SELECT
         username, display_name, avatar_url, country, institution,
         student_or_pro, is_pro_user,
         stars_string, current_rating, highest_rating,
         global_rank, country_rank, current_division,
         dsa_rating, dsa_highest_rating, dsa_global_rank, dsa_country_rank,
         starters_solved, practice_solved, peer_solved, total_solved,
         problems_fully_solved, problems_partial_solved,
         contests_participated, best_rank, win_rate,
         heat_map, badges, rating_graph,
         last_synced
       FROM codechef_profiles WHERE student_email = $1`,
      [email]
    );
    detail = d.rows[0] || {};

    const c = await query(
      `SELECT contest_code, contest_name, rank_achieved,
              rating_after_contest, rating_change,
              contest_date, contest_type, division, problems_solved_count
       FROM codechef_contest_history WHERE student_email = $1
       ORDER BY contest_date ASC`,
      [email]
    );
    contests = c.rows;

  } else if (platform === 'hackerrank') {
    const d = await query(
      `SELECT
         username, display_name, avatar_url, country, city,
         school, jobs_headline, about, graduation_year, created_at_hr,
         linkedin_url, github_url, website, twitter_url,
         followers_count, following_count,
         total_points, leaderboard_rank, level, elo_rating, contest_points, global_rank,
         medals_gold, medals_silver, medals_bronze, contests_participated,
         submissions_count, accepted_submissions, acceptance_rate,
         problem_solving_stars, problem_solving_score,
         cpp_stars, java_stars, python_stars, sql_stars,
         ruby_stars, js_stars, sql_score, algorithms_score, ds_score,
         badges, certificates, track_scores,
         last_synced
       FROM hackerrank_profiles WHERE student_email = $1`,
      [email]
    );
    detail = d.rows[0] || {};

    const s = await query(
      `SELECT challenge_slug, challenge_name, language, status,
              score, track, difficulty, submitted_at
       FROM hackerrank_recent_submissions WHERE student_email = $1
       ORDER BY submitted_at DESC NULLS LAST LIMIT 50`,
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

/**
 * Get all AC submissions for a student on a platform, optionally filtered to one date.
 * date: 'YYYY-MM-DD' | undefined
 */
async function getSubmissions(email, platform, date) {
  let sql, params;
  if (date) {
    // Filter to submissions on that specific date (in local-ish terms: date part of submitted_at)
    sql = `
      SELECT problem_id, problem_name, status, language, submitted_at, runtime_ms, memory_kb
      FROM student_submissions
      WHERE student_email = $1
        AND platform      = $2
        AND submitted_at::date = $3::date
      ORDER BY submitted_at DESC
    `;
    params = [email, platform, date];
  } else {
    sql = `
      SELECT problem_id, problem_name, status, language, submitted_at, runtime_ms, memory_kb
      FROM student_submissions
      WHERE student_email = $1
        AND platform      = $2
      ORDER BY submitted_at DESC
    `;
    params = [email, platform];
  }
  const res = await query(sql, params);
  return res.rows;
}

/**
 * Combined cross-platform submission heatmap for one student.
 * Merges: LC contribution_calendar (unix ts→count), CF submission_calendar (YYYY-MM-DD→count),
 *         CC heat_map (array {date,count}), and student_submissions table.
 * Returns: { calendarMap: {'YYYY-MM-DD': count}, firstDate: 'YYYY-MM-DD' | null }
 */
async function getHeatmap(email) {
  // ── 1. Pull platform calendars in parallel ──────────────────────────────────
  const [lcRes, cfRes, ccRes, ssRes] = await Promise.all([
    query(`SELECT contribution_calendar FROM leetcode_profiles   WHERE student_email = $1`, [email]),
    query(`SELECT submission_calendar   FROM codeforces_profiles WHERE student_email = $1`, [email]),
    query(`SELECT heat_map              FROM codechef_profiles   WHERE student_email = $1`, [email]),
    // student_submissions covers ALL platforms and is the most granular
    query(
      `SELECT submitted_at::date AS day, COUNT(*) AS cnt
       FROM student_submissions
       WHERE student_email = $1
       GROUP BY submitted_at::date`,
      [email]
    ),
  ]);

  const map = {};  // 'YYYY-MM-DD' → total count

  // helper: pad two digits
  const p = n => String(n).padStart(2, '0');
  // helper: local ISO from Date object
  function localISO(d) { return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }

  // ── 2. LeetCode: { "unix_timestamp": count } ────────────────────────────────
  try {
    let cal = lcRes.rows[0]?.contribution_calendar;
    if (typeof cal === 'string') cal = JSON.parse(cal);
    if (cal && typeof cal === 'object' && !Array.isArray(cal)) {
      for (const [key, cnt] of Object.entries(cal)) {
        const num = Number(key);
        const dt  = !isNaN(num) && num > 1e9 ? new Date(num * 1000) : new Date(key);
        if (!isNaN(dt)) {
          const iso = localISO(dt);
          map[iso] = (map[iso] || 0) + (parseInt(cnt) || 0);
        }
      }
    }
  } catch { /* skip if malformed */ }

  // ── 3. Codeforces: { "YYYY-MM-DD": count } ──────────────────────────────────
  try {
    let cal = cfRes.rows[0]?.submission_calendar;
    if (typeof cal === 'string') cal = JSON.parse(cal);
    if (cal && typeof cal === 'object' && !Array.isArray(cal)) {
      for (const [key, cnt] of Object.entries(cal)) {
        const num = Number(key);
        const dt  = !isNaN(num) && num > 1e9 ? new Date(num * 1000) : new Date(key);
        if (!isNaN(dt)) {
          const iso = localISO(dt);
          map[iso] = (map[iso] || 0) + (parseInt(cnt) || 0);
        }
      }
    }
  } catch { /* skip */ }

  // ── 4. CodeChef: [ {date: "2024-6-10", count: 32} ] ─────────────────────────
  try {
    let hm = ccRes.rows[0]?.heat_map;
    if (typeof hm === 'string') hm = JSON.parse(hm);
    if (Array.isArray(hm)) {
      for (const { date, count } of hm) {
        if (!date) continue;
        const parts = String(date).split('-');
        if (parts.length === 3) {
          const iso = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
          map[iso] = (map[iso] || 0) + (parseInt(count) || 0);
        }
      }
    }
  } catch { /* skip */ }

  // ── 5. student_submissions: authoritative per-day counts ────────────────────
  //    These are deduplicated/verified submissions — add on top of profile calendars
  //    but only for days NOT already covered by a platform calendar (avoid double-counting).
  //    Strategy: build a set of days we already have from profile calendars, then
  //    for student_submissions days, take the MAX(platform_cal, ss_count) not the sum
  //    because platform calendars count ALL submissions, ss only counts synced ones.
  const ssMap = {};
  for (const row of ssRes.rows) {
    const iso = localISO(new Date(row.day));
    ssMap[iso] = (ssMap[iso] || 0) + parseInt(row.cnt, 10);
  }
  // Merge: for each day in ssMap, take max (not sum) to avoid double-count
  for (const [iso, cnt] of Object.entries(ssMap)) {
    map[iso] = Math.max(map[iso] || 0, cnt);
  }

  // ── 6. Find first active date ────────────────────────────────────────────────
  const dates = Object.keys(map).filter(d => map[d] > 0).sort();
  const firstDate = dates[0] || null;

  return { calendarMap: map, firstDate };
}

module.exports = { getSnapshots, getSummary, getPlatformDetail, getSubmissions, getHeatmap };
