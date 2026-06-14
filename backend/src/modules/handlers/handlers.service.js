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
//   IF student is NOT yet verified → existing code-verification flow
//   IF student IS already verified  → create handle_update_request for admin
// ─────────────────────────────────────────────────────────────
async function submitHandlers(email, { leetcode, codeforces, codechef, hackerrank }) {
  // Check if already verified
  const studentRes = await query(
    'SELECT is_verified FROM students WHERE email = $1',
    [email]
  );
  const isVerified = studentRes.rows[0]?.is_verified || false;

  const platforms = [
    { name: 'leetcode',   handle: leetcode   },
    { name: 'codeforces', handle: codeforces },
    { name: 'codechef',   handle: codechef   },
    { name: 'hackerrank', handle: hackerrank },
  ];

  // Validate: no handle claimed by another student
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

  // ── Path A: Already verified → create admin-approval request ───────────────
  if (isVerified) {
    // Check for an existing pending request
    const existingRes = await query(
      `SELECT id FROM handle_update_requests WHERE student_email = $1 AND status = 'pending'`,
      [email]
    );
    if (existingRes.rows.length > 0) {
      const err = new Error('You already have a pending handle update request. Please wait for admin to review it.');
      err.statusCode = 409;
      throw err;
    }

    // Fetch current handles for snapshot
    const currentRes = await query(
      `SELECT platform_name, username FROM platform_profiles WHERE student_email = $1`,
      [email]
    );
    const current = {};
    for (const r of currentRes.rows) current[r.platform_name] = r.username;

    await query(
      `INSERT INTO handle_update_requests
         (student_email, lc_handle, cf_handle, cc_handle, hr_handle,
          lc_handle_old, cf_handle_old, cc_handle_old, hr_handle_old)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        email,
        leetcode   || null, codeforces || null, codechef || null, hackerrank || null,
        current.leetcode   || null, current.codeforces || null,
        current.codechef   || null, current.hackerrank || null,
      ]
    );

    logger.info(`[Handlers] Handle update request created for ${email}`);

    return {
      type:    'request',
      message: 'Your handle update request has been submitted. An admin will review and approve it. Your current handles remain active until then.',
    };
  }

  // ── Path B: Not yet verified → existing code-verification flow ──────────────
  const code = generateVerificationCode();
  const payload = JSON.stringify({ code, leetcode, codeforces, codechef, hackerrank });
  await redis.set(`verify:profile:${email}`, payload, 'EX', VERIFY_TTL);

  logger.info(`Verification code generated for ${email}: ${code}`);

  return {
    type: 'verify',
    code,
    message:
      'Set this exact code as the FIRST NAME / DISPLAY NAME on each platform you submitted, ' +
      'then call POST /api/handlers/confirm. Code expires in 24 hours.',
    instructions: {
      leetcode:   leetcode   ? `Go to leetcode.com → Profile → Edit → set Name field to "${code}"` : null,
      codeforces: codeforces ? `Go to codeforces.com → Settings → set First name to "${code}"` : null,
      codechef:   codechef   ? `Go to codechef.com → Edit Profile → set First Name to "${code}"` : null,
      hackerrank: hackerrank ? `Go to hackerrank.com → Edit Profile → set Full Name to "${code}"` : null,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Get current verification status (first-time flow)
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
        : 'No active verification. Submit handlers first.',
    };
  }

  const { code, leetcode, codeforces, codechef, hackerrank } = JSON.parse(raw);
  return {
    pendingVerification: true,
    isVerified: false,
    code,
    handles: { leetcode, codeforces, codechef, hackerrank },
    message: `Change the FIRST NAME / DISPLAY NAME on all your platforms to "${code}" then call confirm.`,
  };
}

// ─────────────────────────────────────────────────────────────
// Get handle update request status (for verified students)
// ─────────────────────────────────────────────────────────────
async function getHandleRequestStatus(email) {
  const res = await query(
    `SELECT id, status, requested_at, reviewed_at, reject_reason,
            lc_handle, cf_handle, cc_handle, hr_handle,
            lc_handle_old, cf_handle_old, cc_handle_old, hr_handle_old
     FROM handle_update_requests
     WHERE student_email = $1
     ORDER BY requested_at DESC
     LIMIT 5`,
    [email]
  );

  // Also get current handles from platform_profiles
  const currentRes = await query(
    `SELECT platform_name, username FROM platform_profiles WHERE student_email = $1`,
    [email]
  );
  const current = {};
  for (const r of currentRes.rows) current[r.platform_name] = r.username;

  return {
    requests: res.rows,
    currentHandles: {
      leetcode:   current.leetcode   || null,
      codeforces: current.codeforces || null,
      codechef:   current.codechef   || null,
      hackerrank: current.hackerrank || null,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Confirm verification (first-time flow only)
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

  const [lcName, cfName, ccName, hrName] = await Promise.all([
    leetcode   ? leetcodeScraper.getDisplayName(leetcode)     : Promise.resolve(null),
    codeforces ? codeforcesScraper.getDisplayName(codeforces) : Promise.resolve(null),
    codechef   ? codechefScraper.getDisplayName(codechef)     : Promise.resolve(null),
    hackerrank ? hackerrankScraper.getDisplayName(hackerrank) : Promise.resolve(null),
  ]);

  logger.info(`[Verify] Fetched names — LC:"${lcName}" CF:"${cfName}" CC:"${ccName}" HR:"${hrName}"`);

  const norm = (s) => (s ? s.trim().toUpperCase() : null);

  const buildResult = (handle, rawName) => {
    if (!handle) return { handle: null, name: null, passed: true, scraperError: false };
    const normalised = norm(rawName);
    if (rawName === null) {
      return {
        handle,
        name:         null,
        passed:       false,
        scraperError: true,
        hint:         `Could not fetch name from this platform. Check that the handle "${handle}" is correct and the profile is public.`,
      };
    }
    return {
      handle,
      name:         rawName,
      normalised,
      passed:       normalised.split(/\s+/)[0] === code,
      scraperError: false,
      hint:         normalised.split(/\s+/)[0] !== code
        ? `Found "${rawName}" — first name (first word) must be exactly "${code}". Make sure you set your FIRST NAME field to the code (not full name, not username).`
        : undefined,
    };
  };

  const results = {
    leetcode:   buildResult(leetcode,   lcName),
    codeforces: buildResult(codeforces, cfName),
    codechef:   buildResult(codechef,   ccName),
    hackerrank: buildResult(hackerrank, hrName),
  };

  const allPassed = Object.values(results).every((r) => r.passed || r.scraperError);

  if (!allPassed) {
    const failed = Object.entries(results)
      .filter(([, v]) => !v.passed && !v.scraperError && v.handle)
      .map(([platform, v]) => ({
        platform,
        handle:       v.handle,
        found:        v.name,
        expected:     code,
        scraperError: v.scraperError,
        hint:         v.hint,
      }));

    logger.warn(`[Verify] Failed for ${email}: ${JSON.stringify(failed)}`);

    return {
      success: false,
      message: 'Verification failed on some platforms. See "failed" array for details.',
      failed,
      results,
    };
  }

  // ✅ All passed — flush Redis, save to DB, mark verified
  await redis.del(`verify:profile:${email}`);

  const platformData = [
    { name: 'leetcode',   handle: leetcode   },
    { name: 'codeforces', handle: codeforces },
    { name: 'codechef',   handle: codechef   },
    { name: 'hackerrank', handle: hackerrank },
  ].filter((p) => p.handle);

  for (const { name, handle } of platformData) {
    await query(
      `INSERT INTO platform_profiles (student_email, platform_name, username)
       VALUES ($1, $2, $3)
       ON CONFLICT (student_email, platform_name) DO UPDATE SET username = EXCLUDED.username`,
      [email, name, handle]
    );
  }

  await query('UPDATE students SET is_verified = TRUE WHERE email = $1', [email]);

  logger.info(`✅ [Verify] Student ${email} successfully verified all handles`);

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
    results,
  };
}

module.exports = { submitHandlers, getVerifyStatus, getHandleRequestStatus, confirmVerification };
