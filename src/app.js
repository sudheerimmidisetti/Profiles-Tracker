// src/app.js
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes        = require('./modules/auth/auth.routes');
const profileRoutes     = require('./modules/profile/profile.routes');
const handlersRoutes    = require('./modules/handlers/handlers.routes');
const leaderboardRoutes = require('./modules/leaderboard/leaderboard.routes');
const analyticsRoutes   = require('./modules/analytics/analytics.routes');
const adminRoutes       = require('./modules/admin/admin.routes');
const errorHandler      = require('./middleware/errorHandler');

const app = express();

// ─────────────────────────────────────────────────────────────
// Security & Utility Middleware
// ─────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─────────────────────────────────────────────────────────────
// Global Rate Limiting
// ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '100',    10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use(limiter);

// Stricter limit on auth routes (prevent OTP brute force)
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 10,
  message: { success: false, message: 'Too many auth attempts. Please wait 10 minutes.' }
});
app.use('/api/auth', authLimiter);

// ─────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'ACET Coding Tracker API is running 🚀', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/profile',     profileRoutes);
app.use('/api/handlers',    handlersRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/analytics',   analyticsRoutes);
app.use('/api/admin',       adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ─────────────────────────────────────────────────────────────
// Global Error Handler (must be last)
// ─────────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
