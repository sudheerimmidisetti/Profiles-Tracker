// src/utils/syncState.js
// Shared in-memory sync state for progress tracking.
// Single-process safe (no Redis needed for single EC2 instance).

'use strict';

let _state = {
  running:   false,
  startedAt: null,
  total:     0,
  processed: 0,
  succeeded: 0,
  failed:    0,
  currentStudent: null,
  logs:      [],     // last 200 log lines
  finishedAt: null,
  error:     null,
};

const MAX_LOGS = 200;

function getState() {
  return { ..._state, logs: [..._state.logs] };
}

function start(total) {
  _state = {
    running:        true,
    startedAt:      new Date().toISOString(),
    total:          total || 0,
    processed:      0,
    succeeded:      0,
    failed:         0,
    currentStudent: null,
    logs:           [`[${ts()}] Sync started — ${total || '?'} students queued`],
    finishedAt:     null,
    error:          null,
  };
}

function progress(email, status, message) {
  if (status === 'start') {
    _state.currentStudent = email;
  } else if (status === 'ok') {
    _state.processed++;
    _state.succeeded++;
    _state.currentStudent = null;
  } else if (status === 'err') {
    _state.processed++;
    _state.failed++;
    _state.currentStudent = null;
  }
  const line = `[${ts()}] ${email ? `[${email}] ` : ''}${message}`;
  _state.logs.push(line);
  if (_state.logs.length > MAX_LOGS) _state.logs.shift();
}

function finish(error = null) {
  _state.running        = false;
  _state.finishedAt     = new Date().toISOString();
  _state.currentStudent = null;
  _state.error          = error || null;
  const msg = error
    ? `Sync finished with error: ${error}`
    : `Sync complete — ${_state.succeeded} succeeded, ${_state.failed} failed`;
  _state.logs.push(`[${ts()}] ${msg}`);
  if (_state.logs.length > MAX_LOGS) _state.logs.shift();
}

function ts() {
  return new Date().toTimeString().slice(0, 8);
}

module.exports = { getState, start, progress, finish };
