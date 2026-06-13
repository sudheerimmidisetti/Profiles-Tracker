// src/modules/leaderboard/leaderboard.controller.js
const leaderboardService = require('./leaderboard.service');

// GET /api/leaderboard/:platform?filter=all&page=1&limit=50
async function getLeaderboard(req, res, next) {
  try {
    const { platform } = req.params;
    const filter  = (req.query.filter || 'all').toLowerCase();
    const page    = Math.max(1,   parseInt(req.query.page  || '1',  10));
    const limit   = Math.min(100, parseInt(req.query.limit || '50', 10));
    const college = req.query.college || '';
    const year    = req.query.year    || '';

    const result = await leaderboardService.getLeaderboard(platform, filter, page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// GET /api/leaderboard/placements?page=1&limit=50&college=...&year=...
async function getPlacementsLeaderboard(req, res, next) {
  try {
    const page    = Math.max(1,   parseInt(req.query.page  || '1',  10));
    const limit   = Math.min(100, parseInt(req.query.limit || '50', 10));
    const college = req.query.college || '';
    const year    = req.query.year    || '';
    const result = await leaderboardService.getPlacementsLeaderboard(page, limit, college, year);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// GET /api/leaderboard/weekly?week=2025-06-09&page=1&limit=50&college=...&year=...
async function getWeeklyLeaderboard(req, res, next) {
  try {
    const week    = req.query.week  || null;
    const page    = Math.max(1,   parseInt(req.query.page  || '1',  10));
    const limit   = Math.min(100, parseInt(req.query.limit || '50', 10));
    const college = req.query.college || '';
    const year    = req.query.year    || '';
    const result = await leaderboardService.getWeeklyLeaderboard(week, page, limit, college, year);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// GET /api/leaderboard/monthly?month=2025-06&page=1&limit=50&college=...&year=...
async function getMonthlyLeaderboard(req, res, next) {
  try {
    const month   = req.query.month || null;
    const page    = Math.max(1,   parseInt(req.query.page  || '1',  10));
    const limit   = Math.min(100, parseInt(req.query.limit || '50', 10));
    const college = req.query.college || '';
    const year    = req.query.year    || '';
    const result = await leaderboardService.getMonthlyLeaderboard(month, page, limit, college, year);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLeaderboard, getPlacementsLeaderboard, getWeeklyLeaderboard, getMonthlyLeaderboard };
