// src/modules/admin/admin.controller.js
const adminService = require('./admin.service');
const { syncAllStudents } = require('../../jobs/syncProfiles.job');
const logger = require('../../utils/logger');

// GET /api/admin/students?page=1&limit=50&verified=true&blocklisted=false&search=
async function listStudents(req, res, next) {
  try {
    const page       = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit      = Math.min(200, parseInt(req.query.limit || '50', 10));
    const verified   = req.query.verified   !== undefined ? req.query.verified   === 'true' : undefined;
    const blocklisted = req.query.blocklisted !== undefined ? req.query.blocklisted === 'true' : undefined;
    const search     = req.query.search || undefined;

    const result = await adminService.listStudents({ page, limit, verified, blocklisted, search });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/students/:email
async function getStudent(req, res, next) {
  try {
    const data = await adminService.getStudent(decodeURIComponent(req.params.email));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/overview
async function getOverview(req, res, next) {
  try {
    const data = await adminService.getOverview();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/blocklist/:email
async function blockStudent(req, res, next) {
  try {
    const data = await adminService.blockStudent(decodeURIComponent(req.params.email));
    res.status(200).json({ success: true, message: 'Student blocklisted', data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/unblocklist/:email
async function unblockStudent(req, res, next) {
  try {
    const data = await adminService.unblockStudent(decodeURIComponent(req.params.email));
    res.status(200).json({ success: true, message: 'Student unblocklisted', data });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/sync  — manually trigger a full data sync (fire-and-forget)
async function triggerSync(req, res) {
  logger.info('[Admin] Manual sync triggered via UI');
  setImmediate(() => {
    syncAllStudents()
      .then(() => logger.info('[Admin] Manual sync complete'))
      .catch((err) => logger.error(`[Admin] Manual sync error: ${err.message}`));
  });
  res.status(202).json({ success: true, message: 'Sync started in background. Check server logs for progress.' });
}

module.exports = { listStudents, getStudent, getOverview, blockStudent, unblockStudent, triggerSync };
