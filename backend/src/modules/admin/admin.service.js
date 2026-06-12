// src/modules/admin/admin.service.js
const { query } = require('../../config/db');

/**
 * List all students with their verification + blocklist status
 */
async function listStudents({ page = 1, limit = 50, verified, blocklisted, search }) {
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const params     = [];
  let   idx        = 1;

  if (verified !== undefined) {
    conditions.push(`is_verified = $${idx++}`);
    params.push(verified);
  }
  if (blocklisted !== undefined) {
    conditions.push(`is_blocklisted = $${idx++}`);
    params.push(blocklisted);
  }
  if (search) {
    conditions.push(`(
      LOWER(email) LIKE $${idx} OR
      LOWER(full_name) LIKE $${idx} OR
      LOWER(roll_number) LIKE $${idx} OR
      LOWER(branch) LIKE $${idx}
    )`);
    params.push(`%${search.toLowerCase()}%`);
    idx++;
  }

  const where = conditions.join(' AND ');

  const res = await query(
    `SELECT email, full_name, roll_number, college, branch, phone,
            passout_year, is_verified, is_blocklisted, created_at
     FROM students
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const countRes = await query(
    `SELECT COUNT(*) FROM students WHERE ${where}`,
    params
  );

  return {
    page, limit,
    total: parseInt(countRes.rows[0].count, 10),
    data:  res.rows
  };
}

/**
 * Single student with platform profiles
 */
async function getStudent(email) {
  const stuRes = await query(
    `SELECT email, full_name, roll_number, college, branch, phone,
            passout_year, is_verified, is_blocklisted, created_at
     FROM students WHERE email = $1`,
    [email]
  );
  if (!stuRes.rows.length) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }
  const student = stuRes.rows[0];

  const ppRes = await query(
    `SELECT platform_name, username, current_rating, total_solved,
            global_rank, last_updated
     FROM platform_profiles
     WHERE student_email = $1`,
    [email]
  );
  const platforms = {};
  for (const r of ppRes.rows) {
    platforms[r.platform_name] = r;
  }

  return { student, platforms };
}

/**
 * Overview dashboard stats — single round-trip for all KPIs
 */
async function getOverview() {
  const [studStats, platformStats, recentStudents, branchDist, activeStats] = await Promise.all([
    // Student counts
    query(`
      SELECT
        COUNT(*)                                   AS total,
        COUNT(*) FILTER (WHERE is_verified = TRUE) AS verified,
        COUNT(*) FILTER (WHERE is_blocklisted = TRUE) AS blocked,
        COUNT(*) FILTER (WHERE is_verified = TRUE AND created_at > NOW() - INTERVAL '7 days') AS new_this_week,
        COUNT(*) FILTER (WHERE is_verified = TRUE AND created_at > NOW() - INTERVAL '30 days') AS new_this_month
      FROM students
    `),

    // Per-platform student & solved counts
    query(`
      SELECT
        platform_name,
        COUNT(DISTINCT student_email)       AS students,
        SUM(total_solved)                   AS total_solved,
        AVG(current_rating)                 AS avg_rating,
        MAX(current_rating)                 AS max_rating
      FROM platform_profiles
      WHERE username IS NOT NULL AND username != ''
      GROUP BY platform_name
    `),

    // Most recently registered students
    query(`
      SELECT s.email, s.full_name, s.roll_number, s.branch,
             s.is_verified, s.created_at
      FROM students s
      ORDER BY s.created_at DESC
      LIMIT 5
    `),

    // Branch distribution
    query(`
      SELECT COALESCE(branch, 'Unknown') AS branch, COUNT(*) AS count
      FROM students
      WHERE is_verified = TRUE
      GROUP BY branch
      ORDER BY count DESC
    `),

    // Active in last 7 days (had a snapshot update)
    query(`
      SELECT COUNT(DISTINCT student_email) AS active_7d
      FROM platform_daily_snapshots
      WHERE snapshot_date > NOW() - INTERVAL '7 days'
    `),
  ]);

  const s = studStats.rows[0];
  const platformMap = {};
  for (const r of platformStats.rows) {
    platformMap[r.platform_name] = {
      students:   parseInt(r.students,     10) || 0,
      solved:     parseInt(r.total_solved, 10) || 0,
      avg_rating: parseFloat(r.avg_rating)     || 0,
      max_rating: parseFloat(r.max_rating)     || 0,
    };
  }

  return {
    students: {
      total:         parseInt(s.total,          10) || 0,
      verified:      parseInt(s.verified,        10) || 0,
      blocked:       parseInt(s.blocked,         10) || 0,
      newThisWeek:   parseInt(s.new_this_week,   10) || 0,
      newThisMonth:  parseInt(s.new_this_month,  10) || 0,
      active7d:      parseInt(activeStats.rows[0]?.active_7d, 10) || 0,
    },
    platforms: platformMap,
    recentStudents: recentStudents.rows,
    branchDist: branchDist.rows,
  };
}

/**
 * Block a student — hides them from all leaderboards
 */
async function blockStudent(email) {
  const res = await query(
    `UPDATE students SET is_blocklisted = TRUE
     WHERE email = $1 RETURNING email, full_name, is_blocklisted`,
    [email]
  );
  if (!res.rows.length) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }
  return res.rows[0];
}

/**
 * Unblock a student
 */
async function unblockStudent(email) {
  const res = await query(
    `UPDATE students SET is_blocklisted = FALSE
     WHERE email = $1 RETURNING email, full_name, is_blocklisted`,
    [email]
  );
  if (!res.rows.length) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }
  return res.rows[0];
}

module.exports = { listStudents, getStudent, getOverview, blockStudent, unblockStudent };
