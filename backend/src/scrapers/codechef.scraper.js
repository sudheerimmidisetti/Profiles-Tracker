// src/scrapers/codechef.scraper.js
// CodeChef has NO official public API — scrapes the profile HTML page.
// Updated for 2024/2025 CodeChef layout.
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
    timeout: 25000,
  });
  return { html, $: cheerio.load(html) };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function safeInt(str) {
  const n = parseInt(String(str || '').replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function extractJsonVar(html, varName) {
  // Matches: var varName = [...]; or varName = {...};
  const re = new RegExp(`(?:var\\s+)?${varName}\\s*=\\s*([\\[{][\\s\\S]*?)[;\\n]\\s*(?:var |\\$|jQuery|</script)`, '');
  const m = html.match(re);
  if (!m) return null;
  try { return JSON.parse(m[1].trim().replace(/;$/, '')); } catch { return null; }
}

function detectContestType(name = '') {
  if (/cook.?off/i.test(name))      return 'Cook-Off';
  if (/lunchtime/i.test(name))      return 'Lunchtime';
  if (/long.challenge/i.test(name)) return 'Long Challenge';
  if (/starters/i.test(name))       return 'Starters';
  if (/snackdown/i.test(name))      return 'SnackDown';
  if (/flashcook/i.test(name))      return 'FlashCook';
  return 'Contest';
}

function detectDivision(name = '') {
  const m = name.match(/div(?:ision)?\s*(\d)/i);
  return m ? `Div ${m[1]}` : null;
}

function starsFromRating(rating) {
  if (!rating || rating <= 0) return '☆';
  if (rating < 1400) return '1★';
  if (rating < 1600) return '2★';
  if (rating < 1800) return '3★';
  if (rating < 2000) return '4★';
  if (rating < 2200) return '5★';
  if (rating < 2500) return '6★';
  return '7★';
}

// ── Verification ───────────────────────────────────────────────────────────────
async function getDisplayName(username) {
  try {
    const { $ } = await fetchProfile(username);
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

// Fetches real submission data from /recent/user (HTML scraping)
// Returns array of { problem_id, problem_name, status, language, submitted_at, contest_id }
async function fetchCCRecentSubmissions(username) {
  const submissions = [];
  const seen = new Set(); // dedupe by problem code (keep best score)

  try {
    let page = 0;
    const MAX_PAGES = 20; // 20 × 20 rows = 400 submissions

    while (page < MAX_PAGES) {
      const res = await axios.get(`${BASE}/recent/user`, {
        params: { page, user_handle: username },
        headers: { ...HEADERS, 'Accept': 'application/json', 'Referer': `${BASE}/users/${username}` },
        timeout: 12000,
      });

      const html    = res.data?.content || '';
      const maxPage = res.data?.max_page || 0;
      if (!html || html.trim() === '<') break;

      const $ = cheerio.load(html);
      let rowCount = 0;

      $('table tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 4) return;

        const linkEl    = $(cells[1]).find('a').first();
        const href      = linkEl.attr('href') || '';           // e.g. /START242D/problems/EQMNG
        const scoreText = $(cells[2]).text().trim();            // e.g. "(100)"
        const lang      = $(cells[3]).text().trim();
        const timeText  = $(cells[0]).text().trim();            // e.g. "18 hours ago" or "08:42 PM 03/06/26"

        // Extract problem code and contest code from href
        const hrefParts   = href.split('/problems/');
        if (hrefParts.length < 2) return;
        const problemCode = hrefParts[1]?.split('?')[0]?.trim();
        const contestCode = hrefParts[0]?.replace('/', '').trim(); // remove leading /
        if (!problemCode) return;

        rowCount++;

        // Parse score: "(100)" → 100, "100" → 100
        const scoreMatch = scoreText.match(/(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        const status = score >= 100 ? 'AC' : score > 0 ? 'PA' : 'WA';

        // Parse submitted_at from time text
        // Format A: "08:42 PM 03/06/26" → parse as date
        // Format B: relative "N hours ago", "N days ago" → approximate
        let submitted_at = null;
        const absMatch = timeText.match(/(\d{1,2}:\d{2}\s*[AP]M\s+\d{2}\/\d{2}\/\d{2})/i);
        if (absMatch) {
          try {
            submitted_at = new Date(absMatch[1].replace(/(\d{2})\/(\d{2})\/(\d{2})/, '20$3-$2-$1')).toISOString();
          } catch { submitted_at = null; }
        } else {
          const hoursAgo = timeText.match(/(\d+)\s*hour/i);
          const daysAgo  = timeText.match(/(\d+)\s*day/i);
          const minsAgo  = timeText.match(/(\d+)\s*min/i);
          const now = Date.now();
          if (hoursAgo)     submitted_at = new Date(now - Number(hoursAgo[1]) * 3600000).toISOString();
          else if (daysAgo) submitted_at = new Date(now - Number(daysAgo[1]) * 86400000).toISOString();
          else if (minsAgo) submitted_at = new Date(now - Number(minsAgo[1]) * 60000).toISOString();
          else              submitted_at = new Date().toISOString();
        }

        // Use problem_id as CC problem code (e.g. "EQMNG")
        // For the DB, we store the actual problem code so contest lookups work
        submissions.push({
          problem_id:   problemCode,
          problem_name: problemCode,  // CC doesn't give name in this endpoint
          status,
          language:     lang || null,
          submitted_at,
          contest_id:   contestCode || null,
          score,
        });
      });

      if (page >= maxPage) break;
      page++;
      // Polite delay
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (err) {
    logger.warn(`[CC] fetchCCRecentSubmissions failed for ${username}: ${err.message}`);
  }

  return submissions;
}


async function getFullProfile(username) {
  try {
    const { html, $ } = await fetchProfile(username);

    // ── 1. Identity ─────────────────────────────────────────────────────────────
    const displayName =
      $('h1').first().text().trim() ||
      $('main h1').first().text().trim() ||
      $('section.user-details h2').first().text().trim() ||
      username;

    const avatarUrl   = $('img.profile-image-css').attr('src') ||
                        $('img[class*="profile"]').first().attr('src') || null;
    const country     = $('span.user-country-name').text().trim() ||
                        $('[class*="country"] span').first().text().trim() || null;
    const institution = $('p.user-institution-data').text().trim() ||
                        $('p[class*="institution"]').first().text().trim() ||
                        $('span[class*="institution"]').text().trim() || null;
    const studentOrPro = $('label:contains("Student")').length ? 'Student' :
                         $('label:contains("Professional")').length ? 'Professional' : null;

    // ── 2. Contest rating ────────────────────────────────────────────────────────
    const currentRating = safeInt($('.rating-number').first().text());
    const highestRatingText = $('small').filter((_, el) => $(el).text().includes('Highest')).text();
    const highestRating = safeInt(highestRatingText.match(/\d+/)?.[0]);
    const starsString   = starsFromRating(currentRating);

    // Ranks
    const rankItems   = $('.rating-ranks li');
    const globalRank  = safeInt($(rankItems[0]).find('strong').text().replace(/,/g, '')) || null;
    const countryRank = safeInt($(rankItems[1]).find('strong').text().replace(/,/g, '')) || null;

    // Division
    const divText  = $('label').filter((_, el) => $(el).text().includes('Div')).text().trim() ||
                     $('.rating-container').text();
    const divMatch = divText.match(/Div\s*\d+/i);
    const currentDivision = divMatch ? divMatch[0] :
      starsFromRating(currentRating) === '☆' ? 'Div 4' : 'Div 3';

    // ── 3. Total problems solved ─────────────────────────────────────────────────
    // 2025 layout: <h3>Total Problems Solved: 967</h3>
    let totalSolved = 0;
    $('h3').each((_, el) => {
      const t = $(el).text().trim();
      const m = t.match(/Total Problems Solved:\s*(\d+)/i);
      if (m) totalSolved = safeInt(m[1]);
    });
    // Also try old table approach as fallback
    if (totalSolved === 0) {
      const allSolved = $('table.problems-solved td a').length;
      if (allSolved > 0) totalSolved = allSolved;
    }

    // Breakdown by type (Practice Paths / Contest / Learning)
    let practiceSolved = 0;
    let startersSolved = 0;
    let peerSolved = 0;
    $('h3').each((_, el) => {
      const t = $(el).text().trim();
      const mPrac = t.match(/Practice Paths?\s*\((\d+)\)/i);
      if (mPrac) practiceSolved = safeInt(mPrac[1]);
      const mCont = t.match(/Contests?\s*\((\d+)\)/i);
      if (mCont) startersSolved = safeInt(mCont[1]);
    });

    // ── 4. DSA rating ────────────────────────────────────────────────────────────
    let dsaRating = 0, dsaHighestRating = 0;
    $('script').each((_, script) => {
      const src = $(script).html() || '';
      const dsaMatch = src.match(/dsa_rating\s*[=:]\s*(\d+)/i);
      if (dsaMatch) dsaRating = safeInt(dsaMatch[1]);
      const dsaHighMatch = src.match(/dsa_highest_rating\s*[=:]\s*(\d+)/i);
      if (dsaHighMatch) dsaHighestRating = safeInt(dsaHighMatch[1]);
    });

    // ── 5. Contest history + rating graph from all_rating ─────────────────────────
    const contestHistory = [];
    const ratingGraph    = [];
    let bestRank = null;
    let wins = 0;

    // all_rating is in a <script> — try via Drupal settings first, then regex
    let allRatingData = null;

    // Method A: Drupal.settings JSON blob
    const drupalM = html.match(/jQuery\.extend\(Drupal\.settings,\s*(\{[\s\S]+?\})\s*\);/);
    if (drupalM) {
      try {
        const ds = JSON.parse(drupalM[1]);
        allRatingData = ds?.date_versus_rating?.all || null;
      } catch { /* ignore */ }
    }

    // Method B: raw var all_rating = [...]
    if (!allRatingData) {
      const m = html.match(/var\s+all_rating\s*=\s*(\[[\s\S]*?\]);/);
      if (m) { try { allRatingData = JSON.parse(m[1]); } catch { /* ignore */ } }
    }

    if (allRatingData) {
      let prevRating = 0;
      allRatingData.forEach((r) => {
        const rank    = safeInt(r.rank);
        const rating  = safeInt(r.rating);
        const change  = prevRating > 0 ? rating - prevRating : 0;
        prevRating    = rating;
        const dateStr = r.end_date || `${r.getyear}-${r.getmonth}-${r.getday}` || null;

        contestHistory.push({
          contestCode:        r.code || '',
          contestName:        r.name || '',
          rankAchieved:       rank,
          ratingAfterContest: rating,
          ratingChange:       change,
          contestDate:        dateStr,
          contestType:        detectContestType(r.name || ''),
          division:           detectDivision(r.name || ''),
          problemsSolvedCount: 0,
        });
        ratingGraph.push({ name: r.name, date: dateStr, rating, rank, ratingChange: change });

        if (rank > 0 && (bestRank === null || rank < bestRank)) bestRank = rank;
        if (change > 0) wins++;
      });
    }

    const winRate = contestHistory.length > 0
      ? parseFloat(((wins / contestHistory.length) * 100).toFixed(2)) : 0;

    // ── 6. Heatmap ────────────────────────────────────────────────────────────────
    // 2025 CodeChef: var userDailySubmissionsStats = [{date:"2024-6-9", value:14}, ...]
    let heatMap = [];
    const heatM = html.match(/userDailySubmissionsStats\s*=\s*(\[[\s\S]*?\]);/);
    if (heatM) {
      try {
        const raw = JSON.parse(heatM[1]);
        if (Array.isArray(raw)) {
          heatMap = raw.map(h => ({
            date:  h.date  || '',
            count: safeInt(h.value || h.submissionCount || h.count || 0),
          })).filter(h => h.date && h.count > 0);
        }
      } catch { /* ignore */ }
    }

    // Fallback: old heat_map variable patterns
    if (heatMap.length === 0) {
      const oldHeatPatterns = [
        /submission_heat_map\s*=\s*(\{.*?\})/s,
        /"heatMap"\s*:\s*(\[.*?\])/s,
        /heat_map\s*=\s*(\[.*?\])/s,
      ];
      for (const pat of oldHeatPatterns) {
        const m = html.match(pat);
        if (m) {
          try {
            const raw = JSON.parse(m[1]);
            if (Array.isArray(raw)) {
              heatMap = raw.map(h => ({ date: h.date || h.d, count: safeInt(h.value || h.count) }));
            } else if (typeof raw === 'object') {
              heatMap = Object.entries(raw).map(([date, count]) => ({ date, count: safeInt(count) }));
            }
            if (heatMap.length > 0) break;
          } catch { /* ignore */ }
        }
      }
    }

    // ── 7. Badges ─────────────────────────────────────────────────────────────────
    const badges = [];

    // Contest contender badge
    const contestCount = contestHistory.length;
    let contestBadgeTier = null;
    if (contestCount >= 100)      contestBadgeTier = 'diamond';
    else if (contestCount >= 75)  contestBadgeTier = 'platinum';
    else if (contestCount >= 50)  contestBadgeTier = 'gold';
    else if (contestCount >= 10)  contestBadgeTier = 'silver';
    else if (contestCount >= 1)   contestBadgeTier = 'bronze';

    if (contestBadgeTier) {
      badges.push({
        type: 'contest_contender', tier: contestBadgeTier, iconUrl: '',
        description: `Participated in ${contestCount} rated contest${contestCount !== 1 ? 's' : ''}`,
        currentProgress: contestCount,
      });
    }

    // Problem solver badge
    let solverBadgeTier = null;
    if (totalSolved >= 500)     solverBadgeTier = 'gold';
    else if (totalSolved >= 50) solverBadgeTier = 'silver';
    else if (totalSolved >= 1)  solverBadgeTier = 'bronze';

    if (solverBadgeTier) {
      badges.push({
        type: 'problem_solver', tier: solverBadgeTier, iconUrl: '',
        description: `Solved ${totalSolved} problems`,
        currentProgress: totalSolved,
      });
    }

    // Rating star badge
    if (currentRating > 0) {
      badges.push({
        type: 'rating_star', tier: starsString, iconUrl: '',
        description: `${starsString} rated coder (${currentRating})`,
        currentProgress: currentRating,
      });
    }

    return {
      username,
      displayName,
      avatarUrl,
      country,
      institution,
      studentOrPro,
      isProUser: false,
      starsString,
      currentRating,
      highestRating,
      globalRank,
      countryRank,
      currentDivision,
      dsaRating,
      dsaHighestRating,
      dsaGlobalRank:   null,
      dsaCountryRank:  null,
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
      // Real CC submissions scraped from /recent/user (actual problem codes, not heatmap fakes)
      allAcSubmissions: await fetchCCRecentSubmissions(username),
    };

  } catch (err) {
    logger.error(`[CC] getFullProfile failed for ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
