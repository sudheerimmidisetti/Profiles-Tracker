// scrapers/lc.js
// LeetCode public GraphQL API — exact same approach as main project.
'use strict';

const axios = require('axios');

const GQL_URL = 'https://leetcode.com/graphql';
const HEADERS = {
  'Content-Type': 'application/json',
  'Referer':      'https://leetcode.com',
  'User-Agent':   'Mozilla/5.0 (compatible; CodingTracker/1.0)',
};

async function gql(query, variables = {}) {
  const { data } = await axios.post(GQL_URL, { query, variables }, {
    headers: HEADERS,
    timeout: 20000,
  });
  return data.data || {};
}

async function fetchLCProfile(username) {
  if (!username) return null;
  try {
    // Query 1: solve stats + ranking
    const d1 = await gql(
      `query GetStats($u: String!) {
         matchedUser(username: $u) {
           username
           profile { ranking }
           submitStatsGlobal {
             acSubmissionNum { difficulty count }
           }
         }
       }`,
      { u: username }
    );

    const user = d1?.matchedUser;
    if (!user) return null;

    const stats = user.submitStatsGlobal?.acSubmissionNum || [];
    const getCount = (diff) => (stats.find(s => s.difficulty === diff)?.count) || 0;

    // Query 2: contest ranking (separate query to avoid field conflicts)
    let contest_rating = 0, contest_count = 0, contest_rank = 0;
    try {
      const d2 = await gql(
        `query GetContest($u: String!) {
           userContestRanking(username: $u) {
             rating
             attendedContestsCount
             globalRanking
           }
         }`,
        { u: username }
      );
      const cr = d2?.userContestRanking;
      if (cr) {
        contest_rating = Math.round(cr.rating || 0);
        contest_count  = cr.attendedContestsCount || 0;
        contest_rank   = cr.globalRanking || 0;
      }
    } catch { /* contest data optional */ }

    return {
      username,
      total_solved:   getCount('All'),
      easy_solved:    getCount('Easy'),
      medium_solved:  getCount('Medium'),
      hard_solved:    getCount('Hard'),
      global_rank:    user.profile?.ranking || 0,
      contest_rating,
      contest_count,
      contest_rank,
    };
  } catch (err) {
    console.error(`[LC] ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { fetchLCProfile };
