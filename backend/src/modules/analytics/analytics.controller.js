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

// GET /api/analytics/detail/:platform
// Returns the logged-in student's full data for one platform
async function getPlatformDetail(req, res, next) {
  try {
    // Use the JWT email (req.user.email) so students can only see their own data.
    // Admin bypass: if admin secret was used, fall back to :email query param.
    const email    = req.user.email === 'admin'
      ? req.query.email
      : req.user.email;
    const platform = req.params.platform.toLowerCase();
    const data = await analyticsService.getPlatformDetail(email, platform);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// GET /api/analytics/submissions/:platform?date=YYYY-MM-DD
// Returns all unique AC submissions for the logged-in student filtered by platform + date
async function getSubmissions(req, res, next) {
  try {
    const email    = req.user.email === 'admin' ? req.query.email : req.user.email;
    const platform = req.params.platform.toLowerCase();
    const date     = req.query.date; // YYYY-MM-DD optional
    const data = await analyticsService.getSubmissions(email, platform, date);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSnapshots, getSummary, getPlatformDetail, getSubmissions };
