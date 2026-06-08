// src/modules/admin/admin.routes.js
const { Router } = require('express');
const adminAuth = require('../../middleware/adminAuth');
const ctrl = require('./admin.controller');

const router = Router();

// All admin routes require X-Admin-Secret header
router.use(adminAuth);

router.get('/students',              ctrl.listStudents);    // List all with optional filters
router.put('/blocklist/:email',      ctrl.blockStudent);    // Block a student (cheater)
router.put('/unblocklist/:email',    ctrl.unblockStudent);  // Reinstate a student
router.post('/sync',                 ctrl.triggerSync);     // POST manually trigger full data sync

module.exports = router;
