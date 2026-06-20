// src/modules/profile/profile.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./profile.controller');

const router = Router();

// ── Authenticated ─────────────────────────────────────────────────────────────
router.use(authenticate);
router.get('/me',       ctrl.getMe);          // GET  /api/profile/me
router.put('/settings', ctrl.updateSettings); // PUT  /api/profile/settings

module.exports = router;
