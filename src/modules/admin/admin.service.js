// src/modules/admin/admin.service.js
const { query } = require('../../config/db');

/**
 * List all students with their verification + blocklist status
 */
async function listStudents({ page = 1, limit = 50, verified, blocklisted }) {
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

  const where = conditions.join(' AND ');

  const res = await query(
    `SELECT email, full_name, roll_number, college, branch, phone,
            is_verified, is_blocklisted, created_at
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
 * Block a student — hides them from all leaderboards
 * Process is done after offline interview/testing (document line 57)
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

module.exports = { listStudents, blockStudent, unblockStudent };
