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

async function fetchCCProfile(username) {
  if (!username) return null;
  try {
    const { data: html } = await axios.get(`${BASE}/users/${username}`, {
      headers: HEADERS,
      timeout: 25000,
    });
    const $ = cheerio.load(html);

    // Rating
    const ratingStr = $('.rating-number').first().text().trim()
      || $('[class*="rating"]').first().text().trim();
    const current_rating = safeInt(ratingStr);

    // Stars
    const starStr = $('.rating-star').length || $('.user-rating-stars').length
      || ($('span.rating').first().text().match(/★/g) || []).length;
    let stars = 0;
    if (current_rating >= 2500) stars = 6;
    else if (current_rating >= 2000) stars = 5;
    else if (current_rating >= 1600) stars = 4;
    else if (current_rating >= 1400) stars = 3;
    else if (current_rating >= 1200) stars = 2;
    else if (current_rating >= 1000) stars = 1;

    // Problems solved
    let problems_solved = 0;
    const psText = $('h5:contains("Problems Solved"), .problems-solved h5, [class*="problem-solved"]').first().text();
    if (psText) problems_solved = safeInt(psText.match(/\d+/)?.[0]);

    // Try JSON embedded data
    const userData = extractJsonVar(html, 'userData') || extractJsonVar(html, 'userPageData') || {};

    // Contest count from recent contests table
    let contest_count = 0;
    const contestJson = extractJsonVar(html, 'all_rating');
    if (Array.isArray(contestJson)) {
      contest_count = contestJson.length;
      if (problems_solved === 0) {
        // Use userData from all_rating if possible
        problems_solved = safeInt(userData?.problems_solved || 0);
      }
    }

    // Fallback: count from page
    if (contest_count === 0) {
      contest_count = safeInt($('.contestLink').length || $('[class*="contest"]').length);
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
