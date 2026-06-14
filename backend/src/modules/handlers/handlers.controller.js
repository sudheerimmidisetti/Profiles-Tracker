// src/modules/handlers/handlers.controller.js
const { z } = require('zod');
const handlersService = require('./handlers.service');

const submitSchema = z.object({
  leetcode:   z.string().min(1).optional(),
  codeforces: z.string().min(1).optional(),
  codechef:   z.string().min(1).optional(),
  hackerrank: z.string().min(1).optional()
}).refine((d) => d.leetcode || d.codeforces || d.codechef || d.hackerrank, {
  message: 'At least one platform handle is required'
});

// POST /api/handlers/submit
// - Unverified students: starts code-verification flow
// - Verified students: creates handle update request for admin approval
async function submit(req, res, next) {
  try {
    const handles = submitSchema.parse(req.body);
    const result = await handlersService.submitHandlers(req.user.email, handles);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// GET /api/handlers/verify-status
async function verifyStatus(req, res, next) {
  try {
    const result = await handlersService.getVerifyStatus(req.user.email);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// GET /api/handlers/request-status
// Returns pending/recent handle update requests for the current student
async function requestStatus(req, res, next) {
  try {
    const result = await handlersService.getHandleRequestStatus(req.user.email);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// POST /api/handlers/confirm
async function confirm(req, res, next) {
  try {
    const result = await handlersService.confirmVerification(req.user.email);
    const status = result.success ? 200 : 422;
    res.status(status).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { submit, verifyStatus, requestStatus, confirm };
