// src/modules/handlers/handlers.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./handlers.controller');

const router = Router();

// All handlers routes require authentication
router.use(authenticate);

router.post('/submit',        ctrl.submit);       // Submit handles → get verification code
router.get('/verify-status',  ctrl.verifyStatus); // Check pending/current verification state
router.post('/confirm',       ctrl.confirm);      // Scrape all platforms → confirm names → verify

module.exports = router;
