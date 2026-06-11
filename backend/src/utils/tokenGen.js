// src/utils/tokenGen.js
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a 6-digit numeric OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate an 8-character alphanumeric verification code (uppercase)
 * First character is always a LETTER (LeetCode display name cannot start with a digit)
 * e.g. "AC89X77P", "BZ3K9M2Q"
 */
function generateVerificationCode() {
  const LETTERS  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const ALPHANUM  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  // First char: letter only
  let code = LETTERS.charAt(Math.floor(Math.random() * LETTERS.length));
  // Remaining 7 chars: letters + digits
  for (let i = 1; i < 8; i++) {
    code += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length));
  }
  return code;
}

/**
 * Generate a unique session ID
 * e.g. "sess_3f2504e04f8911d3"
 */
function generateSessionId() {
  return `sess_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
}

/**
 * Generate a cryptographically secure refresh token (128 hex chars)
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Hash any string using SHA-256 (for storing refresh tokens safely)
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateOTP,
  generateVerificationCode,
  generateSessionId,
  generateRefreshToken,
  hashToken
};
