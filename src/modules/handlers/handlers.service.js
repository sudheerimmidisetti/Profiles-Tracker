// src/modules/handlers/handlers.service.js
const { query } = require('../../config/db');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { generateVerificationCode } = require('../../utils/tokenGen');

const leetcodeScraper  = require('../../scrapers/leetcode.scraper');
const codeforcesScraper = require('../../scrapers/codeforces.scraper');
const codechefScraper  = require('../../scrapers/codechef.scraper');
const hackerrankScraper = require('../../scrapers/hackerrank.scraper');

const VERIFY_TTL = 86400; // 24 hours

// ─────────────────────────────────────────────────────────────
// STEP 1: Submit handles
//   → validate uniqueness (no other student owns them)
//   → generate verification code
//   → store handles + code in Redis (24h)
//   → return code to user
// ─────────────────────────────────────────────────────────────
async function submitHandlers(email, { leetcode, codeforces, codechef, hackerrank }) {
  const platforms = [
    { name: 'leetcode',   handle: leetcode   },
    { name: 'codeforces', handle: codeforces },
    { name: 'codechef',   handle: codechef   },
    { name: 'hackerrank', handle: hackerrank }
  ];

  // 1. Check each handle is not already claimed by another student
  for (const { name, handle } of platforms) {
    if (!handle) continue;
    const res = await query(
      `SELECT student_email FROM platform_profiles
       WHERE platform_name = $1 AND username = $2`,
      [name, handle]
    );
    if (res.rows.length > 0 && res.rows[0].student_email !== email) {
      const err = new Error(`${name} handle "${handle}" is already claimed by another student`);
      err.statusCode = 409;
      throw err;
    }
  }

  // 2. Generate the 8-char verification code
  const code = generateVerificationCode();

  // 3. Store everything in Redis under  verify:profile:<email>
  const payload = JSON.stringify({ code, leetcode, codeforces, codechef, hackerrank });
  await redis.set(`verify:profile:${email}`, payload, 'EX', VERIFY_TTL);

  logger.info(`Verification code generated for ${email}: ${code}`);

  return {
    code,
    message:
      'Set this code as the FIRST NAME / DISPLAY NAME on all 4 platforms, ' +
      'then call POST /api/handlers/confirm. Code expires in 24 hours.'
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 2: Get current verification status
// ─────────────────────────────────────────────────────────────
async function getVerifyStatus(email) {
  const raw = await redis.get(`verify:profile:${email}`);

  if (!raw) {
    // Check if already verified in DB
    const res = await query(
      'SELECT is_verified FROM students WHERE email = $1',
      [email]
    );
    return {
      pendingVerification: false,
      isVerified: res.rows[0]?.is_verified || false,
      message: res.rows[0]?.is_verified
        ? 'Account already verified'
        : 'No active verification. Submit handlers first.'
    };
  }

  const { code, leetcode, codeforces, codechef, hackerrank } = JSON.parse(raw);
  return {
    pendingVerification: true,
    isVerified: false,
    code,
    handles: { leetcode, codeforces, codechef, hackerrank },
    message: `Change the FIRST NAME on all 4 platforms to "${code}" then call confirm.`
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 3: Confirm verification
//   → scrape first name from all 4 platforms
//   → compare against code stored in Redis
//   → if ALL match: flush Redis, save handles to DB, mark is_verified
// ─────────────────────────────────────────────────────────────
async function confirmVerification(email) {
  const raw = await redis.get(`verify:profile:${email}`);
  if (!raw) {
    const err = new Error('No pending verification found. Please submit your handles first.');
    err.statusCode = 400;
    throw err;
  }

  const { code, leetcode, codeforces, codechef, hackerrank } = JSON.parse(raw);

  // Scrape display/first names from all 4 platforms in parallel
  const [lcName, cfName, ccName, hrName] = await Promise.all([
    leetcode   ? leetcodeScraper.getDisplayName(leetcode)   : Promise.resolve(null),
    codeforces ? codeforcesScraper.getDisplayName(codeforces) : Promise.resolve(null),
    codechef   ? codechefScraper.getDisplayName(codechef)   : Promise.resolve(null),
    hackerrank ? hackerrankScraper.getDisplayName(hackerrank) : Promise.resolve(null)
  ]);

  // Check each platform (only if handle was provided)
  const results = {
    leetcode:   { handle: leetcode,   name: lcName, passed: !leetcode   || lcName?.toUpperCase() === code },
    codeforces: { handle: codeforces, name: cfName, passed: !codeforces || cfName?.toUpperCase() === code },
    codechef:   { handle: codechef,   name: ccName, passed: !codechef   || ccName?.toUpperCase() === code },
    hackerrank: { handle: hackerrank, name: hrName, passed: !hackerrank || hrName?.toUpperCase() === code }
  };

  const allPassed = Object.values(results).every((r) => r.passed);

  if (!allPassed) {
    const failed = Object.entries(results)
      .filter(([, v]) => !v.passed)
      .map(([k, v]) => ({ platform: k, handle: v.handle, found: v.name, expected: code }));

    return { success: false, message: 'Verification failed on some platforms', failed, results };
  }

  // ✅ All passed — flush Redis, save to DB, mark verified
  await redis.del(`verify:profile:${email}`);

  // Save handles to platform_profiles
  const platformData = [
    { name: 'leetcode',   handle: leetcode   },
    { name: 'codeforces', handle: codeforces },
    { name: 'codechef',   handle: codechef   },
    { name: 'hackerrank', handle: hackerrank }
  ].filter((p) => p.handle);

  for (const { name, handle } of platformData) {
    await query(
      `INSERT INTO platform_profiles (student_email, platform_name, username)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_email, platform_name) DO UPDATE SET username = EXCLUDED.username`,
      [email, name, handle]
    );
  }

  // Mark student as verified
  await query('UPDATE students SET is_verified = TRUE WHERE email = $1', [email]);

  logger.info(`Student ${email} successfully verified all handles`);

  return {
    success: true,
    message: 'All platforms verified successfully! Your account is now verified.',
    results
  };
}

module.exports = { submitHandlers, getVerifyStatus, confirmVerification };
