// src/modules/admin/admin.routes.js
const { Router } = require('express');
const adminAuth = require('../../middleware/adminAuth');
const ctrl = require('./admin.controller');

const router = Router();

// All admin routes require X-Admin-Secret header
router.use(adminAuth);

router.get('/students',              ctrl.listStudents);    // List all with optional filters
router.get('/students/:email',       ctrl.getStudent);      // Single student detail + platform stats
router.put('/students/:email/handle', ctrl.updateHandle);   // Fix a wrong platform handle + re-sync
router.post('/students/:email/sync', ctrl.syncStudentNow);  // Re-sync a single student
router.put('/blocklist/:email',      ctrl.blockStudent);    // Block a student
router.put('/unblocklist/:email',    ctrl.unblockStudent);  // Reinstate a student
router.post('/sync',                 ctrl.triggerSync);     // POST manually trigger full data sync
router.get('/overview',              ctrl.getOverview);     // Dashboard KPIs + platform breakdown

module.exports = router;
