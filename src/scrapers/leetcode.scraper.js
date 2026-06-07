// src/scrapers/leetcode.scraper.js
// Uses LeetCode's public GraphQL endpoint
const axios = require('axios');
const logger = require('../utils/logger');

const GQL_URL = 'https://leetcode.com/graphql';

const HEADERS = {
  'Content-Type': 'application/json',
  'Referer':      'https://leetcode.com',
  'User-Agent':   'Mozilla/5.0 (compatible; CodingTracker/1.0)'
};

async function gql(query, variables = {}) {
  const { data } = await axios.post(GQL_URL, { query, variables }, { headers: HEADERS, timeout: 10000 });
  return data.data;
}

// ─────────────────────────────────────────────────────────────
// Get display name (first name) — used during VERIFICATION
// ─────────────────────────────────────────────────────────────
async function getDisplayName(username) {
  try {
    const data = await gql(
      `query GetName($username: String!) {
         matchedUser(username: $username) { profile { realName } }
       }`,
      { username }
    );
    // realName is the "Name" field users set in their LeetCode profile settings
    return data?.matchedUser?.profile?.realName?.trim() || null;
  } catch (err) {
    logger.warn(`LeetCode getDisplayName failed for ${username}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Scrape full profile stats — used in nightly sync & after verification
// ─────────────────────────────────────────────────────────────
async function getFullProfile(username) {
  try {
    // 1. Problem solving stats + global ranking
    const statsData = await gql(
      `query GetStats($username: String!) {
         matchedUser(username: $username) {
           username
           profile { ranking realName }
           submitStatsGlobal {
             acSubmissionNum { difficulty count }
           }
           userCalendar { submissionCalendar totalActiveDays streak }
         }
       }`,
      { username }
    );

    // 2. Contest stats
    const contestData = await gql(
      `query GetContest($username: String!) {
         userContestRanking(username: $username) {
           rating globalRanking topPercentage attendedContestsCount
         }
         userContestRankingHistory(username: $username) {
           attended problemsSolved finishTimeInSeconds rating ranking
           contest { title startTime }
         }
       }`,
      { username }
    );

    const user        = statsData?.matchedUser;
    const acNums      = user?.submitStatsGlobal?.acSubmissionNum || [];
    const calendar    = user?.userCalendar;
    const contestInfo = contestData?.userContestRanking || {};
    const history     = contestData?.userContestRankingHistory || [];

    const getCount = (diff) =>
      acNums.find((x) => x.difficulty === diff)?.count || 0;

    return {
      username,
      globalRanking:        user?.profile?.ranking                || 0,
      totalSolved:          getCount('All'),
      easySolved:           getCount('Easy'),
      mediumSolved:         getCount('Medium'),
      hardSolved:           getCount('Hard'),
      contestRating:        parseFloat(contestInfo.rating         || 0),
      contestGlobalRanking: contestInfo.globalRanking             || 0,
      topPercentage:        parseFloat(contestInfo.topPercentage  || 0),
      contributionCalendar: calendar?.submissionCalendar          || null,
      contestHistory: history
        .filter((c) => c.attended)
        .map((c) => ({
          contestTitle:       c.contest?.title,
          contestTime:        c.contest?.startTime,
          rankAchieved:       c.ranking,
          finishTimeSeconds:  c.finishTimeInSeconds,
          problemsSolved:     c.problemsSolved,
          ratingAfterContest: parseFloat(c.rating || 0)
        }))
    };
  } catch (err) {
    logger.error(`LeetCode getFullProfile failed for ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
