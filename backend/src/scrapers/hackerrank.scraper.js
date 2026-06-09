// src/scrapers/hackerrank.scraper.js
// Uses HackerRank's public REST API (no auth required for public profiles).
// Primary: GET /rest/contests/master/hackers/{username}/profile
// Secondary: GET /rest/hackers/{username}/recent_challenges
// Third:     GET /rest/hackers/{username}/scores  (per-track rankings)
const axios  = require('axios');
const logger = require('../utils/logger');

const BASE = 'https://www.hackerrank.com/rest';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':     'application/json',
};

async function hrGet(path) {
  const { data } = await axios.get(`${BASE}${path}`, { headers: HEADERS, timeout: 12000 });
  return data;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Verification ───────────────────────────────────────────────────────────────
async function getDisplayName(username) {
  try {
    const data = await hrGet(`/contests/master/hackers/${encodeURIComponent(username)}/profile`);
    return data?.model?.name?.trim() || null;
  } catch (err) {
    logger.warn(`[HR] getDisplayName failed for ${username}: ${err.message}`);
    return null;
  }
}

// ── Badge helper ───────────────────────────────────────────────────────────────
function getBadge(badges, slug) {
  const b = badges.find(b => b.type === slug || b.badge_id === slug || b.name?.toLowerCase() === slug);
  return b || null;
}
function getBadgeStars(badges, slug) {
  return getBadge(badges, slug)?.stars || 0;
}
function getBadgeScore(badges, slug) {
  return getBadge(badges, slug)?.current_points || 0;
}

// Domain slug map for track_scores
const TRACK_SLUGS = [
  'algorithms', 'data-structures', 'mathematics', 'databases', 'sql',
  'shell', 'fp', 'regex', 'python', 'java', 'c', 'cpp', 'javascript',
  'ruby', 'ai', 'security', '30daysofcode',
];

// ── Full profile ───────────────────────────────────────────────────────────────
async function getFullProfile(username) {
  try {
    // 1. Primary profile
    const profileResp = await hrGet(
      `/contests/master/hackers/${encodeURIComponent(username)}/profile`
    );
    const model = profileResp?.model || {};
    await sleep(1500);

    // 2. Per-track scores (gives rank + score per domain)
    let trackScores = [];
    try {
      const scoresResp = await hrGet(`/hackers/${encodeURIComponent(username)}/scores`);
      const raw = scoresResp?.models || scoresResp?.data || [];
      trackScores = raw.map(t => ({
        track:  t.track || t.slug || '',
        rank:   parseInt(t.rank  || 0, 10),
        score:  parseFloat(t.score || 0),
        solved: parseInt(t.solved || 0, 10),
      }));
    } catch (e) {
      logger.warn(`[HR] scores unavailable for ${username}: ${e.message}`);
    }
    await sleep(1500);

    // 3. Recent submissions (challenges)
    let recentSubmissions = [];
    try {
      const subResp = await hrGet(`/hackers/${encodeURIComponent(username)}/recent_challenges`);
      const challenges = subResp?.models || [];
      recentSubmissions = challenges.slice(0, 50).map(c => ({
        challengeSlug: c.slug       || '',
        challengeName: c.name       || '',
        language:      c.language   || null,
        status:        c.status     || null,
        score:         parseFloat(c.score || 0),
        track:         c.track      || c.domain || null,
        difficulty:    c.difficulty || null,
        submittedAt:   c.created_at || null,
      }));
    } catch (e) {
      logger.warn(`[HR] recent_challenges unavailable for ${username}: ${e.message}`);
    }

    // ── Parse model fields ──────────────────────────────────────────────────────
    const badges       = model.badges       || [];
    const certificates = model.certificates || [];
    const scoresElo    = model.scores_elo   || {};
    const medals       = model.medals       || {};

    // Clean badges for storage
    const badgesClean = badges.map(b => ({
      type:             b.type        || b.badge_id || '',
      name:             b.name        || '',
      stars:            parseInt(b.stars || 0, 10),
      current_points:   parseFloat(b.current_points  || 0),
      next_level_points: parseFloat(b.next_level_points || 0),
      tier:             b.tier        || null,
    }));

    // Clean certificates for storage
    const certsClean = certificates.map(c => ({
      title:           c.title           || '',
      slug:            c.slug            || '',
      level:           c.level           || '',
      issued_at:       c.created_at      || c.issued_at || null,
      certificate_url: c.certificate_url || null,
      status:          c.status          || 'passed',
    }));

    // Domain score helpers
    const getEloScore = slug => parseFloat(scoresElo[slug] || 0);

    // Submission stats derived from recent_submissions
    const acceptedCount = recentSubmissions.filter(s =>
      (s.status || '').toLowerCase().includes('accept') ||
      (s.status || '').toLowerCase() === 'solved'
    ).length;
    const acceptanceRate = recentSubmissions.length > 0
      ? parseFloat(((acceptedCount / recentSubmissions.length) * 100).toFixed(2)) : 0;

    // Social links
    const social = model.social_links || {};

    return {
      username:            model.username     || username,
      displayName:         model.name         || null,
      avatarUrl:           model.avatar       || null,
      country:             model.country      || null,
      city:                model.city         || null,
      school:              model.school       || null,
      jobsHeadline:        model.jobs_headline || null,
      about:               model.about        || null,
      graduationYear:      model.graduation_year || null,
      createdAtHr:         model.created_at   || null,
      // Social
      linkedinUrl:         social.linkedin || model.linkedin_url || null,
      githubUrl:           social.github   || model.github_url   || null,
      website:             social.website  || model.website       || null,
      twitterUrl:          social.twitter  || model.twitter_url  || null,
      // Social graph
      followersCount:      parseInt(model.followers_count || 0, 10),
      followingCount:      parseInt(model.following_count || 0, 10),
      // Rankings
      totalPoints:         parseFloat(model.points          || model.current_points || 0),
      leaderboardRank:     parseInt(model.leaderboard_rank  || model.hacker_rank   || 0, 10),
      level:               parseInt(model.level             || 0, 10),
      eloRating:           parseFloat(model.elo_rating      || 1500),
      contestPoints:       parseFloat(model.contest_points  || 0),
      globalRank:          parseInt(model.country_rank      || 0, 10),
      // Medals
      medalsGold:          parseInt(medals.gold   || 0, 10),
      medalsSilver:        parseInt(medals.silver || 0, 10),
      medalsBronze:        parseInt(medals.bronze || 0, 10),
      contestsParticipated: parseInt(model.num_contests_participated || 0, 10),
      // Submission stats
      submissionsCount:    parseInt(model.submissions_count || 0, 10),
      acceptedSubmissions: acceptedCount,
      acceptanceRate,
      // Domain stars (from badges array)
      problemSolvingStars:  getBadgeStars(badges, 'problem_solving'),
      problemSolvingScore:  getBadgeScore(badges, 'problem_solving'),
      cppStars:             getBadgeStars(badges, 'cpp'),
      javaStars:            getBadgeStars(badges, 'java'),
      pythonStars:          getBadgeStars(badges, 'python'),
      sqlStars:             getBadgeStars(badges, 'sql'),
      rubyStars:            getBadgeStars(badges, 'ruby'),
      jsStars:              getBadgeStars(badges, 'javascript'),
      sqlScore:             Math.round(getEloScore('sql')),
      algorithmsScore:      Math.round(getEloScore('algorithms')),
      dsScore:              Math.round(getEloScore('data-structures')),
      // JSONB
      badges:          badgesClean,
      certificates:    certsClean,
      trackScores:     trackScores.length ? trackScores : TRACK_SLUGS.map(slug => ({
        track: slug,
        rank:  0,
        score: Math.round(getEloScore(slug)),
        solved: 0,
      })),
      // Submissions
      recentSubmissions,
    };
  } catch (err) {
    logger.error(`[HR] getFullProfile failed for ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
