// src/modules/auth/auth.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./auth.controller');

const router = Router();

// Public routes
router.post('/register',    ctrl.register);    // Send OTP
router.post('/verify-otp',  ctrl.verifyOTP);   // Verify OTP → issue tokens
router.post('/refresh',     ctrl.refresh);     // Rotate access token

// Protected route (must be logged in to logout)
router.post('/logout', authenticate, ctrl.logout);

module.exports = router;
