// src/modules/admin/admin.controller.js
const adminService        = require('./admin.service');
const analyticsService    = require('../analytics/analytics.service');
const { syncAllStudents } = require('../../jobs/syncProfiles.job');
const { query }           = require('../../config/db');
const logger              = require('../../utils/logger');
const syncState           = require('../../utils/syncState');
const {
  getCodeforcesDetail,
  getCodechefDetail,
  getLeetcodeDetail,
} = require('../contest/contest.service');

// GET /api/admin/students?page=1&limit=50&verified=true&blocklisted=false&search=&branch=CSE
async function listStudents(req, res, next) {
  try {
    const page        = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit       = Math.min(200, parseInt(req.query.limit || '50', 10));
    const verified    = req.query.verified    !== undefined ? req.query.verified    === 'true' : undefined;
    const blocklisted = req.query.blocklisted !== undefined ? req.query.blocklisted === 'true' : undefined;
    const search      = req.query.search      || undefined;
    const branch      = req.query.branch      || undefined;
    const college     = req.query.college     || undefined;
    const passout_year = req.query.year       || undefined;
    const platform    = req.query.platform    || undefined;
    const result = await adminService.listStudents({ page, limit, verified, blocklisted, search, branch, platform, college, passout_year });
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

// GET /api/admin/filters  — public, returns dynamic filter options
async function getFilters(req, res, next) {
  try {
    const data = await adminService.getFilters();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/admin/students/:email
async function getStudent(req, res, next) {
  try {
    const data = await adminService.getStudent(decodeURIComponent(req.params.email));
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

// GET /api/admin/overview
async function getOverview(req, res, next) {
  try {
    const data = await adminService.getOverview();
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

// PUT /api/admin/blocklist/:email
async function blockStudent(req, res, next) {
  try {
    const data = await adminService.blockStudent(decodeURIComponent(req.params.email));
    res.status(200).json({ success: true, message: 'Student blocklisted', data });
  } catch (err) { next(err); }
}

// PUT /api/admin/unblocklist/:email
async function unblockStudent(req, res, next) {
  try {
    const data = await adminService.unblockStudent(decodeURIComponent(req.params.email));
    res.status(200).json({ success: true, message: 'Student unblocklisted', data });
  } catch (err) { next(err); }
}

// PUT /api/admin/students/:email/handle  body: { platform, username }
async function updateHandle(req, res, next) {
  try {
    const email              = decodeURIComponent(req.params.email);
    const { platform, username } = req.body;
    if (!platform || !username) {
      return res.status(400).json({ success: false, message: 'platform and username are required' });
    }
    const data = await adminService.updateHandle(email, platform.toLowerCase(), username.trim());
    res.status(200).json({ success: true, message: 'Handle updated. Re-sync started in background.', data });
  } catch (err) { next(err); }
}

// POST /api/admin/students/:email/sync
// Awaits completion so the UI knows when it's truly done.
async function syncStudentNow(req, res, next) {
  try {
    const email = decodeURIComponent(req.params.email);
    const data  = await adminService.syncStudentNowAndWait(email);
    res.status(200).json({ success: true, message: 'Sync complete. Data is up to date.', data });
  } catch (err) { next(err); }
}

// GET /api/admin/students/:email/contest/detail?platform=...&contestId=...
// Admin-auth-protected proxy to contest service — avoids student-JWT requirement.
async function getContestDetail(req, res, next) {
  try {
    const email      = decodeURIComponent(req.params.email);
    const { platform, contestId } = req.query;
    if (!platform || !contestId) {
      return res.status(400).json({ success: false, message: 'platform and contestId are required' });
    }
    let result;
    if (platform === 'codeforces') {
      const r = await query(
        `SELECT pp.username FROM platform_profiles pp WHERE pp.student_email=$1 AND pp.platform_name='codeforces' LIMIT 1`,
        [email]
      );
      const handle = r.rows[0]?.username;
      if (!handle) return res.status(404).json({ success: false, message: 'Codeforces handle not found' });
      result = await getCodeforcesDetail(contestId, handle);
    } else if (platform === 'codechef') {
      result = await getCodechefDetail(contestId, email, query);
    } else if (platform === 'leetcode') {
      const r = await query(
        `SELECT pp.username FROM platform_profiles pp WHERE pp.student_email=$1 AND pp.platform_name='leetcode' LIMIT 1`,
        [email]
      );
      const handle = r.rows[0]?.username;
      if (!handle) return res.status(404).json({ success: false, message: 'LeetCode handle not found' });
      result = await getLeetcodeDetail(contestId, email, query);
    } else {
      return res.status(400).json({ success: false, message: `Unknown platform: ${platform}` });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
}

// POST /api/admin/sync  — manually trigger a full data sync (fire-and-forget)
async function triggerSync(req, res) {
  const state = syncState.getState();
  if (state.running) {
    return res.status(202).json({ success: true, message: 'Sync already running.', data: state });
  }
  logger.info('[Admin] Manual sync triggered via UI');
  setImmediate(() => {
    syncAllStudents()
      .then(() => logger.info('[Admin] Manual sync complete'))
      .catch((err) => {
        logger.error(`[Admin] Manual sync error: ${err.message}`);
        syncState.finish(err.message);
      });
  });
  res.status(202).json({ success: true, message: 'Sync started. Poll /api/admin/sync-status for progress.' });
}

// GET /api/admin/sync-status
async function getSyncStatus(req, res) {
  res.json({ success: true, data: syncState.getState() });
}

// GET /api/admin/students/:email/platform/:platform
async function getPlatformDetail(req, res, next) {
  try {
    const email    = decodeURIComponent(req.params.email);
    const platform = req.params.platform.toLowerCase();
    const data     = await analyticsService.getPlatformDetail(email, platform);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
}

module.exports = {
  listStudents, getStudent, getOverview, getFilters,
  blockStudent, unblockStudent,
  updateHandle, syncStudentNow,
  triggerSync, getSyncStatus,
  getPlatformDetail,
  getContestDetail,
};
