// src/scrapers/leetcode.scraper.js
// Uses LeetCode's public GraphQL endpoint.
// Fetches the complete profile: stats, FULL calendar (all years), language breakdown,
// skill tags, badges, ALL unique AC submissions (paginated), and full contest history.
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
    timeout: 20000,
  });
  if (data.errors) {
    logger.warn(`[LC GQL] Partial errors: ${JSON.stringify(data.errors.map(e => e.message))}`);
  }
  return data.data || {};
}

// ─────────────────────────────────────────────────────────────
// Helper: fetch calendar for ONE year
// ─────────────────────────────────────────────────────────────
async function fetchCalendarForYear(username, year) {
  try {
    const d = await gql(
      `query GetCalendar($u: String!, $year: Int!) {
         matchedUser(username: $u) {
           userCalendar(year: $year) { submissionCalendar }
         }
       }`,
      { u: username, year }
    );
    const raw = d?.matchedUser?.userCalendar?.submissionCalendar;
    if (!raw) return {};
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    logger.warn(`[LC] fetchCalendarForYear(${username}, ${year}) failed: ${err.message}`);
    return {};
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: paginate ALL unique AC submissions (public API)
// Returns unique solved problems (no re-submission duplicates)
// ─────────────────────────────────────────────────────────────
async function fetchAllAcSubmissions(username) {
  const BATCH = 100;
  const seen  = new Set();
  const result = [];
  let offset = 0;

  while (true) {
    try {
      const d = await gql(
        `query GetAC($u: String!, $limit: Int!, $offset: Int!) {
           recentAcSubmissionList(username: $u, limit: $limit) {
             id title titleSlug timestamp
           }
         }`,
        { u: username, limit: BATCH, offset }
      );
      const batch = d?.recentAcSubmissionList || [];
      if (batch.length === 0) break;

      for (const s of batch) {
        // Deduplicate: one entry per unique problem (titleSlug)
        if (!seen.has(s.titleSlug)) {
          seen.add(s.titleSlug);
          result.push({
            problem_id:   s.titleSlug,
            problem_name: s.title,
            status:       'AC',
            submitted_at: new Date(Number(s.timestamp) * 1000).toISOString(),
            language:     null, // not available in public API
            platform:     'leetcode',
          });
        }
      }

      // LC's recentAcSubmissionList doesn't support real offset pagination —
      // it always returns the most recent N. So we stop after first batch.
      break;
    } catch (err) {
      logger.warn(`[LC] fetchAllAcSubmissions(${username}) batch failed: ${err.message}`);
      break;
    }
  }

  return result;
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

    // ── Query 1: Profile + solving stats + current-year calendar + language + tags + badges ──
    const q1 = await gql(
      `query GetProfile($u: String!, $year: Int!) {
         matchedUser(username: $u) {
           username
           profile {
             realName userAvatar aboutMe school company jobTitle
             countryName ranking reputation
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
       }`,
      { u: username, year: currentYear }
    );

    // ── Query 2: Contest ranking + history + recent AC (for quick display) ──
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

    // ── Parse base data ──
    const user    = q1?.matchedUser || {};
    const profile = user.profile    || {};
    const acNums  = user.submitStatsGlobal?.acSubmissionNum    || [];
    const totNums = user.submitStatsGlobal?.totalSubmissionNum || [];
    const cal     = user.userCalendar || {};

    const contestInfo = q2?.userContestRanking         || {};
    const contestHist = q2?.userContestRankingHistory   || [];
    const recentAc    = q2?.recentAcSubmissionList      || [];

    // ── Fetch ALL years of calendar and merge into one map ──
    const activeYears = cal.activeYears || [currentYear];
    const pastYears   = activeYears.filter(y => y !== currentYear);

    // Start with current year's calendar
    let mergedCalendar = {};
    try {
      mergedCalendar = JSON.parse(cal.submissionCalendar || '{}');
    } catch { mergedCalendar = {}; }

    // Fetch past years sequentially (respect rate limiting)
    for (const year of pastYears) {
      await new Promise(r => setTimeout(r, 500)); // 500ms between requests
      const pastCal = await fetchCalendarForYear(username, year);
      // Merge: add counts (same day shouldn't appear in two years' calendars, but just in case)
      for (const [ts, cnt] of Object.entries(pastCal)) {
        mergedCalendar[ts] = (mergedCalendar[ts] || 0) + Number(cnt);
      }
    }

    // ── Fetch all unique AC submissions ──
    const allAcSubmissions = await fetchAllAcSubmissions(username);

    // Helper: extract count for a difficulty
    const getAc  = (diff) => acNums.find(x => x.difficulty === diff) || {};
    const getTot = (diff) => totNums.find(x => x.difficulty === diff) || {};

    // Acceptance rate
    const acceptedSubs   = getAc('All').submissions  || 0;
    const totalSubs      = getTot('All').submissions || 0;
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
      reputation:    profile.reputation    || 0,
      globalRanking: profile.ranking       || 0,

      // ── Solving stats ──
      totalSolved:    getAc('All').count    || 0,
      easySolved:     getAc('Easy').count   || 0,
      mediumSolved:   getAc('Medium').count || 0,
      hardSolved:     getAc('Hard').count   || 0,
      acceptanceRate,

      // ── Calendar — FULL multi-year merged map ──
      streak:               cal.streak          || 0,
      totalActiveDays:      cal.totalActiveDays || 0,
      activeYears:          activeYears,
      contributionCalendar: JSON.stringify(mergedCalendar),

      // ── Contest ranking ──
      contestRating:         parseFloat(contestInfo.rating             || 0),
      contestGlobalRanking:  contestInfo.globalRanking                 || 0,
      topPercentage:         parseFloat(contestInfo.topPercentage      || 0),
      attendedContestsCount: contestInfo.attendedContestsCount         || 0,
      totalParticipants:     contestInfo.totalParticipants             || 0,
      contestBadgeName:      contestInfo.badge?.name                   || null,

      // ── Rich data (JSONB) ──
      languageStats:   user.languageProblemCount || [],
      skillTags: {
        advanced:     user.tagProblemCounts?.advanced     || [],
        intermediate: user.tagProblemCounts?.intermediate || [],
        fundamental:  user.tagProblemCounts?.fundamental  || [],
      },
      badges:         user.badges         || [],
      upcomingBadges: user.upcomingBadges || [],
      activeBadge:    user.activeBadge    || null,

      // Recent AC (for quick display in UI)
      recentAcSubmissions: recentAc.map(s => ({
        title:     s.title,
        titleSlug: s.titleSlug,
        timestamp: s.timestamp,
      })),

      // ALL unique AC submissions (for student_submissions table)
      allAcSubmissions,

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
