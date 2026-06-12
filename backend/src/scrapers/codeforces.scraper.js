// src/scrapers/codeforces.scraper.js
// Official Codeforces REST API — no auth needed for public data.
// Rate limit: 1 req / 2s per IP. We use 3 endpoints.
const axios  = require('axios');
const logger = require('../utils/logger');

const BASE = 'https://codeforces.com/api';

async function cfGet(endpoint) {
  const { data } = await axios.get(`${BASE}/${endpoint}`, { timeout: 12000 });
  if (data.status !== 'OK') throw new Error(`CF API: ${data.comment}`);
  return data.result;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Verification (fast, single call) ─────────────────────────────────────────
async function getDisplayName(handle) {
  try {
    const [user] = await cfGet(`user.info?handles=${encodeURIComponent(handle)}`);
    return user?.firstName?.trim() || null;
  } catch (err) {
    logger.warn(`[CF] getDisplayName failed for ${handle}: ${err.message}`);
    return null;
  }
}

// ── Division detector (from contest name) ────────────────────────────────────
function detectDivision(name = '') {
  if (/Div\.\s*1\b/i.test(name) && /Div\.\s*2\b/i.test(name)) return 'Div.1+2'
  if (/Div\.\s*1\b/i.test(name))  return 'Div.1'
  if (/Div\.\s*2\b/i.test(name))  return 'Div.2'
  if (/Div\.\s*3\b/i.test(name))  return 'Div.3'
  if (/Div\.\s*4\b/i.test(name))  return 'Div.4'
  if (/Educational/i.test(name))  return 'Educational'
  if (/Global/i.test(name))       return 'Global'
  return null
}

// ── Full profile sync ─────────────────────────────────────────────────────────
async function getFullProfile(handle) {
  try {
    // 1. User info
    const [user] = await cfGet(`user.info?handles=${encodeURIComponent(handle)}`);
    await sleep(2200);   // stay under rate limit

    // 2. Rating history (contest rankings)
    let contestHistory = [];
    try {
      const ratings = await cfGet(`user.rating?handle=${encodeURIComponent(handle)}`);
      contestHistory = ratings.map(r => ({
        contestId:        r.contestId,
        contestName:      r.contestName,
        rankAchieved:     r.rank,
        oldRating:        r.oldRating,
        newRating:        r.newRating,
        ratingChange:     r.newRating - r.oldRating,
        timestampSeconds: r.ratingUpdateTimeSeconds,
        division:         detectDivision(r.contestName),
        // problemsSolved will be filled after processing submissions
      }));

    } catch (e) {
      logger.warn(`[CF] rating history unavailable for ${handle}: ${e.message}`);
    }
    await sleep(2200);

    // 3. All submissions — derive rich stats
    const solvedByTier = { under1200: 0, r1200_1599: 0, r1600_1899: 0, r1900_2199: 0, above2200: 0 };
    const langMap      = {};   // language → count
    const tagMap       = {};   // tag → count
    const calMap       = {};   // date YYYY-MM-DD → submission count
    const recentAC     = [];
    const allAcSubs    = [];   // ALL unique AC problems for submissions table
    const contestSolvedMap = {}; // contestId → count of unique AC problems solved IN that contest
    let totalSubs      = 0;
    let acceptedSubs   = 0;
    let highestRated   = 0;

    try {
      const submissions = await cfGet(
        `user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`
      );
      const solvedSet = new Set();

      for (const sub of submissions) {
        totalSubs++;

        // Calendar (by submission date, regardless of verdict)
        const date = new Date(sub.creationTimeSeconds * 1000).toISOString().slice(0, 10);
        calMap[date] = (calMap[date] || 0) + 1;

        // Language stats (all subs)
        const lang = sub.programmingLanguage || 'Unknown';
        langMap[lang] = (langMap[lang] || 0) + 1;

        if (sub.verdict !== 'OK') continue;
        acceptedSubs++;

        const key = `${sub.problem.contestId}-${sub.problem.index}`;
        if (solvedSet.has(key)) continue;
        solvedSet.add(key);

        // Count unique AC problems per contest (for contest tooltip)
        if (sub.problem.contestId) {
          contestSolvedMap[sub.problem.contestId] = (contestSolvedMap[sub.problem.contestId] || 0) + 1;
        }
        // Tag stats (unique solved problems)
        for (const tag of (sub.problem.tags || [])) {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        }

        // Difficulty tiers
        const rating = sub.problem.rating || 0;
        if      (rating < 1200) solvedByTier.under1200++;
        else if (rating < 1600) solvedByTier.r1200_1599++;
        else if (rating < 1900) solvedByTier.r1600_1899++;
        else if (rating < 2200) solvedByTier.r1900_2199++;
        else                    solvedByTier.above2200++;

        if (rating > highestRated) highestRated = rating;

        // All unique AC submissions for DB storage
        allAcSubs.push({
          problem_id:   key,
          problem_name: sub.problem.name,
          status:       'AC',
          language:     sub.programmingLanguage || null,
          submitted_at: new Date(sub.creationTimeSeconds * 1000).toISOString(),
          runtime_ms:   sub.timeConsumedMillis  || null,
          memory_kb:    Math.round((sub.memoryConsumedBytes || 0) / 1024) || null,
          platform:     'codeforces',
        });

        // Recent AC (collect first 20 unique)
        if (recentAC.length < 20) {
          recentAC.push({
            problemName: sub.problem.name,
            index:       sub.problem.index,
            rating:      sub.problem.rating || null,
            tags:        sub.problem.tags   || [],
            timestamp:   sub.creationTimeSeconds,
            language:    sub.programmingLanguage,
          });
        }
      }
    } catch (e) {
      logger.warn(`[CF] submissions unavailable for ${handle}: ${e.message}`);
    }

    const totalSolved =
      solvedByTier.under1200 + solvedByTier.r1200_1599 +
      solvedByTier.r1600_1899 + solvedByTier.r1900_2199 + solvedByTier.above2200;

    const acceptanceRate = totalSubs > 0
      ? parseFloat(((acceptedSubs / totalSubs) * 100).toFixed(2)) : 0;

    // Sort lang/tag by count, take top 10
    const languageStats = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([lang, count]) => ({ lang, count }));

    const tagStats = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));

    const mostFrequentTag = tagStats[0]?.tag || null;

    // Best rank across all contests
    const bestRank = contestHistory.length
      ? Math.min(...contestHistory.map(c => c.rankAchieved))
      : 0;

    // Attach per-contest solved count (derived from AC submissions)
    const enrichedContestHistory = contestHistory.map(c => ({
      ...c,
      problemsSolved: contestSolvedMap[c.contestId] || 0,
    }));

    return {
      username:                user.handle,
      firstName:               user.firstName               || null,
      lastName:                user.lastName                || null,
      country:                 user.country                 || null,
      city:                    user.city                    || null,
      organization:            user.organization            || null,
      avatarUrl:               user.avatar                  || null,
      titlePhoto:              user.titlePhoto              || null,
      currentRating:           user.rating                  || 0,
      maxRating:               user.maxRating               || 0,
      currentRank:             user.rank                    || 'unrated',
      maxRank:                 user.maxRank                 || 'unrated',
      contribution:            user.contribution            || 0,
      friendOfCount:           user.friendOfCount           || 0,
      lastOnlineSeconds:       user.lastOnlineTimeSeconds   || null,
      registrationSeconds:     user.registrationTimeSeconds || null,
      // Solving stats
      totalSolved,
      totalSubmissions:        totalSubs,
      acceptedSubmissions:     acceptedSubs,
      acceptanceRate,
      highestRatedProblem:     highestRated,
      mostFrequentTag,
      // By tier
      solvedRatingUnder1200:   solvedByTier.under1200,
      solvedRating1200_1599:   solvedByTier.r1200_1599,
      solvedRating1600_1899:   solvedByTier.r1600_1899,
      solvedRating1900_2199:   solvedByTier.r1900_2199,
      solvedRatingAbove2200:   solvedByTier.above2200,
      // Rich JSONB
      languageStats,
      tagStats,
      submissionCalendar:      calMap,
      recentAcSubmissions:     recentAC,
      allAcSubmissions:        allAcSubs,   // full unique AC history
      // Contest history (with problemsSolved per contest)
      contestHistory:          enrichedContestHistory,
    };

  } catch (err) {
    logger.error(`[CF] getFullProfile failed for ${handle}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
