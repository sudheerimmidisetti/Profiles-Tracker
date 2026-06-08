// src/modules/leaderboard/leaderboard.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./leaderboard.controller');

const router = Router();

router.use(authenticate);

// GET /api/leaderboard/:platform?filter=all|contest|consistency|problems&page=1&limit=50
router.get('/:platform', ctrl.getLeaderboard);

module.exports = router;
