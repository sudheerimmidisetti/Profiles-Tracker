// src/modules/admin/admin.service.js
const { query }       = require('../../config/db');
const { syncStudent } = require('../../jobs/syncProfiles.job');
const logger          = require('../../utils/logger');

/**
 * List all students with their verification + blocklist status
 */
async function listStudents({ page = 1, limit = 50, verified, blocklisted, search, branch, platform, college, passout_year }) {
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
  if (branch) {
    conditions.push(`LOWER(branch) = $${idx++}`);
    params.push(branch.toLowerCase());
  }
  if (college) {
    conditions.push(`LOWER(college) = $${idx++}`);
    params.push(college.toLowerCase());
  }
  if (passout_year) {
    conditions.push(`passout_year = $${idx++}`);
    params.push(parseInt(passout_year, 10));
  }

  const where = conditions.join(' AND ');

  // Build platform join if filtering by platform (student has a linked handle)
  let platformJoin = '';
  if (platform) {
    platformJoin = `LEFT JOIN platform_profiles pp_filter
      ON pp_filter.student_email = email AND pp_filter.platform_name = '${platform.toLowerCase()}'`;
    conditions.push(`pp_filter.username IS NOT NULL`);
  }

  const res = await query(
    `SELECT email, full_name, roll_number, college, branch, phone,
            passout_year, is_verified, is_blocklisted, created_at
     FROM students
     ${platformJoin}
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const countRes = await query(
    `SELECT COUNT(*) FROM students ${platformJoin} WHERE ${conditions.join(' AND ')}`,
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
  const [studStats, platformStats, recentStudents, branchDist, activeStats, hrBadges] = await Promise.all([
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

    // Per-platform: students, solved, avg/max rating, avg solved per linked student
    query(`
      SELECT
        platform_name,
        COUNT(DISTINCT student_email)                                AS students,
        SUM(total_solved)                                            AS total_solved,
        CASE WHEN COUNT(DISTINCT student_email) > 0
             THEN ROUND(SUM(total_solved)::numeric / COUNT(DISTINCT student_email), 1)
             ELSE 0 END                                             AS avg_solved_per_student,
        AVG(current_rating)                                         AS avg_rating,
        MAX(current_rating)                                         AS max_rating
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

    // HackerRank total badge stars across all students
    query(`
      SELECT
        COUNT(*) AS students_with_hr,
        COALESCE(SUM(
          COALESCE(problem_solving_stars,0) +
          COALESCE(sql_stars,0) +
          COALESCE(java_stars,0) +
          COALESCE(python_stars,0)
        ), 0) AS total_badges
      FROM hackerrank_profiles
    `).catch(() => ({ rows: [{ students_with_hr: 0, total_badges: 0 }] })),
  ]);

  const s = studStats.rows[0];
  const hrRow = hrBadges.rows[0] || {};
  const platformMap = {};
  for (const r of platformStats.rows) {
    platformMap[r.platform_name] = {
      students:              parseInt(r.students,             10) || 0,
      solved:                parseInt(r.total_solved,         10) || 0,
      avg_solved_per_student: parseFloat(r.avg_solved_per_student) || 0,
      avg_rating:            parseFloat(r.avg_rating)             || 0,
      max_rating:            parseFloat(r.max_rating)             || 0,
    };
  }
  // Attach HR badge data
  if (!platformMap.hackerrank) platformMap.hackerrank = { students: 0, solved: 0, avg_solved_per_student: 0, avg_rating: 0, max_rating: 0 };
  platformMap.hackerrank.badges          = parseInt(hrRow.total_badges,       10) || 0;
  platformMap.hackerrank.students_with_hr = parseInt(hrRow.students_with_hr, 10) || 0;

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
 * Dynamic filter options — colleges, passout years, branches from DB.
 * Used by both admin and student frontends.
 */
