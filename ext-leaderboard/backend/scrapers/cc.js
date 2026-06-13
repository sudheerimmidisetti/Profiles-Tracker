// scrapers/cc.js
// CodeChef public profile scraper — same approach as main project.
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
  const n = parseInt(String(str || '').replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function extractJsonVar(html, varName) {
  const re = new RegExp(`(?:var\\s+)?${varName}\\s*=\\s*([\\[{][\\s\\S]*?)[;\\n]\\s*(?:var |\\$|jQuery|<\\/script)`, '');
  const m = html.match(re);
  if (!m) return null;
  try { return JSON.parse(m[1].trim().replace(/;$/, '')); } catch { return null; }
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
      validateStatus: (s) => s < 500, // don't throw on 404
    });

    // ── Non-existent user: CodeChef returns 404 or redirects to /users ──
    if (resp.status === 404) {
      console.warn(`[CC] ${username}: profile not found (404)`);
      return null;
    }

    const html = resp.data;
    const $    = cheerio.load(html);

    // Detect non-existent users:
    // CodeChef returns HTTP 200 + homepage (generic title) for invalid usernames.
    // A real profile page title contains the username, e.g. "gowrishjanapareddy | CodeChef"
    const pageTitle = $('title').text().trim();
    const isProfilePage = pageTitle.toLowerCase().includes(username.toLowerCase()) ||
                          $('section.rating-header').length > 0 ||
                          $('.rating-number').length > 0 ||
                          $('[class*="user-details"]').length > 0;

    if (!isProfilePage) {
      console.warn(`[CC] ${username}: profile not found (redirected to homepage)`);
      return null;
    }

    // ── Rating: must be a realistic number (1000–3500) ──
    const ratingRaw = safeInt($('.rating-number').first().text().trim());
    // CodeChef ratings are always 1000-3500; reject garbage values
    const current_rating = (ratingRaw >= 1000 && ratingRaw <= 4000) ? ratingRaw : 0;
    const stars = starsFromRating(current_rating);

    // ── Problems solved ──
    let problems_solved = 0;
    $('section, div').each((_, el) => {
      const text = $(el).text();
      const m = text.match(/(\d+)\s*(?:Problems?\s*Solved|Solved\s*Problems?)/i);
      if (m) { problems_solved = Math.max(problems_solved, safeInt(m[1])); }
    });

    // ── Contest count from embedded JSON ──
    let contest_count = 0;
    const contestJson = extractJsonVar(html, 'all_rating');
    if (Array.isArray(contestJson)) {
      contest_count = contestJson.length;
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
