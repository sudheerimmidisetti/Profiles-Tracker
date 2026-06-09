// backend/scripts/seed-from-mock-db.js
// Fetches all students from the mock (or real) college DB and updates the
// students table. Run once to backfill existing rows.
// Usage: node scripts/seed-from-mock-db.js
'use strict';
require('dotenv').config();
const axios   = require('axios');
const { Pool } = require('pg');

const MOCK_URL = process.env.COLLEGE_DB_API_URL; // e.g. http://localhost:4000/api/students
const API_KEY  = process.env.COLLEGE_DB_API_KEY || '';
const pool     = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  if (!MOCK_URL) {
    console.error('❌  COLLEGE_DB_API_URL not set in .env');
    process.exit(1);
  }

  // Fetch all students from the college DB
  console.log(`📡  Fetching student list from ${MOCK_URL} …`);
  const { data } = await axios.get(MOCK_URL, {
    headers: { 'X-Api-Key': API_KEY },
    timeout: 10000,
  });

  const students = data.students || [];
  console.log(`   Found ${students.length} students in mock DB\n`);

  let updated = 0, skipped = 0;

  for (const s of students) {
    const { email, full_name, roll_number, college, branch, phone } = s;
    if (!email) { skipped++; continue; }

    const res = await pool.query(
      `UPDATE students
       SET full_name=$1, roll_number=$2, college=$3, branch=$4, phone=$5
       WHERE email=$6
       RETURNING email`,
      [full_name, roll_number, college, branch, phone, email.toLowerCase()]
    );

    if (res.rowCount > 0) {
      console.log(`  ✅  ${email.padEnd(35)} → ${full_name} (${roll_number})`);
      updated++;
    } else {
      console.log(`  ⚪  ${email.padEnd(35)} not in students table (not registered yet)`);
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated}  Skipped/not found: ${skipped}`);
  await pool.end();
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
