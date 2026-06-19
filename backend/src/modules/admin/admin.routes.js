// src/modules/admin/admin.routes.js
'use strict';

const { Router }  = require('express');
const adminAuth   = require('../../middleware/adminAuth');
const ctrl        = require('./admin.controller');
const authCtrl    = require('./adminAuth.controller');

const router = Router();

// ── PUBLIC: OTP Auth (no auth required) ─────────────────────────────────────
router.post('/auth/request-otp', authCtrl.requestOtp);
router.post('/auth/verify-otp',  authCtrl.verifyOtp);

// PUBLIC: Dynamic filter options (student leaderboard also needs this)
router.get('/filters', ctrl.getFilters);

// ── All remaining routes require admin auth ──────────────────────────────────
router.use(adminAuth);

// Admin user management
router.get   ('/auth/admins',        authCtrl.listAdmins);
router.post  ('/auth/add-admin',     authCtrl.addAdmin);
router.delete('/auth/remove-admin',  authCtrl.removeAdmin);

// Students
router.get  ('/students',              ctrl.listStudents);
router.get  ('/students/:email',       ctrl.getStudent);
router.put  ('/students/:email/handle', ctrl.updateHandle);
router.post ('/students/:email/sync',  ctrl.syncStudentNow);

// Contest detail for admin (bypasses student-JWT requirement)
router.get  ('/students/:email/contest/detail', ctrl.getContestDetail);

// Platform detail for admin (same as analytics but no JWT needed)
router.get  ('/students/:email/platform/:platform', ctrl.getPlatformDetail);

// Blocklist
router.put  ('/blocklist/:email',    ctrl.blockStudent);
router.put  ('/unblocklist/:email',  ctrl.unblockStudent);

// Sync
router.post ('/sync',               ctrl.triggerSync);
router.get  ('/sync-status',        ctrl.getSyncStatus);

// Overview
router.get  ('/overview',           ctrl.getOverview);

// Handle Update Requests (student requests to change handles)
router.get  ('/handle-requests',               ctrl.listHandleRequests);
router.put  ('/handle-requests/:id/approve',   ctrl.approveHandleRequest);
router.put  ('/handle-requests/:id/reject',    ctrl.rejectHandleRequest);

// Settings (cron schedule, etc.)
router.get  ('/settings',                      ctrl.getSettings);
router.put  ('/settings/cron',                 ctrl.updateCronSchedule);

module.exports = router;
