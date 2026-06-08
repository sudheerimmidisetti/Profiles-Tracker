// src/scrapers/codeforces.scraper.js
// Uses the official Codeforces REST API (no auth needed for public data)
const axios = require('axios');
const logger = require('../utils/logger');

const BASE = 'https://codeforces.com/api';

async function cfGet(endpoint) {
  const { data } = await axios.get(`${BASE}/${endpoint}`, { timeout: 10000 });
  if (data.status !== 'OK') throw new Error(`CF API error: ${data.comment}`);
  return data.result;
}

// ─────────────────────────────────────────────────────────────
// Get first name — used during VERIFICATION
// Codeforces user.info returns firstName directly
// ─────────────────────────────────────────────────────────────
async function getDisplayName(handle) {
  try {
    const [user] = await cfGet(`user.info?handles=${encodeURIComponent(handle)}`);
    // firstName is the first name field users set in their CF profile
    return user?.firstName?.trim() || null;
  } catch (err) {
    logger.warn(`Codeforces getDisplayName failed for ${handle}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Scrape full profile — used in nightly sync
// ─────────────────────────────────────────────────────────────
async function getFullProfile(handle) {
  try {
    // 1. User info
    const [user] = await cfGet(`user.info?handles=${encodeURIComponent(handle)}`);

    // 2. Contest history (rating changes)
    let contestHistory = [];
    try {
      const ratings = await cfGet(`user.rating?handle=${encodeURIComponent(handle)}`);
      contestHistory = ratings.map((r) => ({
        contestId:       r.contestId,
        contestName:     r.contestName,
        rankAchieved:    r.rank,
        oldRating:       r.oldRating,
        newRating:       r.newRating,
        ratingChange:    r.newRating - r.oldRating,
        timestampSeconds: r.ratingUpdateTimeSeconds
      }));
    } catch (e) {
      logger.warn(`CF rating history unavailable for ${handle}: ${e.message}`);
    }

    // 3. All submissions → count accepted problems by rating tier
    const solvedByTier = {
      under1200: 0,
      r1200_1599: 0,
      r1600_1899: 0,
      r1900_2199: 0,
      above2200: 0
    };

    try {
      const submissions = await cfGet(`user.status?handle=${encodeURIComponent(handle)}&from=1&count=10000`);
      const solvedSet = new Set();

      for (const sub of submissions) {
        if (sub.verdict !== 'OK') continue;
        const key = `${sub.problem.contestId}-${sub.problem.index}`;
        if (solvedSet.has(key)) continue;
        solvedSet.add(key);

        const rating = sub.problem.rating || 0;
        if      (rating < 1200)  solvedByTier.under1200++;
        else if (rating < 1600)  solvedByTier.r1200_1599++;
        else if (rating < 1900)  solvedByTier.r1600_1899++;
        else if (rating < 2200)  solvedByTier.r1900_2199++;
        else                     solvedByTier.above2200++;
      }
    } catch (e) {
      logger.warn(`CF submissions unavailable for ${handle}: ${e.message}`);
    }

    return {
      username:               user.handle,
      currentRating:          user.rating        || 0,
      maxRating:              user.maxRating      || 0,
      currentRank:            user.rank           || 'unrated',
      maxRank:                user.maxRank        || 'unrated',
      contribution:           user.contribution   || 0,
      avatarUrl:              user.avatar         || null,
      solvedRatingUnder1200:  solvedByTier.under1200,
      solvedRating1200_1599:  solvedByTier.r1200_1599,
      solvedRating1600_1899:  solvedByTier.r1600_1899,
      solvedRating1900_2199:  solvedByTier.r1900_2199,
      solvedRatingAbove2200:  solvedByTier.above2200,
      totalSolved:
        solvedByTier.under1200 + solvedByTier.r1200_1599 +
        solvedByTier.r1600_1899 + solvedByTier.r1900_2199 + solvedByTier.above2200,
      contestHistory
    };
  } catch (err) {
    logger.error(`Codeforces getFullProfile failed for ${handle}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
