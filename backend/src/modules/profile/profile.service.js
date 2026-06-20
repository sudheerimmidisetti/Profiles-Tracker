// src/modules/profile/profile.service.js
const { query } = require('../../config/db');

/**
 * Get the authenticated student's full profile with all platform stats
 */
async function getMyProfile(email) {
  // Core student data
  const studentRes = await query(
    `SELECT email, full_name, roll_number, college, branch, phone,
            passout_year, is_verified, is_blocklisted, created_at
     FROM students WHERE email = $1`,
    [email]
  );

  if (!studentRes.rows.length) {
    const err = new Error('Student not found');
    err.statusCode = 404;
    throw err;
  }

  const student = studentRes.rows[0];

  // Platform profiles (handles + aggregated stats)
  const platformRes = await query(
    `SELECT platform_name, username, current_rating, global_rank,
            total_solved, easy_solved, medium_solved, hard_solved, last_updated
     FROM platform_profiles WHERE student_email = $1`,
    [email]
  );

  // Detailed platform-specific data
  const [leetcode, codeforces, codechef, hackerrank] = await Promise.all([
    query('SELECT * FROM leetcode_profiles  WHERE student_email = $1', [email]),
    query('SELECT * FROM codeforces_profiles WHERE student_email = $1', [email]),
    query('SELECT * FROM codechef_profiles  WHERE student_email = $1', [email]),
    query('SELECT * FROM hackerrank_profiles WHERE student_email = $1', [email])
  ]);

  return {
    student,
    platforms: platformRes.rows,
    details: {
      leetcode:   leetcode.rows[0]   || null,
      codeforces: codeforces.rows[0] || null,
      codechef:   codechef.rows[0]   || null,
      hackerrank: hackerrank.rows[0] || null
    }
  };
}

/**
 * Update mutable student fields: full_name, branch, phone
 * (roll_number, college, email are immutable after registration)
 */
async function updateSettings(email, { full_name, branch, phone }) {
  const res = await query(
    `UPDATE students
     SET full_name = COALESCE($2, full_name),
         branch    = COALESCE($3, branch),
         phone     = COALESCE($4, phone)
     WHERE email = $1
     RETURNING email, full_name, roll_number, college, branch, phone`,
    [email, full_name || null, branch || null, phone || null]
  );
  return res.rows[0];
}

module.exports = { getMyProfile, updateSettings, getPublicProfile };

/**
 * Public profile — safe fields only, keyed by roll number
 * Returns student info + aggregated platform stats (no email/phone)
 */
async function getPublicProfile(rollNumber) {
  // Student row — include is_verified for verified badge display
  const sRes = await query(
    `SELECT full_name, roll_number, college, branch, passout_year, is_verified
     FROM students WHERE UPPER(roll_number) = UPPER($1) AND is_blocklisted = FALSE`,
    [rollNumber]
  );
  if (!sRes.rows.length) {
    const err = new Error('Profile not found');
    err.statusCode = 404;
    throw err;
  }
  const student = sRes.rows[0];

  // Platform profiles
  const ppRes = await query(
    `SELECT pp.platform_name,
            pp.username,
            pp.current_rating,
            pp.global_rank,
            pp.total_solved
     FROM platform_profiles pp
     JOIN students s ON s.email = pp.student_email
     WHERE UPPER(s.roll_number) = UPPER($1)`,
    [rollNumber]
  );

  const platforms = {};
  let totalSolved = 0;
  for (const p of ppRes.rows) {
    platforms[p.platform_name] = {
      username:       p.username,
      current_rating: p.current_rating ? Math.round(Number(p.current_rating)) : null,
      global_rank:    p.global_rank,
      total_solved:   p.total_solved ? Number(p.total_solved) : 0,
      is_verified:    student.is_verified, // inherit from student-level verification
    };
    totalSolved += Number(p.total_solved) || 0;
  }

  return { student, platforms, totalSolved };
}

