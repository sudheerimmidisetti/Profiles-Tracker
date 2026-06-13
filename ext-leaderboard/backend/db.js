// db.js
// Flat-file JSON "database" — persists fetched profile data so
// re-running sync doesn't re-fetch already-scraped students.
'use strict';

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

let _db = null;

function load() {
  if (_db) return _db;
  if (fs.existsSync(DB_PATH)) {
    try {
      _db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
      _db = { students: {}, synced_at: null, total: 0, done: 0 };
    }
  } else {
    _db = { students: {}, synced_at: null, total: 0, done: 0 };
  }
  return _db;
}

function save() {
  if (!_db) return;
  fs.writeFileSync(DB_PATH, JSON.stringify(_db, null, 2));
}

function getStudent(student_id) {
  return load().students[student_id] || null;
}

function setStudent(student_id, data) {
  const db = load();
  db.students[student_id] = { ...data, updated_at: new Date().toISOString() };
  db.done = Object.keys(db.students).length;
  // Batch writes: flush to disk every 10 students to reduce I/O
  // (sync.js should also call save() at the end to flush the remainder)
  if (db.done % 10 === 0) save();
}

function getAll() {
  return Object.values(load().students);
}

function getProgress() {
  const db = load();
  return { total: db.total, done: db.done, synced_at: db.synced_at };
}

function setTotal(n) {
  const db = load();
  db.total = n;
  save();
}

function setDone(n, timestamp) {
  const db = load();
  db.done = n;
  if (timestamp) db.synced_at = timestamp;
  save();
}

module.exports = { load, save, getStudent, setStudent, getAll, getProgress, setTotal, setDone };
