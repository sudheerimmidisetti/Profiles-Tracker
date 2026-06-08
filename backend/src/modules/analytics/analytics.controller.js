// src/modules/analytics/analytics.controller.js
const analyticsService = require('./analytics.service');

// GET /api/analytics/snapshot/:email
async function getSnapshots(req, res, next) {
  try {
    const data = await analyticsService.getSnapshots(req.params.email);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/summary/:email
async function getSummary(req, res, next) {
  try {
    const data = await analyticsService.getSummary(req.params.email);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSnapshots, getSummary };
