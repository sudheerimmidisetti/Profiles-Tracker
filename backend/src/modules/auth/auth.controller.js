// src/modules/auth/auth.controller.js
const { z } = require('zod');
const authService = require('./auth.service');

const emailSchema       = z.string().email();
const otpSchema         = z.string().length(6).regex(/^\d{6}$/);
const refreshBodySchema = z.object({
  sessionId:    z.string().min(1),
  refreshToken: z.string().min(1)
});

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const email = emailSchema.parse(req.body.email?.toLowerCase().trim());
    const result = await authService.registerWithOTP(email);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-otp
async function verifyOTP(req, res, next) {
  try {
    const email = emailSchema.parse(req.body.email?.toLowerCase().trim());
    const otp   = otpSchema.parse(req.body.otp?.toString().trim());
    const result = await authService.verifyOTPAndLogin(email, otp);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
async function refresh(req, res, next) {
  try {
    const { sessionId, refreshToken } = refreshBodySchema.parse(req.body);
    const result = await authService.refreshAccessToken(sessionId, refreshToken);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    // req.user is set by authenticate middleware
    await authService.logout(req.user.sessionId);
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verifyOTP, refresh, logout };
