// src/migrations/runMigration.js
// Idempotent migration runner: applies all pending *.sql files in numeric order.
// Tracks applied migrations in schema_migrations table (auto-created).
// Usage:  node src/migrations/runMigration.js
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS_DIR = __dirname;

async function run() {
  const client = await pool.connect();
  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(255) PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Load already-applied migrations
    const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version');
    const applied = new Set(rows.map(r => r.version));

    // Collect and sort all *.sql files numerically
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ⏩ skip   ${file}  (already applied)`);
        skippedCount++;
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`  🔧 apply  ${file} …`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`  ✅ done   ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ FAILED ${file}: ${err.message}`);
        process.exit(1);
      }
    }

    console.log(`\nMigrations: ${appliedCount} applied, ${skippedCount} already up-to-date.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration runner error:', err.message);
  process.exit(1);
});
