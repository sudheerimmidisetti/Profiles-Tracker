// backend/src/modules/contests/contests.routes.js
'use strict';

const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const adminAuth    = require('../../middleware/adminAuth');
const {
  listContests,
  getContestParticipants,
  fetchContestCalendar,
} = require('./contests.service');

const router = Router();

// ─── PUBLIC routes (no auth) ──────────────────────────────────────────────────

/**
 * GET /api/contests/calendar
 * 4-week upcoming contest calendar for all platforms
 */
router.get('/calendar', async (req, res, next) => {
  try {
    const weeks = parseInt(req.query.weeks || '4', 10);
    const data  = await fetchContestCalendar(weeks);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /api/contests/public?platform=all&week=0
 * Same as student route but no auth required (for public shareable pages)
 */
router.get('/public', async (req, res, next) => {
  try {
    const platform   = (req.query.platform || 'all').toLowerCase();
    const weekOffset = parseInt(req.query.week || '0', 10);
    const data = await listContests({ platform, weekOffset });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/**
 * GET /api/contests/public/:platform/:contestId/participants
 */
router.get('/public/:platform/:contestId/participants', async (req, res, next) => {
  try {
    const { platform, contestId } = req.params;
    const cohortId = req.query.cohort ? parseInt(req.query.cohort, 10) : null;
    const data = await getContestParticipants(platform.toLowerCase(), contestId, cohortId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Student-facing routes (student JWT) ─────────────────────────────────────

/**
 * GET /api/contests?platform=all&week=0
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
    const cohortId = req.query.cohort ? parseInt(req.query.cohort, 10) : null;
    const data = await getContestParticipants(platform.toLowerCase(), contestId, cohortId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ─── Admin-facing routes (admin JWT) ─────────────────────────────────────────

/**
 * GET /api/contests/admin?platform=all&week=0
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
 * GET /api/contests/admin/:platform/:contestId/participants?cohort=<id>
 */
router.get('/admin/:platform/:contestId/participants', adminAuth, async (req, res, next) => {
  try {
    const { platform, contestId } = req.params;
    const cohortId = req.query.cohort ? parseInt(req.query.cohort, 10) : null;
    const data = await getContestParticipants(platform.toLowerCase(), contestId, cohortId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

module.exports = router;
