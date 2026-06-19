// src/utils/mailer.js
const nodemailer = require('nodemailer');
const logger     = require('./logger');

// ─────────────────────────────────────────────────────────────
// Detect if SMTP credentials are real or still placeholder/missing
// ─────────────────────────────────────────────────────────────
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const smtpReady =
  SMTP_USER &&
  SMTP_PASS &&
  !SMTP_USER.startsWith('REPLACE_') &&
  !SMTP_PASS.startsWith('REPLACE_') &&
  SMTP_USER !== 'test@ethereal.email';

// Only build transporter if credentials look real
const transporter = smtpReady
  ? nodemailer.createTransport({
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false, // STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    })
  : null;

if (!smtpReady) {
  logger.warn('⚠️  SMTP not configured — OTPs will be printed to this console (dev mode).');
  logger.warn('    Set SMTP_USER and SMTP_PASS in .env to enable real email delivery.');
}

/**
 * Send OTP email — falls back to console logging if SMTP is not configured.
 */
async function sendOTPEmail(email, otp) {
  // ── DEV FALLBACK: log OTP to terminal ──────────────────────
  if (!transporter) {
    logger.info('─────────────────────────────────────────────────');
    logger.info(`📧  OTP for ${email}`);
    logger.info(`    ┌────────────────┐`);
    logger.info(`    │   OTP: ${otp}   │`);
    logger.info(`    └────────────────┘`);
    logger.info('    (SMTP not configured — copy this code manually)');
    logger.info('─────────────────────────────────────────────────');
    return; // success — no crash
  }

  // ── PRODUCTION: send real email ────────────────────────────
  await transporter.sendMail({
    from:    `"CPTrack — ACET" <${process.env.FROM_EMAIL || SMTP_USER}>`,
    to:      email,
    subject: 'Your OTP — ACET Coding Tracker',
    html: `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;background:#0f172a;padding:40px;border-radius:16px;">
        <h2 style="color:#60a5fa;margin:0 0 8px">ACET Coding Tracker</h2>
        <p style="color:#94a3b8;margin:0 0 32px;font-size:14px">College Programming Profile Platform</p>
        <p style="color:#e2e8f0;font-size:15px">Your one-time password is:</p>
        <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:16px 0;">
          <span style="font-size:42px;font-weight:700;letter-spacing:14px;color:#38bdf8;">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;">Valid for <strong style="color:#f1f5f9;">2 minutes</strong>. Do not share this code.</p>
        <hr style="border:1px solid #1e293b;margin:24px 0;">
        <p style="color:#475569;font-size:12px;">If you did not request this, please ignore this email.</p>
      </div>
    `
  });

  logger.info(`✅  OTP email sent to ${email}`);
}

/**
 * Send contest reminder to a list of student emails.
 */
async function sendContestReminderEmail(emails, contest) {
  if (!emails.length) return;
  const platName = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef' }[contest.platform] || contest.platform;
  const startIST = new Date(contest.startTime).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric',
    month: 'short', hour: '2-digit', minute: '2-digit'
  });

  if (!transporter) {
    logger.info(`📢  Contest reminder (SMTP off): ${contest.name} at ${startIST} → ${emails.length} students`);
    return;
  }

  const subject = `🔔 Contest Starting Soon: ${contest.name}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:auto;background:#0f172a;padding:40px;border-radius:16px;">
      <h2 style="color:#818cf8;margin:0 0 4px">ACET Coding Tracker</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 28px">Contest Reminder — 1 hour to go</p>
      <div style="background:#1e293b;border-radius:14px;padding:24px;margin-bottom:20px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:8px">${platName}</div>
        <h3 style="font-size:20px;font-weight:800;color:#f1f5f9;margin:0 0 12px">${contest.name}</h3>
        <div style="color:#94a3b8;font-size:14px;margin-bottom:6px">🕐 ${startIST} IST</div>
        ${contest.durationMin ? `<div style="color:#94a3b8;font-size:14px">⏱ ${contest.durationMin} minutes</div>` : ''}
      </div>
      <a href="${contest.url}" style="display:inline-block;background:#6366f1;color:#fff;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px">Open Contest →</a>
      <p style="color:#475569;font-size:12px;margin-top:28px">You're receiving this because you're registered on the ACET Coding Tracker platform.</p>
    </div>
  `;

  // Batch send (BCC all to avoid exposing addresses)
  try {
    await transporter.sendMail({
      from:    `"CPTrack — ACET" <${process.env.FROM_EMAIL || SMTP_USER}>`,
      bcc:     emails.join(','),
      subject, html,
    });
    logger.info(`✅  Contest reminder sent: ${contest.name} → ${emails.length} students`);
  } catch (e) {
    logger.error(`❌  Contest reminder failed: ${e.message}`);
  }
}

module.exports = { sendOTPEmail, sendContestReminderEmail };
