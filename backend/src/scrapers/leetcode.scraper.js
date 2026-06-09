// src/scrapers/leetcode.scraper.js
// Uses LeetCode's public GraphQL endpoint.
// Fetches the complete profile: stats, calendar, language breakdown,
// skill tags, badges, recent AC submissions, and full contest history.
const axios = require('axios');
const logger = require('../utils/logger');

const GQL_URL = 'https://leetcode.com/graphql';
const HEADERS = {
  'Content-Type': 'application/json',
  'Referer':      'https://leetcode.com',
  'User-Agent':   'Mozilla/5.0 (compatible; CodingTracker/1.0)',
};

async function gql(query, variables = {}) {
  const { data } = await axios.post(GQL_URL, { query, variables }, {
    headers: HEADERS,
    timeout: 15000,
  });
  if (data.errors) {
    logger.warn(`[LC GQL] Partial errors: ${JSON.stringify(data.errors.map(e => e.message))}`);
  }
  return data.data || {};
}

// ─────────────────────────────────────────────────────────────
// Used during handle VERIFICATION (fast, single field)
// ─────────────────────────────────────────────────────────────
async function getDisplayName(username) {
  try {
    const d = await gql(
      `query GetName($u: String!) { matchedUser(username: $u) { profile { realName } } }`,
      { u: username }
    );
    return d?.matchedUser?.profile?.realName?.trim() || null;
  } catch (err) {
    logger.warn(`[LC] getDisplayName failed for ${username}: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Full profile — used in nightly sync and after handle confirmation
// ─────────────────────────────────────────────────────────────
async function getFullProfile(username) {
  try {
    const currentYear = new Date().getFullYear();

    // ── Query 1: Profile + solving stats + calendar + language + tags + badges ──
    const q1 = await gql(
      `query GetProfile($u: String!, $year: Int!) {
         matchedUser(username: $u) {
           username
           profile {
             realName userAvatar aboutMe school company jobTitle
             countryName ranking reputation githubUrl linkedinUrl twitterUrl
           }
           submitStatsGlobal {
             acSubmissionNum   { difficulty count submissions }
             totalSubmissionNum{ difficulty count submissions }
           }
           languageProblemCount { languageName problemsSolved }
           tagProblemCounts {
             advanced     { tagName tagSlug problemsSolved }
             intermediate { tagName tagSlug problemsSolved }
             fundamental  { tagName tagSlug problemsSolved }
           }
           userCalendar(year: $year) {
             streak totalActiveDays submissionCalendar activeYears
           }
           badges { name displayName icon creationDate shortName }
           upcomingBadges { name icon progress }
           activeBadge { name icon }
         }
         problemsSolvedBeatsStats(username: $u) { difficulty percentage }
       }`,
      { u: username, year: currentYear }
    );

    // ── Query 2: Contest ranking + history + recent AC submissions ──
    const q2 = await gql(
      `query GetContest($u: String!) {
         userContestRanking(username: $u) {
           rating globalRanking topPercentage
           attendedContestsCount totalParticipants
           badge { name }
         }
         userContestRankingHistory(username: $u) {
           attended trendDirection rating ranking
           problemsSolved totalProblems finishTimeInSeconds
           contest { title startTime }
         }
         recentAcSubmissionList(username: $u, limit: 20) {
           id title titleSlug timestamp
         }
       }`,
      { u: username }
    );

    // ── Parse ──
    const user    = q1?.matchedUser || {};
    const profile = user.profile    || {};
    const acNums  = user.submitStatsGlobal?.acSubmissionNum    || [];
    const totNums = user.submitStatsGlobal?.totalSubmissionNum || [];
    const beats   = q1?.problemsSolvedBeatsStats || [];
    const cal     = user.userCalendar || {};

    const contestInfo  = q2?.userContestRanking           || {};
    const contestHist  = q2?.userContestRankingHistory     || [];
    const recentAc     = q2?.recentAcSubmissionList        || [];

    // Helper: extract count for a difficulty
    const getAc  = (diff) => acNums.find(x => x.difficulty === diff) || {};
    const getTot = (diff) => totNums.find(x => x.difficulty === diff) || {};
    const getBeat = (diff) => {
      const e = beats.find(b => b.difficulty === diff);
      return e ? parseFloat(e.percentage) : 0;
    };

    // Acceptance rate = (total accepted submissions) / (total all submissions) × 100
    const acceptedSubs = getAc('All').submissions  || 0;
    const totalSubs    = getTot('All').submissions || 0;
    const acceptanceRate = totalSubs > 0
      ? parseFloat(((acceptedSubs / totalSubs) * 100).toFixed(2))
      : 0;

    return {
      // ── Basic profile ──
      username,
      realName:      profile.realName      || null,
      avatarUrl:     profile.userAvatar    || null,
      aboutMe:       profile.aboutMe       || null,
      school:        profile.school        || null,
      company:       profile.company       || null,
      jobTitle:      profile.jobTitle      || null,
      country:       profile.countryName   || null,
      githubUrl:     profile.githubUrl     || null,
      linkedinUrl:   profile.linkedinUrl   || null,
      twitterUrl:    profile.twitterUrl    || null,
      reputation:    profile.reputation    || 0,
      globalRanking: profile.ranking       || 0,

      // ── Solving stats ──
      totalSolved:    getAc('All').count    || 0,
      easySolved:     getAc('Easy').count   || 0,
      mediumSolved:   getAc('Medium').count || 0,
      hardSolved:     getAc('Hard').count   || 0,
      acceptanceRate,
      beatsEasy:      getBeat('Easy'),
      beatsMedium:    getBeat('Medium'),
      beatsHard:      getBeat('Hard'),

      // ── Calendar ──
      streak:          cal.streak          || 0,
      totalActiveDays: cal.totalActiveDays || 0,
      contributionCalendar: cal.submissionCalendar || null,

      // ── Contest ranking ──
      contestRating:        parseFloat(contestInfo.rating             || 0),
      contestGlobalRanking: contestInfo.globalRanking                 || 0,
      topPercentage:        parseFloat(contestInfo.topPercentage      || 0),
      attendedContestsCount: contestInfo.attendedContestsCount        || 0,
      totalParticipants:    contestInfo.totalParticipants             || 0,
      contestBadgeName:     contestInfo.badge?.name                   || null,

      // ── Rich data (JSONB) ──
      languageStats:   user.languageProblemCount || [],
      skillTags:       {
        advanced:     user.tagProblemCounts?.advanced     || [],
        intermediate: user.tagProblemCounts?.intermediate || [],
        fundamental:  user.tagProblemCounts?.fundamental  || [],
      },
      badges:          user.badges         || [],
      upcomingBadges:  user.upcomingBadges || [],
      activeBadge:     user.activeBadge    || null,
      recentAcSubmissions: recentAc.map(s => ({
        title:     s.title,
        titleSlug: s.titleSlug,
        timestamp: s.timestamp,
      })),

      // ── Contest history ──
      contestHistory: contestHist
        .filter(c => c.attended)
        .map(c => ({
          contestTitle:       c.contest?.title,
          contestTime:        c.contest?.startTime,
          rankAchieved:       c.ranking,
          finishTimeSeconds:  c.finishTimeInSeconds,
          problemsSolved:     c.problemsSolved,
          totalProblems:      c.totalProblems,
          ratingAfterContest: parseFloat(c.rating || 0),
          trendDirection:     c.trendDirection,
        })),
    };

  } catch (err) {
    logger.error(`[LC] getFullProfile failed for ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
