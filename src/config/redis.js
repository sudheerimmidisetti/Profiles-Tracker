// src/config/redis.js
const Redis = require('ioredis');
const logger = require('../utils/logger');

const redis = new Redis(process.env.REDIS_URL, {
  // Exponential back-off reconnect strategy (max 2s wait)
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

redis.on('connect',      ()    => logger.info('Redis connected'));
redis.on('ready',        ()    => logger.info('Redis ready'));
redis.on('error',        (err) => logger.error('Redis error', { message: err.message }));
redis.on('reconnecting', ()    => logger.warn('Redis reconnecting...'));
redis.on('close',        ()    => logger.warn('Redis connection closed'));

module.exports = redis;
