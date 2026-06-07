// src/middleware/adminAuth.js
/**
 * Protect admin routes.
 * Client must send header:  X-Admin-Secret: <ADMIN_SECRET>
 */
function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' });
  }
  next();
}

module.exports = adminAuth;
