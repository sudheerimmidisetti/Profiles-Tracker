// src/modules/leaderboard/leaderboard.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('./leaderboard.controller');
const authenticate = require('../../middleware/authenticate');

// ── New typed leaderboards (no auth required — publicly readable) ──────────────
// NOTE: These specific routes MUST come before the /:platform wildcard route.
router.get('/placements', ctrl.getPlacementsLeaderboard);
router.get('/overall',    ctrl.getOverallLeaderboard);    // all-time, same metrics as placements
router.get('/weekly',     ctrl.getWeeklyLeaderboard);
router.get('/monthly',    ctrl.getMonthlyLeaderboard);


// ── Original platform leaderboard ─────────────────────────────────────────────
// GET /api/leaderboard/:platform?filter=all|contest|consistency|problems&page=1
router.get('/:platform', authenticate, ctrl.getLeaderboard);

module.exports = router;
