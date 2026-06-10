// src/scrapers/hackerrank.scraper.js
// Uses HackerRank's public REST API (no auth required for public profiles).
// Primary: GET /rest/contests/master/hackers/{username}/profile
// Secondary: GET /rest/hackers/{username}/scores  (returns LIST directly)
// Third:     GET /rest/hackers/{username}/recent_challenges
const axios  = require('axios');
const logger = require('../utils/logger');

const BASE = 'https://www.hackerrank.com/rest';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':     'application/json',
  'Referer':    'https://www.hackerrank.com',
};

async function hrGet(path) {
  const { data } = await axios.get(`${BASE}${path}`, { headers: HEADERS, timeout: 15000 });
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

// ── Domain badge star mapping from ELO score ─────────────────────────────────
// HackerRank assigns stars based on score thresholds per domain
const STAR_THRESHOLDS = {
  'problem_solving': [30, 100, 200, 475, 850, 2200],
  'algorithms':      [30, 100, 200, 475, 850],
  'data-structures': [30, 100, 200, 475, 850],
  'python':          [35, 70, 110, 220, 400],
  'java':            [25, 50, 80,  150, 250],
  'cpp':             [10, 40, 70,  150, 250],
  'c':               [10, 40, 70,  150, 250],
  'javascript':      [30, 70, 110, 220, 400],
  'ruby':            [35, 100,200, 350, 550],
  'sql':             [80, 175,300, 450, 650],
  'shell':           [10, 40, 80,  150, 250],
  'regex':           [20, 40, 80,  150, 250],
  '30daysofcode':    [2,  7,  15,  22,  30],
  'fp':              [10, 30, 80,  150, 250],
  'ai':              [10, 40, 100, 200, 350],
};

function scoreToStars(slug, score) {
  const thresholds = STAR_THRESHOLDS[slug] || [50, 150, 300, 500, 800];
  let stars = 0;
  for (const t of thresholds) {
    if (score >= t) stars++;
    else break;
  }
  return stars;
}

// ── Full profile ───────────────────────────────────────────────────────────────
async function getFullProfile(username) {
  try {
    // 1. Primary profile
    const profileResp = await hrGet(
      `/contests/master/hackers/${encodeURIComponent(username)}/profile`
    );
    const model = profileResp?.model || {};
    await sleep(1500);

    // 2. Per-track scores — RETURNS A LIST DIRECTLY (not {models:[]})
    let trackScoresList = [];
    let badgesFromScores = [];
    try {
      const scoresData = await hrGet(`/hackers/${encodeURIComponent(username)}/scores`);
      // scoresData is an array: [{name, slug, practice:{score, rank}, contest:{...}}, ...]
      const scoresList = Array.isArray(scoresData) ? scoresData : [];
      
      trackScoresList = scoresList.map(t => {
        const slug  = t.slug || t.name?.toLowerCase().replace(/\s+/g, '-') || '';
        const score = parseFloat(t.practice?.score || 0);
        const rank  = parseInt(t.practice?.rank || 0, 10);
        const stars = scoreToStars(slug, score);
        return { track: slug, name: t.name || slug, score, rank, stars };
      });

      // Build badge objects from scores
      badgesFromScores = trackScoresList
        .filter(t => t.score > 0)
        .map(t => ({
          type:              t.track,
          name:              t.name,
          stars:             t.stars,
          current_points:    t.score,
          next_level_points: (STAR_THRESHOLDS[t.track] || [])[t.stars] || 0,
          tier:              t.stars > 0 ? `${t.stars}★` : null,
        }));
    } catch (e) {
      logger.warn(`[HR] scores unavailable for ${username}: ${e.message}`);
    }
    await sleep(1500);

    // 3. Recent challenges (submissions)
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
    const medals    = model.medals    || {};
    const social    = model.social_links || {};

    // Helper to get stars + score from trackScoresList by slug
    const getTrackScore = slug => trackScoresList.find(t => t.track === slug) || { score: 0, rank: 0, stars: 0 };

    // Domain stars from track scores
    const psTrack  = getTrackScore('problem_solving');
    const algTrack = getTrackScore('algorithms');
    const dsTrack  = getTrackScore('data-structures');
    const pyTrack  = getTrackScore('python');
    const javaTrack= getTrackScore('java');
    const cppTrack = getTrackScore('cpp');
    const jsTrack  = getTrackScore('javascript');
    const sqlTrack = getTrackScore('sql');
    const rubyTrack= getTrackScore('ruby');

    // Derived: problem_solving = max of algo + ds if no direct track
    const psStar  = psTrack.stars  || Math.max(algTrack.stars,  dsTrack.stars);
    const psScore = psTrack.score  || (algTrack.score + dsTrack.score);

    // Submission stats
    const acceptedCount = recentSubmissions.filter(s =>
      (s.status || '').toLowerCase().includes('accept') ||
      (s.status || '').toLowerCase() === 'solved'
    ).length;
    const acceptanceRate = recentSubmissions.length > 0
      ? parseFloat(((acceptedCount / recentSubmissions.length) * 100).toFixed(2)) : 0;

    // Total points = sum of all track scores
    const totalPointsCalc = trackScoresList.reduce((acc, t) => acc + (t.score || 0), 0);
    const totalPoints = totalPointsCalc > 0 ? totalPointsCalc : parseFloat(model.current_points || model.points || 0);

    // Certificates from profile (model may have them)
    const certificates = (model.certificates || []).map(c => ({
      title:           c.title           || '',
      slug:            c.slug            || '',
      level:           c.level           || '',
      issued_at:       c.created_at      || c.issued_at || null,
      certificate_url: c.certificate_url || null,
      status:          'passed',
    }));

    return {
      username:            model.username     || username,
      displayName:         model.name         || model.personal_first_name ? 
                           `${model.personal_first_name || ''} ${model.personal_last_name || ''}`.trim() : null,
      avatarUrl:           model.avatar       || null,
      country:             model.country      || null,
      city:                null,
      school:              model.school       || null,
      jobsHeadline:        model.jobs_headline || model.job_title || null,
      about:               model.short_bio    || null,
      graduationYear:      null,
      createdAtHr:         model.created_at   || null,
      // Social
      linkedinUrl:         social.linkedin || model.linkedin_url || null,
      githubUrl:           social.github   || model.github_url   || null,
      website:             social.website  || model.website       || null,
      twitterUrl:          social.twitter  || null,
      // Social graph
      followersCount:      parseInt(model.followers_count || 0, 10),
      followingCount:      0,
      // Rankings
      totalPoints,
      leaderboardRank:     0,
      level:               parseInt(model.level || 0, 10),
      eloRating:           1500,
      contestPoints:       0,
      globalRank:          0,
      // Medals (not publicly exposed in API)
      medalsGold:          parseInt(medals.gold   || 0, 10),
      medalsSilver:        parseInt(medals.silver || 0, 10),
      medalsBronze:        parseInt(medals.bronze || 0, 10),
      contestsParticipated: 0,
      // Submission stats
      submissionsCount:    parseInt(model.submissions_count || 0, 10),
      acceptedSubmissions: acceptedCount,
      acceptanceRate,
      // Domain stars
      problemSolvingStars:  psStar,
      problemSolvingScore:  Math.round(psScore),
      cppStars:             cppTrack.stars,
      javaStars:            javaTrack.stars,
      pythonStars:          pyTrack.stars,
      sqlStars:             sqlTrack.stars,
      rubyStars:            rubyTrack.stars,
      jsStars:              jsTrack.stars,
      sqlScore:             Math.round(sqlTrack.score),
      algorithmsScore:      Math.round(algTrack.score),
      dsScore:              Math.round(dsTrack.score),
      // JSONB
      badges:          badgesFromScores,
      certificates,
      trackScores:     trackScoresList,
      // Submissions
      recentSubmissions,
    };
  } catch (err) {
    logger.error(`[HR] getFullProfile failed for ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { getDisplayName, getFullProfile };
