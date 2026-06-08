// src/scrapers/hackerrank.scraper.js
// Uses HackerRank's unofficial/undocumented public REST endpoints
const axios = require('axios');
const logger = require('../utils/logger');

const BASE = 'https://www.hackerrank.com/rest';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept':     'application/json'
};

// ─────────────────────────────────────────────────────────────
// Get display name — used during VERIFICATION
// NOTE: /rest/hackers/{user}/profile is broken (returns 404).
// Use /rest/contests/master/hackers/{user}/profile instead.
// ─────────────────────────────────────────────────────────────
async function getDisplayName(username) {
  try {
    const { data } = await axios.get(
      `${BASE}/contests/master/hackers/${encodeURIComponent(username)}/profile`,
      { headers: HEADERS, timeout: 10000 }
    );
    const name = data?.model?.name?.trim();
    // Return the FULL name for verification comparison
    // (Verification code has no spaces, so name === code when user sets it correctly)
    return name || null;
  } catch (err) {
    logger.warn(`HackerRank getDisplayName failed for ${username}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Scrape full profile — used in nightly sync
// ─────────────────────────────────────────────────────────────
async function getFullProfile(username) {
  try {
    const { data } = await axios.get(
      `${BASE}/contests/master/hackers/${encodeURIComponent(username)}/profile`,
      { headers: HEADERS, timeout: 10000 }
    );

    const model = data?.model || {};

    // Domain scores (stars / score per track)
    const scores   = model.scores_elo       || {};
    const badges   = model.badges           || [];

    const getDomainScore = (domain) => {
      const entry = scores[domain];
      return entry ? Math.round(entry) : 0;
    };

    const getBadgeStars = (slug) => {
      const badge = badges.find((b) => b.type === slug);
      return badge ? badge.stars : 0;
    };

    // Recent submissions
    let recentSubmissions = [];
    try {
      const subResp = await axios.get(
        `${BASE}/hackers/${encodeURIComponent(username)}/recent_challenges`,
        { headers: HEADERS, timeout: 10000 }
      );
      const challenges = subResp.data?.models || [];
      recentSubmissions = challenges.slice(0, 50).map((c) => ({
        challengeSlug: c.slug,
        challengeName: c.name,
        language:      c.language || null,
        status:        c.status   || null,
        submittedAt:   c.created_at || null
      }));
    } catch (e) {
      logger.warn(`HackerRank recent submissions unavailable for ${username}: ${e.message}`);
    }

    return {
      username,
      totalPoints:          parseFloat(model.points      || 0),
      globalRank:           parseInt(model.country_rank   || 0, 10),
      problemSolvingStars:  getBadgeStars('problem_solving'),
      problemSolvingScore:  getDomainScore('problem_solving'),
      cppStars:             getBadgeStars('cpp'),
      javaStars:            getBadgeStars('java'),
      pythonStars:          getBadgeStars('python'),
      sqlStars:             getBadgeStars('sql'),
      recentSubmissions
    };
  } catch (err) {
    logger.error(`HackerRank getFullProfile failed for ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
