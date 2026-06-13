// scrapers/cc.js
// CodeChef public profile scraper.
//
// BUG-1+2 FIX (2026-06-13):
//   - Rating:          Parse `all_rating` JS array (last entry) — NOT `.rating-number` CSS class
//   - Problems Solved: Parse `<h3>Total Problems Solved: N</h3>` HTML text — NOT CSS selectors
//   - Non-existent:    Detect redirect-to-homepage via page title check
'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');

const BASE    = 'https://www.codechef.com';
const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,*/*;q=0.9',
  'Accept-Language': 'en-US,en;q=0.5',
};

function safeInt(str) {
  const n = parseInt(String(str || '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function starsFromRating(r) {
  if (r >= 2500) return 7;
  if (r >= 2000) return 6;
  if (r >= 1600) return 5;
  if (r >= 1400) return 4;
  if (r >= 1200) return 3;
  if (r >= 1000) return 2;
  if (r >= 1)    return 1;
  return 0;
}

async function fetchCCProfile(username) {
  if (!username) return null;
  try {
    const resp = await axios.get(`${BASE}/users/${username}`, {
      headers: HEADERS,
      timeout: 25000,
      validateStatus: (s) => s < 500,
    });

    // Non-existent user: CodeChef returns 404
    if (resp.status === 404) {
      console.warn(`[CC] ${username}: profile not found (404)`);
      return null;
    }

    const html = resp.data;
    const $    = cheerio.load(html);

    // ── Detect non-existent users ──────────────────────────────────────────────
    // CodeChef returns HTTP 200 + generic homepage for invalid usernames.
    // A real profile page title contains the username.
    const pageTitle    = $('title').text().trim();
    const isProfilePage = pageTitle.toLowerCase().includes(username.toLowerCase()) ||
                          $('.rating-number').length > 0 ||
                          html.includes('all_rating');

    if (!isProfilePage) {
      console.warn(`[CC] ${username}: profile not found (redirected to homepage)`);
      return null;
    }

    // ── Rating: parse `all_rating` JS array — last entry is the current rating ─
    // CodeChef embeds: var all_rating = [{..., "rating":"1228", ...}, ...];
    let current_rating = 0;
    let contest_count  = 0;

    const allRatingM = html.match(/all_rating\s*=\s*(\[[\s\S]*?\]);\s*\n/);
    if (allRatingM) {
      try {
        const arr = JSON.parse(allRatingM[1]);
        contest_count = arr.length;
        if (arr.length > 0) {
          // Last entry in the array = most recent contest = current rating
          const latest = arr[arr.length - 1];
          current_rating = safeInt(latest?.rating);
        }
      } catch { /* ignore parse error */ }
    }

    // Fallback: try `current_user_rating` variable (also embedded in page)
    if (current_rating === 0) {
      const curRatingM = html.match(/current_user_rating\s*=\s*(\d+)/);
      if (curRatingM) current_rating = safeInt(curRatingM[1]);
    }

    // Sanity check: CodeChef ratings are always 1000–4000 range
    if (current_rating < 1000 || current_rating > 4000) current_rating = 0;

    const stars = starsFromRating(current_rating);

    // ── Problems Solved: parse `Total Problems Solved: N` from HTML ───────────
    // CodeChef embeds: <h3>Total Problems Solved: 586</h3>
    let problems_solved = 0;
    const psM = html.match(/Total Problems Solved:\s*(\d+)/i);
    if (psM) {
      problems_solved = safeInt(psM[1]);
    } else {
      // Fallback: cheerio search
      $('h3, h5').each((_, el) => {
        const t = $(el).text();
        const m = t.match(/Total Problems Solved:\s*(\d+)/i) ||
                  t.match(/(\d+)\s*Problems?\s*Solved/i);
        if (m) problems_solved = Math.max(problems_solved, safeInt(m[1]));
      });
    }

    return {
      username,
      current_rating,
      stars,
      problems_solved,
      contest_count,
    };
  } catch (err) {
    console.error(`[CC] ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { fetchCCProfile };
