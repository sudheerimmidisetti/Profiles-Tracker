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
    `INSERT INTO students (email, full_name, roll_number, college, branch, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE SET
       full_name    = EXCLUDED.full_name,
       roll_number  = EXCLUDED.roll_number,
       college      = EXCLUDED.college,
       branch       = EXCLUDED.branch,
       phone        = EXCLUDED.phone`,
    [email, studentData.full_name, studentData.roll_number,
     studentData.college, studentData.branch, studentData.phone]
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
// INTERNAL: Fetch student data from college DB
// ─────────────────────────────────────────────────────────────
async function fetchStudentFromCollegeDB(email) {
  const apiUrl = process.env.COLLEGE_DB_API_URL;

  if (apiUrl) {
    try {
      const { data } = await axios.get(`${apiUrl}/${encodeURIComponent(email)}`, {
        headers: { 'X-API-Key': process.env.COLLEGE_DB_API_KEY || '' },
        timeout: 6000
      });
      // Expected shape: { full_name, roll_number, college, branch, phone }
      return data;
    } catch (err) {
      logger.warn(`College DB API failed for ${email}: ${err.message}. Using stub.`);
    }
  }

  // Stub: derive roll number from email prefix
  const rollNumber = email.split('@')[0].toUpperCase();
  logger.warn(`COLLEGE_DB_API_URL not set — stub data used for ${email}`);
  return {
    full_name:   'Update Your Name',
    roll_number: rollNumber,
    college:     'ACET',
    branch:      'CSE',
    phone:       '0000000000'
  };
}

module.exports = { registerWithOTP, verifyOTPAndLogin, refreshAccessToken, logout };
