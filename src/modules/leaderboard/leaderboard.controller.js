// src/modules/leaderboard/leaderboard.controller.js
const leaderboardService = require('./leaderboard.service');

// GET /api/leaderboard/:platform?filter=all&page=1&limit=50
async function getLeaderboard(req, res, next) {
  try {
    const { platform } = req.params;
    const filter = (req.query.filter || 'all').toLowerCase();
    const page   = Math.max(1,  parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(100, parseInt(req.query.limit || '50', 10));

    const result = await leaderboardService.getLeaderboard(platform, filter, page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLeaderboard };
