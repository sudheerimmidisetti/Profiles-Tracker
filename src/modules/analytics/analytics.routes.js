// src/modules/analytics/analytics.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./analytics.controller');

const router = Router();

router.use(authenticate);

router.get('/snapshot/:email', ctrl.getSnapshots); // Historical time-series for charts
router.get('/summary/:email',  ctrl.getSummary);   // Cross-platform aggregated summary

module.exports = router;
