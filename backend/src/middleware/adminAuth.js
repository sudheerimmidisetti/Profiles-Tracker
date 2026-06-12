// src/middleware/adminAuth.js
// Accepts either:
//   1. JWT Bearer token  (email+OTP login)
//   2. X-Admin-Secret    (legacy env-var superuser fallback)

'use strict';

const jwt           = require('jsonwebtoken');
const { query }     = require('../config/db');

async function adminAuth(req, res, next) {
  // ── Option A: JWT Bearer token (preferred) ───────────────────────────────
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not an admin token.' });
      }
      // Verify this admin is still active in DB
      const adminRes = await query(
        'SELECT email FROM admin_users WHERE email = $1 AND is_active = TRUE',
        [payload.email]
      );
      if (!adminRes.rows.length) {
        return res.status(403).json({ success: false, message: 'Admin access revoked.' });
      }
      req.adminEmail = payload.email;
      return next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
  }

  // ── Option B: Legacy X-Admin-Secret header (superuser fallback) ──────────
  const secret = req.headers['x-admin-secret'];
  if (secret && process.env.ADMIN_SECRET && secret === process.env.ADMIN_SECRET) {
    req.adminEmail = 'superuser';
    return next();
  }

  return res.status(403).json({ success: false, message: 'Forbidden: Admin access only.' });
}

module.exports = adminAuth;
