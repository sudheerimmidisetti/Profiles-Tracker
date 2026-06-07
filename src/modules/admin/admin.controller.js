// src/modules/admin/admin.controller.js
const adminService = require('./admin.service');

// GET /api/admin/students?page=1&limit=50&verified=true&blocklisted=false
async function listStudents(req, res, next) {
  try {
    const page       = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit      = Math.min(200, parseInt(req.query.limit || '50', 10));
    const verified   = req.query.verified   !== undefined ? req.query.verified   === 'true' : undefined;
    const blocklisted = req.query.blocklisted !== undefined ? req.query.blocklisted === 'true' : undefined;

    const result = await adminService.listStudents({ page, limit, verified, blocklisted });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/blocklist/:email
async function blockStudent(req, res, next) {
  try {
    const data = await adminService.blockStudent(req.params.email);
    res.status(200).json({ success: true, message: 'Student blocklisted', data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/unblocklist/:email
async function unblockStudent(req, res, next) {
  try {
    const data = await adminService.unblockStudent(req.params.email);
    res.status(200).json({ success: true, message: 'Student unblocklisted', data });
  } catch (err) {
    next(err);
  }
}

module.exports = { listStudents, blockStudent, unblockStudent };
