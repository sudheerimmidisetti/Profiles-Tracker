// backend/src/modules/cohorts/cohorts.service.js
'use strict';

const { query } = require('../../config/db');

// ─── List all cohorts ─────────────────────────────────────────────────────────

async function listCohorts() {
  const res = await query(`
    SELECT c.id, c.name, c.description, c.created_by, c.created_at,
           COUNT(cm.student_email)::int AS member_count
    FROM cohorts c
    LEFT JOIN cohort_members cm ON cm.cohort_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  return res.rows;
}

// ─── Create cohort ────────────────────────────────────────────────────────────

async function createCohort({ name, description, createdBy }) {
  const res = await query(
    `INSERT INTO cohorts (name, description, created_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description || null, createdBy || null]
  );
  return res.rows[0];
}

// ─── Delete cohort ────────────────────────────────────────────────────────────

async function deleteCohort(id) {
  await query(`DELETE FROM cohorts WHERE id = $1`, [id]);
}

// ─── Get cohort members ───────────────────────────────────────────────────────

async function getCohortMembers(cohortId) {
  const res = await query(`
    SELECT s.email, s.full_name, s.roll_number, s.branch,
           cm.added_at,
           ARRAY_AGG(pp.platform_name) FILTER (WHERE pp.platform_name IS NOT NULL) AS platforms
    FROM cohort_members cm
    JOIN students s ON s.email = cm.student_email
    LEFT JOIN platform_profiles pp ON pp.student_email = s.email AND pp.is_verified = TRUE
    WHERE cm.cohort_id = $1
    GROUP BY s.email, s.full_name, s.roll_number, s.branch, cm.added_at
    ORDER BY s.roll_number
  `, [cohortId]);
  return res.rows;
}

// ─── Get eligible students (verified handlers, not blocklisted) ───────────────

async function getEligibleStudents(search = '') {
  const like = `%${search.toLowerCase()}%`;
  const res = await query(`
    SELECT s.email, s.full_name, s.roll_number, s.branch,
           ARRAY_AGG(pp.platform_name) FILTER (WHERE pp.platform_name IS NOT NULL) AS platforms
    FROM students s
    JOIN platform_profiles pp ON pp.student_email = s.email AND pp.is_verified = TRUE
    WHERE s.is_blocklisted = FALSE
      AND ($1 = '%%' OR LOWER(s.full_name) LIKE $1 OR LOWER(s.roll_number) LIKE $1)
    GROUP BY s.email, s.full_name, s.roll_number, s.branch
    ORDER BY s.roll_number
    LIMIT 100
  `, [like]);
  return res.rows;
}

// ─── Add members to cohort by roll numbers ────────────────────────────────────

async function addMembersByRollNumbers(cohortId, rollNumbers) {
  if (!rollNumbers.length) return { added: 0, notFound: [], alreadyIn: [] };

  // Resolve rolls to emails (only verified students)
  const res = await query(`
    SELECT s.email, s.roll_number
    FROM students s
    JOIN platform_profiles pp ON pp.student_email = s.email AND pp.is_verified = TRUE
    WHERE s.roll_number = ANY($1) AND s.is_blocklisted = FALSE
    GROUP BY s.email, s.roll_number
  `, [rollNumbers]);

  const found = res.rows;
  const foundRolls = found.map(r => r.roll_number);
  const notFound = rollNumbers.filter(r => !foundRolls.includes(r));

  if (!found.length) return { added: 0, notFound, alreadyIn: [] };

  // Insert ignoring duplicates
  const values = found.map(r => `('${cohortId}', '${r.email.replace(/'/g, "''")}')`).join(',');
  const insertRes = await query(`
    INSERT INTO cohort_members (cohort_id, student_email)
    VALUES ${values}
    ON CONFLICT (cohort_id, student_email) DO NOTHING
    RETURNING student_email
  `);

  const added = insertRes.rowCount;
  const alreadyIn = found
    .filter(r => !insertRes.rows.find(ir => ir.student_email === r.email))
    .map(r => r.roll_number);

  return { added, notFound, alreadyIn };
}

// ─── Remove member from cohort ────────────────────────────────────────────────

async function removeMember(cohortId, email) {
  await query(
    `DELETE FROM cohort_members WHERE cohort_id = $1 AND student_email = $2`,
    [cohortId, email]
  );
}

module.exports = {
  listCohorts,
  createCohort,
  deleteCohort,
  getCohortMembers,
  getEligibleStudents,
  addMembersByRollNumbers,
  removeMember,
};
