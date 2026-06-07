// src/utils/mailer.js
const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send OTP email for registration
 */
async function sendOTPEmail(email, otp) {
  await transporter.sendMail({
    from: `"ACET Coding Tracker" <${process.env.FROM_EMAIL}>`,
    to: email,
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
  logger.info(`OTP email sent to ${email}`);
}

module.exports = { sendOTPEmail };
