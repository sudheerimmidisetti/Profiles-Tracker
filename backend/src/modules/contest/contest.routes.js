// backend/src/modules/contest/contest.routes.js
const { Router } = require('express');
const { query }  = require('../../config/db');
const authenticate = require('../../middleware/authenticate');
const {
  getCodeforcesDetail,
  getCodechefDetail,
  getLeetcodeDetail,
} = require('./contest.service');

const router = Router();
router.use(authenticate);

/**
 * GET /api/contest/detail
 * Query params: platform, contestId, email (optional, defaults to logged-in user)
 */
router.get('/detail', async (req, res) => {
  const { platform, contestId } = req.query;
  const email = req.query.email || req.user?.email;

  if (!platform || !contestId) {
    return res.status(400).json({ error: 'platform and contestId are required' });
  }

  try {
    let result;

    if (platform === 'codeforces') {
      // Get CF handle from DB
      const r = await query(
        `SELECT pp.username FROM platform_profiles pp WHERE pp.student_email=$1 AND pp.platform_name='codeforces' LIMIT 1`,
        [email]
      );
      const handle = r.rows[0]?.username;
      if (!handle) return res.status(404).json({ error: 'Codeforces handle not found' });
      result = await getCodeforcesDetail(contestId, handle);

    } else if (platform === 'codechef') {
      result = await getCodechefDetail(contestId, email, query);

    } else if (platform === 'leetcode') {
      const r = await query(
        `SELECT pp.username FROM platform_profiles pp WHERE pp.student_email=$1 AND pp.platform_name='leetcode' LIMIT 1`,
        [email]
      );
      const handle = r.rows[0]?.username;
      if (!handle) return res.status(404).json({ error: 'LeetCode handle not found' });
      result = await getLeetcodeDetail(contestId, email, query);

    } else {
      return res.status(400).json({ error: `Unknown platform: ${platform}` });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[contest/detail]', err.message);
    res.status(500).json({ error: 'Failed to fetch contest detail', message: err.message });
  }
});

module.exports = router;
