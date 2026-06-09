// src/scrapers/codechef.scraper.js
// CodeChef has NO official public API — scrapes the profile HTML page.
// The profile embeds JSON blobs in <script> tags that we parse directly.
const axios   = require('axios');
const cheerio = require('cheerio');
const logger  = require('../utils/logger');

const BASE = 'https://www.codechef.com';

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,*/*;q=0.9',
  'Accept-Language': 'en-US,en;q=0.5',
};

async function fetchProfile(username) {
  const { data: html } = await axios.get(`${BASE}/users/${username}`, {
    headers: HEADERS,
    timeout: 20000,
  });
  return cheerio.load(html);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function safeInt(str) {
  const n = parseInt(String(str || '').replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function detectContestType(name = '') {
  if (/cook.?off/i.test(name))      return 'Cook-Off'
  if (/lunchtime/i.test(name))      return 'Lunchtime'
  if (/long.challenge/i.test(name)) return 'Long Challenge'
  if (/starters/i.test(name))       return 'Starters'
  if (/snackdown/i.test(name))      return 'SnackDown'
  if (/flashcook/i.test(name))      return 'FlashCook'
  return 'Contest'
}

function detectDivision(name = '') {
  const m = name.match(/div(?:ision)?\s*(\d)/i)
  return m ? `Div ${m[1]}` : null
}

function starsFromRating(rating) {
  if (!rating || rating <= 0) return '☆'
  if (rating < 1400) return '1★'
  if (rating < 1600) return '2★'
  if (rating < 1800) return '3★'
  if (rating < 2000) return '4★'
  if (rating < 2200) return '5★'
  if (rating < 2500) return '6★'
  return '7★'
}

// ── Verification ───────────────────────────────────────────────────────────────
async function getDisplayName(username) {
  try {
    const $ = await fetchProfile(username);
    const name =
      $('h1').first().text().trim() ||
      $('main h1').first().text().trim() ||
      $('section.user-details h2').first().text().trim() ||
      $('span.m-username').first().text().trim();
    return name || null;
  } catch (err) {
    logger.warn(`[CC] getDisplayName failed for ${username}: ${err.message}`);
    return null;
  }
}

// ── Full profile ───────────────────────────────────────────────────────────────
async function getFullProfile(username) {
  try {
    const $ = await fetchProfile(username);

    // ── 1. Identity ─────────────────────────────────────────────────────────────
    const displayName =
      $('h1').first().text().trim() ||
      $('main h1').first().text().trim() ||
      $('section.user-details h2').first().text().trim() ||
      username;

    const avatarUrl    = $('img.profile-image-css').attr('src') ||
                         $('img[class*="profile"]').first().attr('src') || null;
    const country      = $('span.user-country-name').text().trim() ||
                         $('[class*="country"] span').first().text().trim() || null;
    const institution  = $('p.user-institution-data').text().trim() ||
                         $('p[class*="institution"]').first().text().trim() ||
                         $('span[class*="institution"]').text().trim() || null;
    const studentOrPro = $('label:contains("Student")').length ? 'Student' :
                         $('label:contains("Professional")').length ? 'Professional' : null;
    const isProUser    = $('[class*="pro-badge"]').length > 0 ||
                         $('text:contains("Pro")').length > 0;

    // ── 2. Contest rating ────────────────────────────────────────────────────────
    const currentRating = safeInt($('.rating-number').first().text());
    const highestRating = safeInt(
      $('small').filter((_, el) => $(el).text().includes('Highest')).text().match(/\d+/)?.[0]
    );
    const starsString   = starsFromRating(currentRating);

    // Ranks
    const rankItems  = $('.rating-ranks li');
    const globalRank  = safeInt($(rankItems[0]).find('strong').text().replace(/,/g, '')) || null;
    const countryRank = safeInt($(rankItems[1]).find('strong').text().replace(/,/g, '')) || null;

    // Division
    const divText = $('label').filter((_, el) => $(el).text().includes('Div')).text().trim() ||
                    $('.rating-container').text();
    const divMatch = divText.match(/Div\s*\d+/i);
    const currentDivision = divMatch ? divMatch[0] : starsFromRating(currentRating) === '☆' ? 'Div 4' : 'Div 3';

    // ── 3. DSA rating ────────────────────────────────────────────────────────────
    let dsaRating = 0, dsaHighestRating = 0, dsaGlobalRank = null, dsaCountryRank = null;
    $('script').each((_, script) => {
      const src = $(script).html() || '';
      const dsaMatch = src.match(/dsa_rating\s*[=:]\s*(\d+)/i);
      if (dsaMatch) dsaRating = safeInt(dsaMatch[1]);
      const dsaHighMatch = src.match(/dsa_highest_rating\s*[=:]\s*(\d+)/i);
      if (dsaHighMatch) dsaHighestRating = safeInt(dsaHighMatch[1]);
    });

    // ── 4. Problem solving stats ─────────────────────────────────────────────────
    let startersSolved = 0, practiceSolved = 0, peerSolved = 0, totalSolved = 0;
    $('table.problems-solved').each((_, table) => {
      const heading = $(table).prev('h5').text().toLowerCase();
      const count   = $(table).find('td').length;
      if      (heading.includes('contest') || heading.includes('starter')) startersSolved = count;
      else if (heading.includes('practice')) practiceSolved = count;
      else if (heading.includes('peer'))     peerSolved = count;
    });
    const allSolved = $('table.problems-solved td a').length;
    totalSolved = allSolved || startersSolved + practiceSolved + peerSolved;

    // ── 5. Contest history + rating graph ─────────────────────────────────────────
    const contestHistory = [];
    const ratingGraph    = [];
    let bestRank = null;
    let wins = 0;

    $('script').each((_, script) => {
      const src = $(script).html() || '';
      // Extract all_rating array (contest history with full info)
      const match = src.match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        try {
          const ratings = JSON.parse(match[1]);
          ratings.forEach((r) => {
            const rank   = safeInt(r.rank);
            const rating = safeInt(r.rating);
            const change = safeInt(r.diff);
            const dateStr = r.end_date || r.date || null;

            contestHistory.push({
              contestCode:        r.code || '',
              contestName:        r.name || '',
              rankAchieved:       rank,
              ratingAfterContest: rating,
              ratingChange:       change,
              contestDate:        dateStr,
              contestType:        detectContestType(r.name || ''),
              division:           detectDivision(r.name || ''),
              problemsSolvedCount: Array.isArray(r.problemsSolved) ? r.problemsSolved.length : 0,
            });
            ratingGraph.push({ name: r.name, date: dateStr, rating, rank, ratingChange: change });

            if (rank > 0 && (bestRank === null || rank < bestRank)) bestRank = rank;
            if (change > 0) wins++;
          });
        } catch (e) { /* silent */ }
      }
    });

    const winRate = contestHistory.length > 0
      ? parseFloat(((wins / contestHistory.length) * 100).toFixed(2)) : 0;

    // ── 6. Heatmap ────────────────────────────────────────────────────────────────
    let heatMap = [];
    $('script').each((_, script) => {
      const src = $(script).html() || '';
      // Various keys CodeChef uses for heatmap data
      const heatMatch = src.match(/submission_heat_map\s*=\s*(\{.*?\})/s) ||
                        src.match(/"heatMap"\s*:\s*(\[.*?\])/s) ||
                        src.match(/heat_map\s*=\s*(\[.*?\])/s);
      if (heatMatch) {
        try {
          const raw = JSON.parse(heatMatch[1]);
          if (Array.isArray(raw)) {
            heatMap = raw.map(h => ({ date: h.date, count: safeInt(h.value || h.submissionCount || h.count) }));
          } else if (typeof raw === 'object') {
            heatMap = Object.entries(raw).map(([date, count]) => ({ date, count: safeInt(count) }));
          }
        } catch (e) { /* silent */ }
      }
    });

    // ── 7. Badges ─────────────────────────────────────────────────────────────────
    const badges = [];
    $('[class*="badge"]').each((_, el) => {
      const type = $(el).attr('data-badge-type') || $(el).find('[class*="type"]').text().trim() || '';
      const tier = $(el).attr('data-badge-tier') || $(el).find('[class*="tier"]').text().trim() || '';
      const icon = $(el).find('img').attr('src') || '';
      const desc = $(el).attr('title') || $(el).find('[class*="desc"]').text().trim() || '';
      const prog = safeInt($(el).attr('data-progress') || $(el).find('[class*="progress"]').text());
      if (type || tier) badges.push({ type, tier, iconUrl: icon, description: desc, currentProgress: prog });
    });

    // Contest contender badge (derive from count)
    const contestCount = contestHistory.length;
    let contestBadgeTier = null;
    if (contestCount >= 100)      contestBadgeTier = 'diamond'
    else if (contestCount >= 75)  contestBadgeTier = 'platinum'
    else if (contestCount >= 50)  contestBadgeTier = 'gold'
    else if (contestCount >= 10)  contestBadgeTier = 'silver'
    else if (contestCount >= 1)   contestBadgeTier = 'bronze'

    if (contestBadgeTier && !badges.find(b => b.type === 'contest_contender')) {
      badges.push({
        type: 'contest_contender',
        tier: contestBadgeTier,
        iconUrl: '',
        description: `Participated in ${contestCount} rated contest${contestCount !== 1 ? 's' : ''}`,
        currentProgress: contestCount,
      });
    }

    // Problem solver badge (derive from total)
    let solverBadgeTier = null;
    if (totalSolved >= 500)     solverBadgeTier = 'gold'
    else if (totalSolved >= 50) solverBadgeTier = 'silver'
    else if (totalSolved >= 1)  solverBadgeTier = 'bronze'

    if (solverBadgeTier && !badges.find(b => b.type === 'problem_solver')) {
      badges.push({
        type: 'problem_solver',
        tier: solverBadgeTier,
        iconUrl: '',
        description: `Solved ${totalSolved} problems`,
        currentProgress: totalSolved,
      });
    }

    return {
      username,
      displayName,
      avatarUrl,
      country,
      institution,
      studentOrPro,
      isProUser,
      starsString,
      currentRating,
      highestRating,
      globalRank,
      countryRank,
      currentDivision,
      dsaRating,
      dsaHighestRating,
      dsaGlobalRank,
      dsaCountryRank,
      startersSolved,
      practiceSolved,
      peerSolved,
      totalSolved,
      problemsFullySolved:   totalSolved,
      problemsPartialSolved: 0,
      contestsParticipated:  contestHistory.length,
      bestRank,
      winRate,
      heatMap,
      badges,
      ratingGraph,
      contestHistory,
    };
  } catch (err) {
    logger.error(`[CC] getFullProfile failed for ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
