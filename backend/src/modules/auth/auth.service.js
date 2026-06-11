// src/modules/auth/auth.service.js
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { query } = require('../../config/db');
const redis = require('../../config/redis');
const logger = require('../../utils/logger');
const { sendOTPEmail } = require('../../utils/mailer');
const {
  generateOTP,
  generateSessionId,
  generateRefreshToken,
  hashToken
} = require('../../utils/tokenGen');

// Support multiple college email domains (comma-separated in .env)
// e.g. COLLEGE_EMAIL_DOMAINS=@acet.ac.in,@aec.edu.in,@adityauniversity.in
const COLLEGE_DOMAINS = (process.env.COLLEGE_EMAIL_DOMAINS || '@acet.ac.in')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const SHORT_TTL   = parseInt(process.env.JWT_SHORT_TTL,   10) || 300;
const REFRESH_TTL = parseInt(process.env.JWT_REFRESH_TTL, 10) || 259200;

// ─────────────────────────────────────────────────────────────
// STEP 1: Register — validate college email & send OTP
// ─────────────────────────────────────────────────────────────
async function registerWithOTP(email) {
  const lowerEmail = email.toLowerCase();
  const isAllowed  = COLLEGE_DOMAINS.some((domain) => lowerEmail.endsWith(domain));

  if (!isAllowed) {
    const err = new Error(
      `Only these college email domains are allowed: ${COLLEGE_DOMAINS.join(', ')}`
    );
    err.statusCode = 400;
    throw err;
  }

  const otp = generateOTP();
  // Store as  otp:auth:<email>  with 120s TTL
  await redis.set(`otp:auth:${email}`, otp, 'EX', 120);
  await sendOTPEmail(email, otp);

  logger.info(`OTP dispatched to ${email}`);
  return { message: 'OTP sent to your college email. Valid for 2 minutes.' };
}

// ─────────────────────────────────────────────────────────────
// STEP 2: Verify OTP → fetch college data → create student → issue tokens
// ─────────────────────────────────────────────────────────────
async function verifyOTPAndLogin(email, otp) {
  // 1. Retrieve OTP from Redis
  const stored = await redis.get(`otp:auth:${email}`);
  if (!stored) {
    const err = new Error('OTP expired. Please request a new one.');
    err.statusCode = 400;
    throw err;
  }
  if (stored !== otp.toString()) {
    const err = new Error('Incorrect OTP');
    err.statusCode = 400;
    throw err;
  }

  // 2. OTP valid — delete it immediately (single-use)
  await redis.del(`otp:auth:${email}`);

  // 3. Fetch student details from college DB (or stub)
  const studentData = await fetchStudentFromCollegeDB(email);

  // 4. Upsert student row into PostgreSQL
  await query(
    `INSERT INTO students (email, full_name, roll_number, college, branch, phone, passout_year)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (email) DO UPDATE SET
       full_name    = EXCLUDED.full_name,
       roll_number  = EXCLUDED.roll_number,
       college      = EXCLUDED.college,
       branch       = EXCLUDED.branch,
       phone        = COALESCE(EXCLUDED.phone, students.phone),
       passout_year = COALESCE(EXCLUDED.passout_year, students.passout_year)`,
    [email, studentData.full_name, studentData.roll_number,
     studentData.college, studentData.branch,
     studentData.phone || null, studentData.passout_year || null]
  );

  // 5. Generate session
  const sessionId     = generateSessionId();
  const refreshToken  = generateRefreshToken();
  const refreshHash   = hashToken(refreshToken);

  // 6. Issue short-lived JWT (5 minutes)
  const accessToken = jwt.sign(
    { email, sessionId },
    process.env.JWT_SECRET,
    { expiresIn: SHORT_TTL }
  );

  // 7. Persist session in Redis
  //    jwt:short:<sessionId>   → email               (300s TTL)
  //    jwt:refresh:<sessionId> → JSON{email,hash}    (3d TTL)
  await redis.set(`jwt:short:${sessionId}`,   email,                          'EX', SHORT_TTL);
  await redis.set(`jwt:refresh:${sessionId}`, JSON.stringify({ email, hash: refreshHash }), 'EX', REFRESH_TTL);

  logger.info(`User ${email} authenticated — session ${sessionId}`);

  return { accessToken, refreshToken, sessionId, expiresIn: SHORT_TTL };
}

