// backend/src/modules/cohorts/cohorts.routes.js
'use strict';

const { Router } = require('express');
const adminAuth  = require('../../middleware/adminAuth');
const svc        = require('./cohorts.service');

const router = Router();

// All routes require admin auth

// GET /api/cohorts — list all cohorts
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const data = await svc.listCohorts();
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/cohorts/eligible-students?search=
router.get('/eligible-students', adminAuth, async (req, res, next) => {
  try {
    const data = await svc.getEligibleStudents(req.query.search || '');
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/cohorts — create cohort
router.post('/', adminAuth, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    const data = await svc.createCohort({ name: name.trim(), description, createdBy: req.admin?.email });
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// DELETE /api/cohorts/:id
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    await svc.deleteCohort(parseInt(req.params.id, 10));
    res.json({ success: true, message: 'Cohort deleted' });
  } catch (err) { next(err); }
});

// GET /api/cohorts/:id/members
router.get('/:id/members', adminAuth, async (req, res, next) => {
  try {
    const data = await svc.getCohortMembers(parseInt(req.params.id, 10));
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/cohorts/:id/members — add by roll numbers array
// Body: { rollNumbers: string[] }
router.post('/:id/members', adminAuth, async (req, res, next) => {
  try {
    const cohortId = parseInt(req.params.id, 10);
    const rolls = (req.body.rollNumbers || []).map(r => String(r).trim()).filter(Boolean);
    if (!rolls.length) return res.status(400).json({ success: false, message: 'No roll numbers provided' });
    const result = await svc.addMembersByRollNumbers(cohortId, rolls);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// DELETE /api/cohorts/:id/members/:email
router.delete('/:id/members/:email', adminAuth, async (req, res, next) => {
  try {
    await svc.removeMember(parseInt(req.params.id, 10), req.params.email);
    res.json({ success: true, message: 'Member removed' });
  } catch (err) { next(err); }
});

module.exports = router;
