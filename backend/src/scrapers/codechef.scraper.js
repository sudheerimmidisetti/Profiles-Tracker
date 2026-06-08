// src/scrapers/codechef.scraper.js
// CodeChef does not have a public official API — scrapes the HTML profile page
const axios   = require('axios');
const cheerio = require('cheerio');
const logger  = require('../utils/logger');

const BASE = 'https://www.codechef.com';

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

async function fetchProfile(username) {
  const { data: html } = await axios.get(`${BASE}/users/${username}`, {
    headers: HEADERS,
    timeout: 15000
  });
  return cheerio.load(html);
}

// ─────────────────────────────────────────────────────────────
// Get display name — used during VERIFICATION
// CodeChef redesigned their profile page (2024+): name is now in <h1>
// ─────────────────────────────────────────────────────────────
async function getDisplayName(username) {
  try {
    const $ = await fetchProfile(username);

    // Try selectors in priority order (new layout → old layout → fallback)
    const name =
      $('h1').first().text().trim() ||                            // new layout (2024+)
      $('main h1').first().text().trim() ||                       // alternate new layout
      $('section.user-details h2').first().text().trim() ||       // old layout
      $('header.user-list-item h2').first().text().trim() ||      // old layout alt
      $('span.m-username').first().text().trim();                  // username fallback

    // Return the FULL name so verification can compare the whole code string.
    // (The verification code is 8 chars with no spaces, so name === code when set correctly)
    return name || null;
  } catch (err) {
    logger.warn(`CodeChef getDisplayName failed for ${username}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Scrape full profile — used in nightly sync
// ─────────────────────────────────────────────────────────────
async function getFullProfile(username) {
  try {
    const $ = await fetchProfile(username);

    // Display name (new + old layouts)
    const displayName =
      $('h1').first().text().trim() ||
      $('main h1').first().text().trim() ||
      $('section.user-details h2').first().text().trim() ||
      username;

    // Rating
    const currentRating = parseInt($('.rating-number').first().text().trim().replace(/[^0-9]/g, ''), 10) || 0;
    const highestRating  = parseInt(
      $('small').filter((_, el) => $(el).text().includes('Highest')).text().match(/\d+/)?.[0],
      10
    ) || 0;

    // Stars (e.g. "★★★★★")
    const starsText = $('.rating-star').text().trim() || '1★';

    // Ranks
    const rankItems = $('.rating-ranks li');
    const globalRank  = parseInt($(rankItems[0]).find('strong').text().replace(/,/g, ''), 10) || 0;
    const countryRank = parseInt($(rankItems[1]).find('strong').text().replace(/,/g, ''), 10) || 0;

    // Division from rating container or label
    const divText = $('label').filter((_, el) => $(el).text().includes('Div')).text().trim() ||
                    $('.rating-container').text();
    const divMatch = divText.match(/Div\s*\d+/i);
    const currentDivision = divMatch ? divMatch[0] : 'Div 4';

    // Problem counts — from the "Problems" section on profile
    let startersSolved = 0, practiceSolved = 0, peerSolved = 0, totalSolved = 0;
    $('table.problems-solved').each((_, table) => {
      const heading = $(table).prev('h5').text().toLowerCase();
      const count   = $(table).find('td').length;
      if (heading.includes('contest'))       startersSolved = count;
      else if (heading.includes('practice')) practiceSolved = count;
      else if (heading.includes('peer'))     peerSolved = count;
    });

    const allSolved = $('table.problems-solved td a').length;
    totalSolved = allSolved || startersSolved + practiceSolved + peerSolved;

    // Contest history — from the rating graph data embedded in the page
    const contestHistory = [];
    $('script').each((_, script) => {
      const src = $(script).html() || '';
      const match = src.match(/var all_rating\s*=\s*(\[.*?\]);/s);
      if (match) {
        try {
          const ratings = JSON.parse(match[1]);
          ratings.forEach((r) => {
            contestHistory.push({
              contestCode:        r.code,
              contestName:        r.name,
              rankAchieved:       parseInt(r.rank, 10)   || 0,
              ratingAfterContest: parseInt(r.rating, 10) || 0,
              ratingChange:       parseInt(r.diff, 10)   || 0
            });
          });
        } catch (e) { /* silent */ }
      }
    });

    return {
      username,
      displayName,
      starsString:     starsText,
      currentRating,
      highestRating,
      globalRank,
      countryRank,
      currentDivision,
      startersSolved,
      practiceSolved,
      peerSolved,
      totalSolved,
      contestHistory
    };
  } catch (err) {
    logger.error(`CodeChef getFullProfile failed for ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
