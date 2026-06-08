// src/config/db.js
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // max pool size
  idleTimeoutMillis: 30000,     // close idle clients after 30s
  connectionTimeoutMillis: 5000 // fail fast if can't connect in 5s
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { message: err.message });
});

/**
 * Execute a parameterised query
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - start;
  logger.debug('DB query', { ms, rows: res.rowCount, text: text.slice(0, 80) });
  return res;
}

/**
 * Acquire a single client (for transactions)
 */
async function getClient() {
  return pool.connect();
}

module.exports = { pool, query, getClient };