async function getFilters() {
  const [collegesRes, yearsRes, branchesRes] = await Promise.all([
    query(`SELECT DISTINCT college FROM students WHERE college IS NOT NULL AND college != '' ORDER BY college`),
    query(`SELECT DISTINCT passout_year FROM students WHERE passout_year IS NOT NULL ORDER BY passout_year DESC`),
    query(`SELECT DISTINCT branch FROM students WHERE branch IS NOT NULL AND branch != '' ORDER BY branch`),
  ]);
  return {
    colleges: collegesRes.rows.map(r => r.college),
    years:    yearsRes.rows.map(r => r.passout_year),
    branches: branchesRes.rows.map(r => r.branch),
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

/**
 * Update a student's handle for one platform, then re-sync that student.
 * Validates that the new username is not already claimed by another student.
 */
const VALID_PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'hackerrank'];
async function updateHandle(email, platform, username) {
  if (!VALID_PLATFORMS.includes(platform)) {
    const err = new Error(`Invalid platform. Choose: ${VALID_PLATFORMS.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Check no other student already claims this username on this platform
  const conflict = await query(
    `SELECT student_email FROM platform_profiles
     WHERE platform_name = $1 AND LOWER(username) = LOWER($2) AND student_email != $3`,
    [platform, username, email]
  );
  if (conflict.rows.length) {
    const err = new Error(
      `Handle "${username}" on ${platform} is already linked to ${conflict.rows[0].student_email}`
    );
    err.statusCode = 409;
    throw err;
  }

  // Upsert the handle
  await query(
    `INSERT INTO platform_profiles (student_email, platform_name, username)
     VALUES ($1, $2, $3)
     ON CONFLICT (student_email, platform_name) DO UPDATE SET username = EXCLUDED.username`,
    [email, platform, username]
  );

  logger.info(`[Admin] Updated ${email} ${platform} handle → "${username}" — queuing re-sync`);

  // Fetch all handles for this student so syncStudent gets the full picture
  const ppRes = await query(
    `SELECT platform_name, username FROM platform_profiles WHERE student_email = $1`,
    [email]
  );
  const handles = {};
  for (const r of ppRes.rows) handles[r.platform_name] = r.username;

  // Fire-and-forget re-sync
  setImmediate(() => {
    syncStudent(email, handles)
      .then(() => logger.info(`[Admin] Re-sync complete for ${email}`))
      .catch(e  => logger.warn(`[Admin] Re-sync error for ${email}: ${e.message}`));
  });

  return { email, platform, username, syncing: true };
}

/**
 * Force an immediate re-sync for a single student and WAIT for it to finish.
 * Unlike syncStudentNow, this does NOT fire-and-forget — it awaits completion
 * so the API endpoint can return a real success/error response.
 */
async function syncStudentNowAndWait(email) {
  const ppRes = await query(
    `SELECT platform_name, username FROM platform_profiles WHERE student_email = $1`,
    [email]
  );
  if (!ppRes.rows.length) {
    const err = new Error('No platform profiles found for this student');
    err.statusCode = 404;
    throw err;
  }
  const handles = {};
  for (const r of ppRes.rows) handles[r.platform_name] = r.username;

  // Await the sync — any thrown error will propagate to the controller
  await syncStudent(email, handles);

  return { email, handles, synced: true };
}

/**
 * Force an immediate re-sync for a single student using their current handles.
 * Fire-and-forget version (used by updateHandle).
 */
async function syncStudentNow(email) {
  const ppRes = await query(
    `SELECT platform_name, username FROM platform_profiles WHERE student_email = $1`,
    [email]
  );
  if (!ppRes.rows.length) {
    const err = new Error('No platform profiles found for this student');
    err.statusCode = 404;
    throw err;
  }
  const handles = {};
  for (const r of ppRes.rows) handles[r.platform_name] = r.username;

  setImmediate(() => {
    syncStudent(email, handles)
      .then(() => logger.info(`[Admin] Re-sync complete for ${email}`))
      .catch(e  => logger.warn(`[Admin] Re-sync error for ${email}: ${e.message}`));
  });

  return { email, handles, syncing: true };
}

// ─────────────────────────────────────────────────────────────
// Handle Update Requests (admin-side)
// ─────────────────────────────────────────────────────────────

/**
 * List handle update requests with optional status filter + pagination.
 */
async function listHandleRequests({ status = null, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const conds  = [];
  const params = [];
  let   idx    = 1;

  if (status) { conds.push(`r.status = $${idx++}`); params.push(status); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const res = await query(
    `SELECT r.*,
            s.full_name, s.roll_number, s.branch, s.college
     FROM handle_update_requests r
     JOIN students s ON s.email = r.student_email
     ${where}
     ORDER BY
       CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
       r.requested_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const countRes = await query(
    `SELECT COUNT(*) FROM handle_update_requests r ${where}`,
    params
  );

  // Also get count of pending requests for badge
  const pendingRes = await query(
    `SELECT COUNT(*) FROM handle_update_requests WHERE status = 'pending'`
  );

  return {
    total:        parseInt(countRes.rows[0].count, 10),
    pendingCount: parseInt(pendingRes.rows[0].count, 10),
    data:         res.rows,
  };
}

/**
 * Approve a handle update request:
 * - Update platform_profiles with new handles
 * - Mark request as approved
 * - Trigger async sync
 */
async function approveHandleRequest(requestId, adminEmail) {
  const res = await query(
    `SELECT * FROM handle_update_requests WHERE id = $1`,
    [requestId]
  );
  if (!res.rows.length) {
    const err = new Error('Handle update request not found'); err.statusCode = 404; throw err;
  }
  const req = res.rows[0];
  if (req.status !== 'pending') {
    const err = new Error(`Request is already ${req.status}`); err.statusCode = 400; throw err;
  }

  const email = req.student_email;

  // Apply new handles to platform_profiles
  const platformMap = {
    leetcode:   req.lc_handle,
    codeforces: req.cf_handle,
    codechef:   req.cc_handle,
    hackerrank: req.hr_handle,
  };

  const handleMap = {};
  for (const [platform, handle] of Object.entries(platformMap)) {
    if (!handle) continue;
    await query(
      `INSERT INTO platform_profiles (student_email, platform_name, username)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_email, platform_name) DO UPDATE SET username = EXCLUDED.username`,
      [email, platform, handle]
    );
    handleMap[platform] = handle;
  }

  // Mark request approved
  await query(
    `UPDATE handle_update_requests
     SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1
     WHERE id = $2`,
    [adminEmail, requestId]
  );

  logger.info(`[Admin] Handle update request #${requestId} approved for ${email} by ${adminEmail}`);

  // Trigger async re-sync so new data loads right away
  const currentHandlesRes = await query(
    `SELECT platform_name, username FROM platform_profiles WHERE student_email = $1`,
    [email]
  );
  const fullHandles = {};
  for (const r of currentHandlesRes.rows) fullHandles[r.platform_name] = r.username;

  setImmediate(() => {
    syncStudent(email, fullHandles)
      .then(() => logger.info(`[Admin] Handle-request sync complete for ${email}`))
      .catch(e  => logger.warn(`[Admin] Handle-request sync failed for ${email}: ${e.message}`));
  });

  return { approved: true, email, handles: fullHandles, syncing: true };
}

/**
 * Reject a handle update request.
 */
async function rejectHandleRequest(requestId, adminEmail, reason = '') {
  const res = await query(
    `SELECT id, status, student_email FROM handle_update_requests WHERE id = $1`,
    [requestId]
  );
  if (!res.rows.length) {
    const err = new Error('Handle update request not found'); err.statusCode = 404; throw err;
  }
  if (res.rows[0].status !== 'pending') {
    const err = new Error(`Request is already ${res.rows[0].status}`); err.statusCode = 400; throw err;
  }

  await query(
    `UPDATE handle_update_requests
     SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1, reject_reason = $2
     WHERE id = $3`,
    [adminEmail, reason || null, requestId]
  );

  logger.info(`[Admin] Handle update request #${requestId} rejected for ${res.rows[0].student_email} by ${adminEmail}`);
  return { rejected: true };
}

module.exports = {
  listStudents, getStudent, getOverview, getFilters,
  blockStudent, unblockStudent,
  updateHandle, syncStudentNow, syncStudentNowAndWait,
  listHandleRequests, approveHandleRequest, rejectHandleRequest,
};

