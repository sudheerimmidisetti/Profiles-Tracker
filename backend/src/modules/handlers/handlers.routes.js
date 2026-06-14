// src/modules/handlers/handlers.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./handlers.controller');

const router = Router();

// All handlers routes require authentication
router.use(authenticate);

router.post('/submit',         ctrl.submit);        // Submit handles (first-time → code flow; verified → admin request)
router.get('/verify-status',   ctrl.verifyStatus);  // Check first-time verification state
router.get('/request-status',  ctrl.requestStatus); // Check handle update request status (verified students)
router.post('/confirm',        ctrl.confirm);        // Scrape + confirm first-time verification

module.exports = router;
