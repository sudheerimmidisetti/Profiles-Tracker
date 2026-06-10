// backend/src/modules/contest/contest.service.js
// Fetches per-contest detail: problems, user submissions, and where possible, source code.
const axios = require('axios');
const cheerio = require('cheerio');

// ── helpers ───────────────────────────────────────────────────────────────────
const CF_API = 'https://codeforces.com/api';
const CC_API = 'https://www.codechef.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
};

// ── CODEFORCES ────────────────────────────────────────────────────────────────
// NOTE: CF API does NOT allow filtering standings by handle for non-gym contests
// (non-admin users). We use the anonymous public standings for the problem list
// and contest.status (which DOES accept a handle) for the user's submissions.
async function getCodeforcesDetail(contestId, handle) {
  const [standingsRes, statusRes] = await Promise.all([
    // Public standings (no handles param) — gives us contest name + problem list
    axios.get(`${CF_API}/contest.standings`, {
      params: { contestId, from: 1, count: 1 },   // ← no handles param
      headers: HEADERS,
      timeout: 15000,
    }).catch(e => {
      console.warn('[CF standings]', e.message);
      return null;
    }),
    // User's own submissions in this contest — handles param is fine here
    axios.get(`${CF_API}/contest.status`, {
      params: { contestId, handle, from: 1, count: 300 },
      headers: HEADERS,
      timeout: 15000,
    }).catch(e => {
      console.warn('[CF status]', e.message);
      return null;
    }),
  ]);

  const contestName = standingsRes?.data?.result?.contest?.name || `Contest #${contestId}`;
  const problems = (standingsRes?.data?.result?.problems || []).map(p => ({
    index:  p.index,
    name:   p.name,
    points: p.points || null,
    rating: p.rating || null,
    tags:   p.tags || [],
    url:    `https://codeforces.com/contest/${contestId}/problem/${p.index}`,
  }));

  // All submissions by user in this contest
  const rawSubs = statusRes?.data?.result || [];
  const submissions = rawSubs.map(s => ({
    id:           s.id,
    problemIndex: s.problem?.index,
    problemName:  s.problem?.name,
    verdict:      s.verdict,
    language:     s.programmingLanguage,
    timeMs:       s.timeConsumedMillis,
    memoryBytes:  s.memoryConsumedBytes,
    passedTests:  s.passedTestCount,
    timestamp:    s.creationTimeSeconds * 1000,
    codeUrl:      `https://codeforces.com/contest/${contestId}/submission/${s.id}`,
  }));

  // Build solved map from submissions (not from standings, which we can't filter by handle)
  const solved = {};
  submissions.forEach(s => {
    const key = s.problemIndex;
    if (!key) return;
    if (!solved[key]) solved[key] = { accepted: false, attempts: 0, points: null };
    if (s.verdict === 'OK') {
      solved[key].accepted = true;
    } else if (s.verdict !== 'COMPILATION_ERROR') {
      solved[key].attempts++;
    }
  });

  // Fetch source code for ACCEPTED submissions (up to 5 to avoid rate limits)
  const acceptedSubs = submissions.filter(s => s.verdict === 'OK').slice(0, 5);
  await Promise.all(acceptedSubs.map(async sub => {
    try {
      const page = await axios.get(sub.codeUrl, {
        headers: { ...HEADERS, 'Accept': 'text/html' },
        timeout: 8000,
      });
      const $ = cheerio.load(page.data);
      const code = $('#program-source-text').text().trim() ||
                   $('pre.source-code').text().trim()     ||
                   $('pre.prettyprint').text().trim();
      sub.sourceCode = code || null;
    } catch {
      sub.sourceCode = null;
    }
  }));

  return {
    platform:    'codeforces',
    contestId,
    contestName,
    handle,
    problems,
    solved,
    submissions,
    rank:   null,   // can't get from public standings without handle
    points: null,
  };
}

