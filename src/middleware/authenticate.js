// src/middleware/authenticate.js
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Protect routes — verifies JWT and confirms session still active in Redis.
 * Attaches { email, sessionId } to req.user on success.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // 1. Verify JWT signature + expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired. Please refresh.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const { email, sessionId } = decoded;

    // 2. Confirm session whitelist in Redis: jwt:short:<sessionId> → email
    const storedEmail = await redis.get(`jwt:short:${sessionId}`);
    if (!storedEmail || storedEmail !== email) {
      return res.status(401).json({ success: false, message: 'Session expired or revoked. Please login again.' });
    }

    req.user = { email, sessionId };
    next();
  } catch (err) {
    logger.error('Authentication middleware error', { message: err.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

module.exports = authenticate;