// ─────────────────────────────────────────────────────────────
// STEP 3: Refresh — rotate access token using refresh token
// ─────────────────────────────────────────────────────────────
async function refreshAccessToken(sessionId, refreshToken) {
  const raw = await redis.get(`jwt:refresh:${sessionId}`);
  if (!raw) {
    const err = new Error('Session expired. Please login again.');
    err.statusCode = 401;
    throw err;
  }

  const { email, hash } = JSON.parse(raw);

  if (hash !== hashToken(refreshToken)) {
    const err = new Error('Invalid refresh token');
    err.statusCode = 401;
    throw err;
  }

  // Issue new short-lived JWT
  const accessToken = jwt.sign({ email, sessionId }, process.env.JWT_SECRET, { expiresIn: SHORT_TTL });

  // Renew short-token TTL in Redis
  await redis.set(`jwt:short:${sessionId}`, email, 'EX', SHORT_TTL);

  logger.info(`Access token refreshed for session ${sessionId}`);
  return { accessToken, expiresIn: SHORT_TTL };
}

// ─────────────────────────────────────────────────────────────
// STEP 4: Logout — flush both tokens from Redis
// ─────────────────────────────────────────────────────────────
async function logout(sessionId) {
  await redis.del(`jwt:short:${sessionId}`);
  await redis.del(`jwt:refresh:${sessionId}`);
  logger.info(`Session ${sessionId} revoked`);
}

// ─────────────────────────────────────────────────────────────
// INTERNAL: Fetch student data from Maya college API
// Endpoint: GET /get-user-by-roll-no-coding-profiles/:roll_no
// Roll number comes from email prefix (e.g. 23p31a0537 → 23P31A0537)
// Per API requirement: alphabetic characters must be UPPERCASE
// ─────────────────────────────────────────────────────────────
const MAYA_API = 'https://api.maya.adityauniversity.in/node/api/get-user-by-roll-no-coding-profiles';

async function fetchStudentFromCollegeDB(email) {
  // Derive roll number from email prefix and uppercase ALL alpha chars
  // e.g. "23p31a0537@acet.ac.in" → "23P31A0537"
  const rollNumber = email.split('@')[0].replace(/[a-z]/g, c => c.toUpperCase());

  const domain = email.split('@')[1]?.toLowerCase() || '';
  const collegeMap = {
    'acet.ac.in':          'ACET',
    'aec.edu.in':          'AEC',
    'adityauniversity.in': 'Aditya University',
  };
  const collegeFallback = collegeMap[domain] || domain.split('.')[0].toUpperCase();

  try {
    const { data } = await axios.get(`${MAYA_API}/${rollNumber}`, {
      timeout: 8000,
      headers: { 'Accept': 'application/json' },
    });

    // API response: { _id, first_name, roll_no, email, college, branch: [], passout_year }
    if (!data || data.message === 'User not found') {
      throw new Error(`Roll number ${rollNumber} not found in Maya API`);
    }

    const branch = Array.isArray(data.branch)
      ? data.branch.join(', ')
      : (data.branch || 'CSE');

    logger.info(`[CollegeAPI] Fetched profile for ${rollNumber}: ${data.first_name}`);
    return {
      full_name:    data.first_name   || 'Unknown',
      roll_number:  data.roll_no      || rollNumber,
      college:      data.college      || collegeFallback,
      branch,
      passout_year: data.passout_year || null,
      phone:        null,  // Maya API doesn't return phone
    };
  } catch (err) {
    logger.warn(`[CollegeAPI] Maya API failed for ${rollNumber}: ${err.message} — using stub.`);

    // Graceful fallback: use email-derived data
    return {
      full_name:    'Update Your Name',
      roll_number:  rollNumber,
      college:      collegeFallback,
      branch:       'CSE',
      passout_year: null,
      phone:        null,
    };
  }
}


module.exports = { registerWithOTP, verifyOTPAndLogin, refreshAccessToken, logout };
