// src/modules/analytics/analytics.routes.js
const { Router } = require('express');
const authenticate = require('../../middleware/authenticate');
const ctrl = require('./analytics.controller');

const router = Router();

router.use(authenticate);

router.get('/snapshot/:email',      ctrl.getSnapshots);      // Historical time-series for charts
router.get('/summary/:email',        ctrl.getSummary);        // Cross-platform aggregated summary
router.get('/detail/:platform',      ctrl.getPlatformDetail); // Full platform profile (uses JWT email)
router.get('/submissions/:platform', ctrl.getSubmissions);    // All AC submissions for a date
router.get('/heatmap',               ctrl.getHeatmap);        // Combined cross-platform heatmap



module.exports = router;
