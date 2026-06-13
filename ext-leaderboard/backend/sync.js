// sync.js
// CLI script to fetch all 670 students from LC / CC / HR APIs.
// Saves to db.json. Safe to re-run — skips already-fetched students.
//
// Usage:
//   node sync.js             # sync all missing students
//   node sync.js --refetch   # refetch everyone (ignore cache)
//   node sync.js --limit 10  # only sync first 10 (for testing)

'use strict';

const { parseOds }      = require('./parse-ods');
const { fetchLCProfile } = require('./scrapers/lc');
const { fetchCCProfile } = require('./scrapers/cc');
const { fetchHRProfile } = require('./scrapers/hr');
const { computeScore }  = require('./scoring/placements');
const db                = require('./db');

const DELAY_MS   = 1200;  // delay between students to avoid rate limiting
const DELAY_PLAT = 600;   // delay between platforms per student

const args   = process.argv.slice(2);
const REFETCH = args.includes('--refetch');
const limitIdx = args.indexOf('--limit');
const LIMIT  = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function pad(n, w) { return String(n).padStart(w, ' '); }

async function syncAll() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   External Placements Leaderboard — Data Sync   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const students = parseOds().slice(0, LIMIT);
  db.setTotal(students.length);
  console.log(`📋 Total students in ODS: ${students.length}`);
  console.log(`   Mode: ${REFETCH ? 'REFETCH ALL' : 'SKIP already-fetched'}\n`);

  let done = 0, skipped = 0, errors = 0;

  for (const s of students) {
    const existing = db.getStudent(s.student_id);
    if (existing && !REFETCH) {
      skipped++;
      done++;
      process.stdout.write(`\r⏭  [${pad(done, 3)}/${students.length}] Skip: ${s.student_id}          `);
      continue;
    }

    process.stdout.write(`\n🔄 [${pad(done+1, 3)}/${students.length}] ${s.student_id}`);

    let lc_data = null, cc_data = null, hr_data = null;

    // Fetch LC
    if (s.lc_handle) {
      process.stdout.write(` | LC:${s.lc_handle}`);
      lc_data = await fetchLCProfile(s.lc_handle);
      if (!lc_data) { process.stdout.write('❌'); errors++; }
      else process.stdout.write('✅');
      await sleep(DELAY_PLAT);
    }

    // Fetch CC
    if (s.cc_handle) {
      process.stdout.write(` | CC:${s.cc_handle}`);
      cc_data = await fetchCCProfile(s.cc_handle);
      if (!cc_data) { process.stdout.write('❌'); errors++; }
      else process.stdout.write('✅');
      await sleep(DELAY_PLAT);
    }

    // Fetch HR
    if (s.hr_handle) {
      process.stdout.write(` | HR:${s.hr_handle}`);
      hr_data = await fetchHRProfile(s.hr_handle);
      if (!hr_data) { process.stdout.write('❌'); errors++; }
      else process.stdout.write('✅');
    }

    // Compute score + save
    const scored = computeScore({ ...s, lc_data, cc_data, hr_data });
    db.setStudent(s.student_id, {
      ...s,
      lc_data,
      cc_data,
      hr_data,
      ...scored,
    });

    done++;
    await sleep(DELAY_MS);
  }

  db.setDone(done, new Date().toISOString());

  console.log('\n\n═══════════════════════════════════════');
  console.log(`✅ Sync complete!`);
  console.log(`   Fetched: ${done - skipped} | Skipped: ${skipped} | Errors: ${errors}`);
  console.log(`   Saved to db.json`);
  console.log('═══════════════════════════════════════\n');
}

syncAll().catch(e => { console.error('\n❌ Fatal:', e.message); process.exit(1); });