// ── CODECHEF ──────────────────────────────────────────────────────────────────
async function getCodechefDetail(contestCode, handle) {
  // Fetch contest info and user submissions in parallel
  const [contestRes, subsRes] = await Promise.all([
    axios.get(`${CC_API}/api/contests/${contestCode}`, {
      headers: HEADERS,
      timeout: 15000,
    }).catch(e => { console.warn('[CC contest]', e.message); return null; }),
    // CodeChef submissions API with handle
    axios.get(`${CC_API}/api/submissions`, {
      params: { contestCode, handle, language: 'all', status: 'all', page: 1, itemsPerPage: 50 },
      headers: HEADERS,
      timeout: 15000,
    }).catch(e => { console.warn('[CC subs]', e.message); return null; }),
  ]);

  // Parse problem list
  const raw = contestRes?.data;
  let problems = [];
  if (raw?.problems && typeof raw.problems === 'object') {
    problems = Object.values(raw.problems).map(p => ({
      code:  p.code || p.problem_code,
      name:  p.name || p.problem_name,
      tags:  p.categories || [],
      url:   `https://www.codechef.com/problems/${p.code || p.problem_code}`,
    }));
  } else if (Array.isArray(raw?.problem_list)) {
    problems = raw.problem_list.map(p => ({
      code: p.problem_code || p.code,
      name: p.problem_name || p.name,
      tags: [],
      url:  `https://www.codechef.com/problems/${p.problem_code || p.code}`,
    }));
  }

  // Parse submissions
  const rawSubs = subsRes?.data?.data || subsRes?.data?.submissions || subsRes?.data?.list || [];
  const submissions = Array.isArray(rawSubs) ? rawSubs.map(s => ({
    id:          s.id || s.submission_id,
    problemCode: s.problemCode || s.problem_code,
    problemName: s.problemName || s.problem_name,
    verdict:     s.result || s.status || s.verdict,
    language:    s.language,
    timeMs:      s.time ? Math.round(Number(s.time) * 1000) : null,
    score:       s.score || null,
    timestamp:   s.date ? new Date(s.date).getTime() : null,
    codeUrl:     `https://www.codechef.com/submit/${contestCode}/${s.problemCode || s.problem_code}`,
  })) : [];

  // Build solved map
  const solved = {};
  submissions.forEach(s => {
    const code = s.problemCode;
    if (!code) return;
    if (!solved[code]) solved[code] = { accepted: false, attempts: 0 };
    solved[code].attempts++;
    const v = (s.verdict || '').toUpperCase();
    if (v === 'AC' || v === 'ACCEPTED' || v === 'FULLY SOLVED' || v === 'CORRECT') {
      solved[code].accepted = true;
    }
  });

  return {
    platform:    'codechef',
    contestId:   contestCode,
    contestName: raw?.name || raw?.contest_name || contestCode,
    handle,
    problems,
    solved,
    submissions,
  };
}

// ── LEETCODE ──────────────────────────────────────────────────────────────────
async function getLeetcodeDetail(contestSlug, email, dbQuery) {
  // Normalize slug: "Weekly Contest 399" → "weekly-contest-399"
  const normalizeSlug = s => s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Get contest history row from DB
  const dbRes = await dbQuery(
    `SELECT ch.*, lp.username
     FROM leetcode_contest_history ch
     JOIN leetcode_profiles lp ON lp.student_email = ch.student_email
     WHERE ch.student_email = $1
       AND (LOWER(REPLACE(ch.contest_title, ' ', '-')) = LOWER($2)
            OR ch.contest_title ILIKE '%' || $3 || '%')
     LIMIT 1`,
    [email, contestSlug, contestSlug.replace(/-/g, ' ')]
  );
  const row = dbRes?.rows?.[0];

  // Try to fetch problem list from LeetCode public GraphQL (no auth needed for contest questions)
  let problems = [];
  try {
    const gqlRes = await axios.post(
      'https://leetcode.com/graphql/',
      {
        query: `query contestInfo($titleSlug: String!) {
          contest(titleSlug: $titleSlug) {
            title
            questions { title titleSlug difficulty credit }
          }
        }`,
        variables: { titleSlug: contestSlug },
      },
      {
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json',
          Referer: 'https://leetcode.com',
          Origin:  'https://leetcode.com',
        },
        timeout: 10000,
      }
    );
    const questions = gqlRes.data?.data?.contest?.questions || [];
    problems = questions.map((q, i) => ({
      index:      String.fromCharCode(65 + i),   // A, B, C, D
      slug:       q.titleSlug,
      name:       q.title,
      difficulty: q.difficulty,
      points:     q.credit,
      url:        `https://leetcode.com/problems/${q.titleSlug}/`,
    }));
  } catch (e) {
    console.warn('[LC graphql]', e.message);
  }

  // Build a partial solved map from what we have stored
  // LC doesn't give per-problem solved status without auth, but we know how many were solved
  const solved = {};
  if (row && problems.length > 0) {
    const numSolved = Number(row.problems_solved) || 0;
    // Mark the first N problems as solved (best estimate without auth)
    // This is approximate — we just show which problems were "possibly solved"
    // The real indicator should be the count in the KPI row
    // Don't try to guess individual verdicts
  }

  const platformUrl = `https://leetcode.com/contest/${contestSlug}/`;

  return {
    platform:     'leetcode',
    contestId:    contestSlug,
    contestName:  row?.contest_title || contestSlug,
    handle:       row?.username || '',
    problems,
    submissions:  [],   // requires auth
    solved,
    myData: row ? {
      rank:           row.rank_achieved,
      problemsSolved: row.problems_solved,
      totalProblems:  row.total_problems,
      finishTime:     row.finish_time_seconds,
      rating:         row.rating_after_contest,
      trendDirection: row.trend_direction,
    } : null,
    note: `LeetCode submissions require you to be logged in. Showing public contest data only. You solved ${row?.problems_solved ?? '?'}/${row?.total_problems ?? '?'} problems.`,
    platformUrl,
  };
}

module.exports = { getCodeforcesDetail, getCodechefDetail, getLeetcodeDetail };
