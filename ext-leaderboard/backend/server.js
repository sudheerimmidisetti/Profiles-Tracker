// server.js
// Express API for the external leaderboard.
// Completely standalone — no connection to main project.
'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { computeScore } = require('./scoring/placements');
const db               = require('./db');
const { parseOds }     = require('./parse-ods');
const { fetchLCProfile } = require('./scrapers/lc');
const { fetchCCProfile } = require('./scrapers/cc');
const { fetchHRProfile } = require('./scrapers/hr');

const app  = express();
const PORT = process.env.PORT || 4500;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── GET /api/leaderboard ──────────────────────────────────────────────────────
// Returns the ranked leaderboard from cached db.json
app.get('/api/leaderboard', (req, res) => {
  const { search = '', sort = 'total_score', order = 'desc', page = '1', limit = '50' } = req.query;

  let data = db.getAll();

  // Filter out students with no data yet
  data = data.filter(s => s.total_score !== undefined);

  // Search
  if (search) {
    const q = search.toLowerCase();
    data = data.filter(s =>
      (s.student_id || '').toLowerCase().includes(q) ||
      (s.lc_handle  || '').toLowerCase().includes(q) ||
      (s.cc_handle  || '').toLowerCase().includes(q) ||
      (s.hr_handle  || '').toLowerCase().includes(q)
    );
  }

  // Sort
  const validSorts = ['total_score', 'lc_score', 'cc_score', 'hr_score',
                      'lc_detail.total_solved', 'cc_detail.problems_solved',
                      'lc_detail.contest_rating', 'cc_detail.current_rating'];
  const sortKey = validSorts.includes(sort) ? sort : 'total_score';
  const asc     = order === 'asc';

  data.sort((a, b) => {
    const getVal = (obj, key) => {
      if (key.includes('.')) {
        const [k1, k2] = key.split('.');
        return obj[k1]?.[k2] ?? 0;
      }
      return obj[key] ?? 0;
    };
    const av = getVal(a, sortKey);
    const bv = getVal(b, sortKey);
    return asc ? av - bv : bv - av;
  });

  // Add rank
  data.forEach((s, i) => { s.rank = i + 1; });

  // Paginate
  const pageNum  = parseInt(page, 10)  || 1;
  const limitNum = parseInt(limit, 10) || 50;
  const total    = data.length;
  const paginated = data.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({ total, page: pageNum, limit: limitNum, data: paginated });
});

// ── GET /api/progress ─────────────────────────────────────────────────────────
app.get('/api/progress', (req, res) => {
  res.json(db.getProgress());
});

// ── GET /api/stats ─────────────────────────────────────────────────────────────
// Returns true global statistics over ALL scored students (not page-scoped)
app.get('/api/stats', (req, res) => {
  const all = db.getAll().filter(s => s.total_score !== undefined);
  if (all.length === 0) return res.json({ total: 0, avg: 0, top: 0, median: 0 });

  const scores = all.map(s => s.total_score || 0).sort((a, b) => b - a);
  const sum    = scores.reduce((a, b) => a + b, 0);
  const mid    = Math.floor(scores.length / 2);
  const median = scores.length % 2 === 0
    ? (scores[mid - 1] + scores[mid]) / 2
    : scores[mid];

  res.json({
    total:  all.length,
    top:    +(scores[0]).toFixed(2),
    avg:    +(sum / scores.length).toFixed(2),
    median: +median.toFixed(2),
  });
});

// ── GET /api/export ───────────────────────────────────────────────────────────
// Returns CSV of all scored students
app.get('/api/export', (req, res) => {
  let data = db.getAll().filter(s => s.total_score !== undefined);
  data.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
  data.forEach((s, i) => { s.rank = i + 1; });

  const headers = [
    'Rank', 'Student ID',
    'LC Handle', 'CC Handle', 'HR Handle',
    'Total Score (100)',
    'LC Score (40)', 'LC Problem (20)', 'LC Contest (20)',
    'CC Score (40)', 'CC Problem (20)', 'CC Contest (20)',
    'HR Score (20)',
    'LC Easy Solved', 'LC Medium Solved', 'LC Hard Solved', 'LC Total Solved',
    'LC Contest Rating', 'LC Contest Count',
    'CC Problems Solved', 'CC Rating', 'CC Stars', 'CC Contest Count',
    'HR PS Stars', 'HR SQL Stars', 'HR Java Stars', 'HR Python Stars',
  ];

  const rows = data.map(s => [
    s.rank,
    s.student_id,
    s.lc_handle || '',
    s.cc_handle || '',
    s.hr_handle || '',
    s.total_score?.toFixed(2) || '0',
    s.lc_score?.toFixed(2)    || '0',
    s.lc_prob?.toFixed(2)     || '0',
    s.lc_contest?.toFixed(2)  || '0',
    s.cc_score?.toFixed(2)    || '0',
    s.cc_prob?.toFixed(2)     || '0',
    s.cc_contest?.toFixed(2)  || '0',
    s.hr_score?.toFixed(2)    || '0',
    s.lc_detail?.easy_solved   || 0,
    s.lc_detail?.medium_solved || 0,
    s.lc_detail?.hard_solved   || 0,
    s.lc_detail?.total_solved  || 0,
    s.lc_detail?.contest_rating || 0,
    s.lc_detail?.contest_count  || 0,
    s.cc_detail?.problems_solved || 0,
    s.cc_detail?.current_rating  || 0,
    s.cc_detail?.stars           || 0,
    s.cc_detail?.contest_count   || 0,
    s.hr_detail?.psStars  || 0,
    s.hr_detail?.sqlStars || 0,
    s.hr_detail?.javStars || 0,
    s.hr_detail?.pytStars || 0,
  ]);

  const csvStr = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ext_placements_leaderboard_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csvStr);
});

// ── POST /api/sync-one ────────────────────────────────────────────────────────
// Sync a single student on demand (for quick testing)
app.post('/api/sync-one', async (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });

  const students = parseOds();
  const s = students.find(x => x.student_id === student_id);
  if (!s) return res.status(404).json({ error: 'Student not found in ODS' });

  try {
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // Sequential fetches with delays to avoid rate limiting (especially HR)
    const lc_data = s.lc_handle ? await fetchLCProfile(s.lc_handle) : null;
    await delay(600);
    const cc_data = s.cc_handle ? await fetchCCProfile(s.cc_handle) : null;
    await delay(600);
    const hr_data = s.hr_handle ? await fetchHRProfile(s.hr_handle) : null;

    const scored = computeScore({ ...s, lc_data, cc_data, hr_data });
    db.setStudent(student_id, { ...s, lc_data, cc_data, hr_data, ...scored });

    res.json({ success: true, data: db.getStudent(student_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/student/:id ──────────────────────────────────────────────────────
app.get('/api/student/:id', (req, res) => {
  const s = db.getStudent(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

// ── Serve frontend ────────────────────────────────────────────────────────────
// Return JSON 404 for unmatched /api/* routes (avoids returning HTML for misspelled API paths)
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} /api${req.path}` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 External Leaderboard running at http://localhost:${PORT}`);
  console.log(`   API:  http://localhost:${PORT}/api/leaderboard`);
  console.log(`   Export CSV: http://localhost:${PORT}/api/export\n`);
});
