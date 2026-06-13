// scrapers/hr.js
// HackerRank public REST API — same approach as main project.
'use strict';

const axios = require('axios');

const BASE    = 'https://www.hackerrank.com/rest';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':     'application/json',
  'Referer':    'https://www.hackerrank.com',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function hrGet(path) {
  const { data } = await axios.get(`${BASE}${path}`, { headers: HEADERS, timeout: 15000 });
  return data;
}

const STAR_THRESHOLDS = {
  'problem_solving': [30, 100, 200, 475, 850, 2200],
  'python':          [35, 70,  110, 220, 400],
  'java':            [25, 50,  80,  150, 250],
  'sql':             [80, 175, 300, 450, 650],
};

function scoreToStars(slug, score) {
  const thresholds = STAR_THRESHOLDS[slug] || [50, 150, 300, 500, 800];
  let stars = 0;
  for (const t of thresholds) { if (score >= t) stars++; else break; }
  return stars;
}

async function fetchHRProfile(username) {
  if (!username) return null;
  try {
    const profileResp = await hrGet(`/contests/master/hackers/${encodeURIComponent(username)}/profile`);
    const model = profileResp?.model || {};
    await sleep(800);

    // Track scores
    let trackScores = {};
    try {
      const scoresData = await hrGet(`/hackers/${encodeURIComponent(username)}/scores`);
      const list = Array.isArray(scoresData) ? scoresData
        : (Array.isArray(scoresData?.models) ? scoresData.models : []);

      for (const track of list) {
        const score = track?.practice?.score || track?.score || 0;
        if (track.slug) trackScores[track.slug] = score;
      }
    } catch { /* track scores optional */ }

    const psScore  = trackScores['problem_solving'] || trackScores['algorithms'] || 0;
    const sqlScore = trackScores['sql']  || 0;
    const javaScore= trackScores['java'] || 0;
    const pyScore  = trackScores['python'] || 0;

    return {
      username,
      problem_solving_stars: scoreToStars('problem_solving', psScore),
      sql_stars:             scoreToStars('sql', sqlScore),
      java_stars:            scoreToStars('java', javaScore),
      python_stars:          scoreToStars('python', pyScore),
      total_score:           model.points || 0,
      badges_count:          model.badges_count || 0,
    };
  } catch (err) {
    console.error(`[HR] ${username}: ${err.message}`);
    return null;
  }
}

module.exports = { fetchHRProfile };
