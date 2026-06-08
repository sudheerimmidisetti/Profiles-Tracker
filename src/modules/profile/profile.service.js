// src/modules/profile/profile.service.js
const { query } = require('../../config/db');

/**
 * Get the authenticated student's full profile with all platform stats
 */
async function getMyProfile(email) {
  // Core student data
  const studentRes = await query(
    `SELECT email, full_name, roll_number, college, branch, phone,
            is_verified, is_blocklisted, created_at
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

module.exports = { getMyProfile, updateSettings };
