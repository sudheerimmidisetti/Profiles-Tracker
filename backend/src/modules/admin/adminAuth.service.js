// src/modules/admin/adminAuth.service.js
'use strict';

const crypto    = require('crypto');
const jwt       = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { query } = require('../../config/db');
const logger    = require('../../utils/logger');

const JWT_SECRET    = process.env.JWT_SECRET;
const JWT_ADMIN_TTL = '24h';
const OTP_TTL_MS    = 10 * 60 * 1000; // 10 minutes

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp + (process.env.JWT_SECRET || '')).digest('hex');
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,   // AWS SES SMTP access key ID
      pass: process.env.SMTP_PASS,   // AWS SES SMTP secret
    },
  });
}

// The verified SES identity to send FROM (must match SES verified email/domain)
const FROM_ADDRESS = process.env.FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;

// ── OTP Request ───────────────────────────────────────────────────────────────

async function requestOtp(email) {
  const normalized = email.toLowerCase().trim();

  // Check if admin exists
  const adminRes = await query(
    'SELECT email FROM admin_users WHERE email = $1 AND is_active = TRUE',
    [normalized]
  );
  if (!adminRes.rows.length) {
    // Intentionally vague to prevent email enumeration
    throw Object.assign(new Error('If this email is registered as admin, an OTP will be sent.'), { statusCode: 200, silent: true });
  }

  const otp     = generateOtp();
  const hash    = hashOtp(otp);
  const expires = new Date(Date.now() + OTP_TTL_MS);

  // Invalidate any existing unused OTPs for this email
  await query('UPDATE admin_otps SET used = TRUE WHERE email = $1 AND used = FALSE', [normalized]);

  // Store new OTP
  await query(
    'INSERT INTO admin_otps (email, otp_hash, expires_at) VALUES ($1, $2, $3)',
    [normalized, hash, expires]
  );

  // Send email
  const transporter = getTransporter();
  await transporter.sendMail({
    from:    `"CPTrack Admin" <${FROM_ADDRESS}>`,
    to:      normalized,
    subject: '🔐 CPTrack Admin Login OTP',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <div style="max-width:420px;margin:40px auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:24px 28px;border-bottom:1px solid #222;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:#e74c3c;border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:18px;">⚙</span>
        </div>
        <div>
          <div style="color:#fff;font-weight:700;font-size:16px;">CPTrack Admin</div>
          <div style="color:#888;font-size:12px;">Login Verification</div>
        </div>
      </div>
    </div>
    <div style="padding:28px;">
      <p style="color:#ccc;font-size:14px;margin:0 0 20px;">Your one-time admin login code:</p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:20px;text-align:center;margin-bottom:20px;">
        <div style="font-size:40px;font-weight:800;letter-spacing:14px;color:#e74c3c;font-variant-numeric:tabular-nums;">${otp}</div>
      </div>
      <p style="color:#666;font-size:12px;margin:0 0 4px;">⏱ Valid for <strong style="color:#888">10 minutes</strong> only.</p>
      <p style="color:#666;font-size:12px;margin:0;">🔒 Do not share this code with anyone.</p>
    </div>
    <div style="background:#0d0d0d;padding:12px 28px;border-top:1px solid #1a1a1a;">
      <p style="color:#444;font-size:11px;margin:0;">If you didn't request this, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>
    `,
  });

  logger.info(`[AdminAuth] OTP sent to ${normalized}`);
  return { message: 'OTP sent to your email address.' };
}

// ── OTP Verify ────────────────────────────────────────────────────────────────

async function verifyOtp(email, otp) {
  const normalized = email.toLowerCase().trim();
  const hash       = hashOtp(otp.toString().trim());

  const otpRes = await query(
    `SELECT id FROM admin_otps
     WHERE email = $1 AND otp_hash = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [normalized, hash]
  );

  if (!otpRes.rows.length) {
    throw Object.assign(new Error('Invalid or expired OTP. Please request a new one.'), { statusCode: 401 });
  }

  // Mark OTP as used
  await query('UPDATE admin_otps SET used = TRUE WHERE id = $1', [otpRes.rows[0].id]);

  // Verify admin is still active (double-check)
  const adminRes = await query(
    'SELECT email FROM admin_users WHERE email = $1 AND is_active = TRUE',
    [normalized]
  );
  if (!adminRes.rows.length) {
    throw Object.assign(new Error('Admin access revoked.'), { statusCode: 403 });
  }

  // Issue JWT
  const token = jwt.sign(
    { email: normalized, role: 'admin' },
    JWT_SECRET,
    { expiresIn: JWT_ADMIN_TTL }
  );

  logger.info(`[AdminAuth] Admin logged in: ${normalized}`);
  return { token, email: normalized, expiresIn: JWT_ADMIN_TTL };
}

// ── Admin User Management ─────────────────────────────────────────────────────

async function listAdmins() {
  const res = await query(
    'SELECT email, added_by, created_at, is_active, is_system_admin FROM admin_users ORDER BY created_at ASC'
  );
  return res.rows;
}

async function addAdmin(email, addedBy) {
  const normalized = email.toLowerCase().trim();
  if (!normalized.includes('@')) {
    throw Object.assign(new Error('Invalid email address'), { statusCode: 400 });
  }
  await query(
    `INSERT INTO admin_users (email, added_by)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET is_active = TRUE, added_by = $2`,
    [normalized, addedBy]
  );
  logger.info(`[AdminAuth] Admin added: ${normalized} by ${addedBy}`);
  return { email: normalized, added_by: addedBy };
}

async function removeAdmin(email, requestedBy) {
  const normalized = email.toLowerCase().trim();
  if (normalized === requestedBy) {
    throw Object.assign(new Error('You cannot remove your own admin access.'), { statusCode: 400 });
  }

  // Check target is not a system admin
  const targetRes = await query(
    'SELECT is_system_admin, added_by FROM admin_users WHERE email = $1',
    [normalized]
  );
  if (targetRes.rows[0]?.is_system_admin) {
    throw Object.assign(
      new Error('System admins cannot be removed. Contact the development team.'),
      { statusCode: 403 }
    );
  }

  // Non-system admins can only remove someone they added (or system admins can remove anyone)
  const requesterRes = await query(
    'SELECT is_system_admin FROM admin_users WHERE email = $1',
    [requestedBy]
  );
  const requesterIsSysAdmin = requesterRes.rows[0]?.is_system_admin === true;
  const targetAddedBy = targetRes.rows[0]?.added_by;

  if (!requesterIsSysAdmin && targetAddedBy !== requestedBy) {
    throw Object.assign(
      new Error('You can only remove admins that you personally added.'),
      { statusCode: 403 }
    );
  }

  await query('UPDATE admin_users SET is_active = FALSE WHERE email = $1', [normalized]);
  logger.info(`[AdminAuth] Admin removed: ${normalized} by ${requestedBy}`);
  return { email: normalized };
}

module.exports = { requestOtp, verifyOtp, listAdmins, addAdmin, removeAdmin };
