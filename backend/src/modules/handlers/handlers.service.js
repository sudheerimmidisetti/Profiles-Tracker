// src/modules/handlers/handlers.service.js
const { query } = require('../../config/db');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { generateVerificationCode } = require('../../utils/tokenGen');

const leetcodeScraper   = require('../../scrapers/leetcode.scraper');
const codeforcesScraper = require('../../scrapers/codeforces.scraper');
const codechefScraper   = require('../../scrapers/codechef.scraper');
const hackerrankScraper = require('../../scrapers/hackerrank.scraper');

// Trigger immediate data sync after verification so dashboard loads right away
const { syncStudent } = require('../../jobs/syncProfiles.job');

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

  // 2. Generate the 8-char verification code (uppercase alphanumeric)
  const code = generateVerificationCode();

  // 3. Store everything in Redis under  verify:profile:<email>
  const payload = JSON.stringify({ code, leetcode, codeforces, codechef, hackerrank });
  await redis.set(`verify:profile:${email}`, payload, 'EX', VERIFY_TTL);

  logger.info(`Verification code generated for ${email}: ${code}`);

  return {
    code,
    message:
      'Set this exact code as the FIRST NAME / DISPLAY NAME on each platform you submitted, ' +
      'then call POST /api/handlers/confirm. Code expires in 24 hours.',
    instructions: {
      leetcode:   leetcode   ? `Go to leetcode.com → Profile → Edit → set Name field to "${code}"` : null,
      codeforces: codeforces ? `Go to codeforces.com → Settings → set First name to "${code}"` : null,
      codechef:   codechef   ? `Go to codechef.com → Edit Profile → set First Name to "${code}"` : null,
      hackerrank: hackerrank ? `Go to hackerrank.com → Edit Profile → set Full Name to "${code}"` : null
    }
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 2: Get current verification status
// ─────────────────────────────────────────────────────────────
async function getVerifyStatus(email) {
  const raw = await redis.get(`verify:profile:${email}`);

  if (!raw) {
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
    message: `Change the FIRST NAME / DISPLAY NAME on all your platforms to "${code}" then call confirm.`
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 3: Confirm verification
//   → scrape first/display name from each submitted platform
//   → compare (trimmed, uppercase) against the code in Redis
//   → distinguish: scraper failure (null) vs wrong name
//   → if ALL provided handles pass: save to DB, mark verified
// ─────────────────────────────────────────────────────────────
async function confirmVerification(email) {
  const raw = await redis.get(`verify:profile:${email}`);
  if (!raw) {
    const err = new Error('No pending verification found. Please submit your handles first.');
    err.statusCode = 400;
    throw err;
  }

  const { code, leetcode, codeforces, codechef, hackerrank } = JSON.parse(raw);

  logger.info(`[Verify] Starting confirmation for ${email} — code: ${code}`);
  logger.info(`[Verify] Handles: LC=${leetcode} CF=${codeforces} CC=${codechef} HR=${hackerrank}`);

  // Scrape display/first names from all 4 platforms in parallel
  const [lcName, cfName, ccName, hrName] = await Promise.all([
    leetcode   ? leetcodeScraper.getDisplayName(leetcode)       : Promise.resolve(null),
    codeforces ? codeforcesScraper.getDisplayName(codeforces)   : Promise.resolve(null),
    codechef   ? codechefScraper.getDisplayName(codechef)       : Promise.resolve(null),
    hackerrank ? hackerrankScraper.getDisplayName(hackerrank)   : Promise.resolve(null)
  ]);

  logger.info(`[Verify] Fetched names — LC:"${lcName}" CF:"${cfName}" CC:"${ccName}" HR:"${hrName}"`);

  // ── Normalise: trim whitespace, uppercase ──────────────────
  const norm = (s) => (s ? s.trim().toUpperCase() : null);

  // ── Build per-platform result ───────────────────────────────
  // Three possible states:
  //   passed  = true   → name matched
  //   passed  = false  → name was fetched but didn't match
  //   scraperError     → scraper returned null (network / profile private / unknown)
  const buildResult = (handle, rawName) => {
    if (!handle) return { handle: null, name: null, passed: true, scraperError: false }; // not submitted
    const normalised = norm(rawName);
    if (rawName === null) {
      // Scraper returned null — could be network error OR profile truly has no name set
      return {
        handle,
        name:         null,
        passed:       false,
        scraperError: true,
        hint:         `Could not fetch name from this platform. Check that the handle "${handle}" is correct and the profile is public.`
      };
    }
    return {
      handle,
      name:         rawName,
      normalised,
      // Compare the FIRST WORD only — platforms like HackerRank return "FirstName LastName"
      // and the user only changes their first name field to the code
      passed:       normalised.split(/\s+/)[0] === code,
      scraperError: false,
      hint:         normalised.split(/\s+/)[0] !== code
        ? `Found "${rawName}" — first name (first word) must be exactly "${code}".
           Make sure you set your FIRST NAME field to the code (not full name, not username).`
        : undefined
    };
  };

  const results = {
    leetcode:   buildResult(leetcode,   lcName),
    codeforces: buildResult(codeforces, cfName),
    codechef:   buildResult(codechef,   ccName),
    hackerrank: buildResult(hackerrank, hrName)
  };

  const allPassed = Object.values(results).every((r) => r.passed);

  if (!allPassed) {
    const failed = Object.entries(results)
      .filter(([, v]) => !v.passed && v.handle) // only platforms that were provided
      .map(([platform, v]) => ({
        platform,
        handle:       v.handle,
        found:        v.name,
        expected:     code,
        scraperError: v.scraperError,
        hint:         v.hint
      }));

    logger.warn(`[Verify] Failed for ${email}: ${JSON.stringify(failed)}`);

    return {
      success: false,
      message: 'Verification failed on some platforms. See "failed" array for details.',
      failed,
      results
    };
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

  logger.info(`✅ [Verify] Student ${email} successfully verified all handles`);

  // 🔄 Trigger immediate background sync so dashboard shows data right away
  // (don't await — fire-and-forget so API responds instantly)
  const handleMap = {};
  if (leetcode)   handleMap.leetcode   = leetcode;
  if (codeforces) handleMap.codeforces = codeforces;
  if (codechef)   handleMap.codechef   = codechef;
  if (hackerrank) handleMap.hackerrank = hackerrank;

  setImmediate(() => {
    syncStudent(email, handleMap)
      .then(() => logger.info(`🟢 [Verify] Background sync complete for ${email}`))
      .catch((err) => logger.warn(`⚠️ [Verify] Background sync failed for ${email}: ${err.message}`));
  });

  return {
    success: true,
    message: 'All platforms verified successfully! Your account is now verified.',
    results
  };
}

module.exports = { submitHandlers, getVerifyStatus, confirmVerification };
