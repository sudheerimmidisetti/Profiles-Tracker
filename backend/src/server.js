// src/server.js
require('dotenv').config();
const app    = require('./app');
const logger = require('./utils/logger');
const { pool } = require('./config/db');
const redis  = require('./config/redis');
const { startSyncJob } = require('./jobs/syncProfiles.job');

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    // 1. Test PostgreSQL connection
    await pool.query('SELECT 1');
    logger.info('✅  PostgreSQL connected');

    // 2. Test Redis connection
    await redis.ping();
    logger.info('✅  Redis connected');

    // 3. Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀  ACET Coding Tracker API running on http://localhost:${PORT}`);
      logger.info(`    Environment : ${process.env.NODE_ENV || 'development'}`);
      logger.info('');
      logger.info('  API Endpoints:');
      logger.info('    POST  /api/auth/register');
      logger.info('    POST  /api/auth/verify-otp');
      logger.info('    POST  /api/auth/refresh');
      logger.info('    POST  /api/auth/logout');
      logger.info('    GET   /api/profile/me');
      logger.info('    POST  /api/handlers/submit');
      logger.info('    GET   /api/handlers/verify-status');
      logger.info('    POST  /api/handlers/confirm');
      logger.info('    GET   /api/leaderboard/:platform?filter=all|contest|consistency|problems');
      logger.info('    GET   /api/analytics/snapshot/:email');
      logger.info('    GET   /api/analytics/summary/:email');
      logger.info('    GET   /api/admin/students');
      logger.info('    PUT   /api/admin/blocklist/:email');
      logger.info('    PUT   /api/admin/unblocklist/:email');
    });

    // 4. Start nightly sync cron job
    startSyncJob();
  } catch (err) {
    logger.error('❌  Failed to start server', { message: err.message, stack: err.stack });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  await pool.end();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  await pool.end();
  await redis.quit();
  process.exit(0);
});

startServer();
