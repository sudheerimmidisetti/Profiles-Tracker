// src/modules/admin/adminAuth.controller.js
'use strict';

const authService = require('./adminAuth.service');

async function requestOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });
    const result = await authService.requestOtp(email);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.silent) return res.status(200).json({ success: true, message: err.message });
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    const result = await authService.verifyOtp(email, otp);
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
}

async function listAdmins(req, res, next) {
  try {
    const admins = await authService.listAdmins();
    res.status(200).json({ success: true, data: admins });
  } catch (err) { next(err); }
}

async function addAdmin(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
    const result = await authService.addAdmin(email, req.adminEmail);
    res.status(200).json({ success: true, message: `${email} added as admin.`, data: result });
  } catch (err) { next(err); }
}

async function removeAdmin(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required.' });
    const result = await authService.removeAdmin(email, req.adminEmail);
    res.status(200).json({ success: true, message: `${email} removed.`, data: result });
  } catch (err) { next(err); }
}

module.exports = { requestOtp, verifyOtp, listAdmins, addAdmin, removeAdmin };
