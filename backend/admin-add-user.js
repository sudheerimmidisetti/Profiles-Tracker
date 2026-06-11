#!/usr/bin/env node
// admin-add-user.js
// Run on EC2: node admin-add-user.js
// Manually inserts a student and triggers a full profile sync (no OTP, no handle verification).

require('dotenv').config({ path: __dirname + '/.env' });

const { query } = require('./src/config/db');
const { syncStudent } = require('./src/jobs/syncProfiles.job');
const logger = require('./src/utils/logger');

// ─── STUDENT DATA (fill this in) ─────────────────────────────────────────────
const EMAIL        = '23a91a0560@aec.edu.in';
const FULL_NAME    = 'SHAIK UMAR';
const ROLL_NUMBER  = '23A91A0560';
const COLLEGE      = 'AEC';
const BRANCH       = 'CSE';
const PHONE        = null;           // not required (nullable)
const PASSOUT_YEAR = 2027;

const HANDLES = {
  leetcode:   'umar_1234',
  codechef:   'shaikumar14363',
  codeforces: 'shaik_umar',
  hackerrank: 'shaikumar14363',
};
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Admin user seed starting for ${EMAIL}...\n`);

  // 1. Upsert student row (bypass OTP — set is_verified = TRUE directly)
  await query(
    `INSERT INTO students
       (email, full_name, roll_number, college, branch, phone, passout_year, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
     ON CONFLICT (email) DO UPDATE SET
       full_name    = EXCLUDED.full_name,
       roll_number  = EXCLUDED.roll_number,
       college      = EXCLUDED.college,
       branch       = EXCLUDED.branch,
       phone        = COALESCE(EXCLUDED.phone, students.phone),
       passout_year = COALESCE(EXCLUDED.passout_year, students.passout_year),
       is_verified  = TRUE`,
    [EMAIL, FULL_NAME, ROLL_NUMBER, COLLEGE, BRANCH, PHONE, PASSOUT_YEAR]
  );
  console.log('✅ Student row upserted (is_verified = TRUE)');

  // 2. Upsert platform_profiles rows (username placeholders — sync will fill stats)
  for (const [platform, handle] of Object.entries(HANDLES)) {
    if (!handle) continue;
    await query(
      `INSERT INTO platform_profiles (student_email, platform_name, username)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_email, platform_name) DO UPDATE SET
         username = EXCLUDED.username`,
      [EMAIL, platform, handle]
    );
    console.log(`  ✅ platform_profiles: ${platform} → ${handle}`);
  }

  // 3. Trigger full sync (same as post-verification sync)
  console.log('\n🔄 Triggering full profile sync (this may take 30–60s)...\n');
  try {
    await syncStudent(EMAIL, HANDLES);
    console.log('\n✅ Sync complete! Student is now fully set up.\n');
  } catch (err) {
    console.error(`\n⚠️  Sync failed (student is still in DB): ${err.message}\n`);
    console.error('You can re-run this script or trigger sync from the admin panel.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
