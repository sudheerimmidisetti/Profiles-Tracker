// src/modules/profile/profile.controller.js
const { z } = require('zod');
const profileService = require('./profile.service');

// GET /api/profile/me
async function getMe(req, res, next) {
  try {
    const data = await profileService.getMyProfile(req.user.email);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// PUT /api/profile/settings
async function updateSettings(req, res, next) {
  try {
    const schema = z.object({ phone: z.string().min(10).max(15).optional() });
    const body = schema.parse(req.body);
    const updated = await profileService.updateSettings(req.user.email, body);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateSettings };
