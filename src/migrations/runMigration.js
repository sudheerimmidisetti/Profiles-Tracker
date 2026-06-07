// src/migrations/runMigration.js
// Usage: node src/migrations/runMigration.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, '001_initial_schema.sql'),
    'utf-8'
  );
  try {
    await pool.query(sql);
    console.log('✅  Migration applied successfully.');
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
