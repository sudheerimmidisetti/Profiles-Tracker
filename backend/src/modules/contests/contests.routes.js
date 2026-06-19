// backend/src/modules/contests/contests.routes.js
'use strict';

const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const adminAuth    = require('../../middleware/adminAuth');
const { listContests, getContestParticipants } = require('./contests.service');

const router = Router();

// ─── Student-facing routes (student JWT) ─────────────────────────────────────

/**
 * GET /api/contests?platform=all&week=0
 * week=0 → current Mon–Sun, week=-1 → last week, etc.
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const platform   = (req.query.platform || 'all').toLowerCase();
    const weekOffset = parseInt(req.query.week || '0', 10);
    const data = await listContests({ platform, weekOffset });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /api/contests/:platform/:contestId/participants
 */
router.get('/:platform/:contestId/participants', authenticate, async (req, res, next) => {
  try {
    const { platform, contestId } = req.params;
    const data = await getContestParticipants(platform.toLowerCase(), contestId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Admin-facing routes (admin JWT) — same logic but separate auth ──────────

/**
 * GET /api/admin-contests?platform=all&week=0
 */
router.get('/admin', adminAuth, async (req, res, next) => {
  try {
    const platform   = (req.query.platform || 'all').toLowerCase();
    const weekOffset = parseInt(req.query.week || '0', 10);
    const data = await listContests({ platform, weekOffset });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /api/contests/admin/:platform/:contestId/participants
 */
router.get('/admin/:platform/:contestId/participants', adminAuth, async (req, res, next) => {
  try {
    const { platform, contestId } = req.params;
    const data = await getContestParticipants(platform.toLowerCase(), contestId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
