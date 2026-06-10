// backend/src/modules/contest/contest.service.js
// Fetches per-contest detail: problems, user submissions, and where possible, source code.
const axios = require('axios');
const cheerio = require('cheerio');

// ── helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CF_API = 'https://codeforces.com/api';
const CC_API = 'https://www.codechef.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
};

// ── CODEFORCES ────────────────────────────────────────────────────────────────
async function getCodeforcesDetail(contestId, handle) {
  const [standingsRes, statusRes] = await Promise.all([
    axios.get(`${CF_API}/contest.standings`, {
      params: { contestId, handles: handle, showUnofficial: true, from: 1, count: 1 },
      headers: HEADERS,
      timeout: 12000,
    }).catch(() => null),
    axios.get(`${CF_API}/contest.status`, {
      params: { contestId, handle, from: 1, count: 200 },
      headers: HEADERS,
      timeout: 12000,
    }).catch(() => null),
  ]);

  const contestName = standingsRes?.data?.result?.contest?.name || '';
  const problems    = (standingsRes?.data?.result?.problems || []).map(p => ({
    index:   p.index,
    name:    p.name,
    points:  p.points || null,
    rating:  p.rating || null,
    tags:    p.tags || [],
  }));

  // User's solved problems from standings row
  const myRow = standingsRes?.data?.result?.rows?.[0];
  const solved = {};
  (myRow?.problemResults || []).forEach((pr, idx) => {
    const key = problems[idx]?.index;
    if (key) solved[key] = {
      accepted: pr.points > 0,
      attempts: pr.rejectedAttemptCount,
      points:   pr.points,
      bestSubmissionTimeSeconds: pr.bestSubmissionTimeSeconds || null,
    };
  });

  // All submissions in this contest by the user
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

  // Fetch source code for the ACCEPTED submissions (up to 5 to avoid rate limits)
  const acceptedSubs = submissions.filter(s => s.verdict === 'OK').slice(0, 5);
  await Promise.all(acceptedSubs.map(async sub => {
    try {
      const page = await axios.get(sub.codeUrl, {
        headers: {
          ...HEADERS,
          'Accept': 'text/html',
        },
        timeout: 8000,
      });
      const $ = cheerio.load(page.data);
      const code = $('#program-source-text').text().trim() ||
                   $('pre.source-code').text().trim() ||
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
    rank:        myRow?.rank || null,
    points:      myRow?.points || null,
  };
}

// ── CODECHEF ──────────────────────────────────────────────────────────────────
async function getCodechefDetail(contestCode, handle) {
  const [contestRes, subsRes] = await Promise.all([
    axios.get(`${CC_API}/api/contests/${contestCode}`, {
      headers: HEADERS,
      timeout: 12000,
    }).catch(() => null),
    axios.get(`${CC_API}/api/submissions`, {
      params: {
        contestCode,
        handle,
        language: 'all',
        status: 'all',
        page: 1,
        itemsPerPage: 50,
      },
      headers: HEADERS,
      timeout: 12000,
    }).catch(() => null),
  ]);

  // Parse problems
  const raw = contestRes?.data;
  let problems = [];
  if (raw?.problems) {
    problems = Object.values(raw.problems).map(p => ({
      code:   p.code,
      name:   p.name || p.problem_name,
      points: p.max_timelimit || null,
      tags:   p.categories || [],
      url:    `https://www.codechef.com/problems/${p.code}`,
    }));
  } else if (raw?.problem_list) {
    problems = raw.problem_list.map(p => ({
      code: p.problem_code || p.code,
      name: p.problem_name || p.name,
      tags: [],
      url:  `https://www.codechef.com/problems/${p.problem_code || p.code}`,
    }));
  }

  // Parse submissions
  const rawSubs = subsRes?.data?.data || subsRes?.data?.submissions || [];
  const submissions = Array.isArray(rawSubs) ? rawSubs.map(s => ({
    id:          s.id || s.submission_id,
    problemCode: s.problemCode || s.problem_code,
    problemName: s.problemName || s.problem_name,
    verdict:     s.result || s.status,
    language:    s.language,
    timeMs:      s.time ? Math.round(Number(s.time) * 1000) : null,
    score:       s.score || null,
    timestamp:   s.date ? new Date(s.date).getTime() : null,
    codeUrl:     `https://www.codechef.com/submit/${contestCode}/${s.problemCode || s.problem_code}`,
  })) : [];

  // Mark which problems are solved by user
  const solved = {};
  submissions.forEach(s => {
    const code = s.problemCode;
    if (!solved[code]) solved[code] = { accepted: false, attempts: 0 };
    solved[code].attempts++;
    if (s.verdict === 'AC' || s.verdict === 'accepted' || s.verdict === 'Accepted') {
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
  // Get contest history row from DB for basic info
  const dbRes = await dbQuery(
    `SELECT ch.*, lp.username
     FROM leetcode_contest_history ch
     JOIN leetcode_profiles lp ON lp.student_email = ch.student_email
     WHERE ch.student_email = $1
       AND (LOWER(REPLACE(ch.contest_title, ' ', '-')) = LOWER($2)
            OR LOWER(ch.contest_title) ILIKE '%' || LOWER($2) || '%')
     LIMIT 1`,
    [email, contestSlug]
  );
  const row = dbRes?.rows?.[0];

  // Try to get contest info from LeetCode API (unauthenticated — works for public info)
  let problems = [];
  try {
    const gqlRes = await axios.post(
      'https://leetcode.com/graphql/',
      {
        query: `query contestInfo($titleSlug: String!) {
          contest(titleSlug: $titleSlug) {
            title
            duration
            startTime
            questions { title titleSlug difficulty credit }
          }
        }`,
        variables: { titleSlug: contestSlug },
      },
      {
        headers: { ...HEADERS, 'Content-Type': 'application/json', Referer: 'https://leetcode.com' },
        timeout: 10000,
      }
    );
    const questions = gqlRes.data?.data?.contest?.questions || [];
    problems = questions.map(q => ({
      slug:       q.titleSlug,
      name:       q.title,
      difficulty: q.difficulty,
      points:     q.credit,
      url:        `https://leetcode.com/problems/${q.titleSlug}/`,
    }));
  } catch { /* silent */ }

  // Submissions — LC requires auth so we can't get them
  // Return what we have stored
  return {
    platform:     'leetcode',
    contestId:    contestSlug,
    contestName:  row?.contest_title || contestSlug,
    handle:       row?.username || '',
    problems,
    submissions:  [],
    solved:       {},
    myData: row ? {
      rank:           row.rank_achieved,
      problemsSolved: row.problems_solved,
      totalProblems:  row.total_problems,
      finishTime:     row.finish_time_seconds,
      rating:         row.rating_after_contest,
      trendDirection: row.trend_direction,
    } : null,
    note: 'LeetCode submission details require authentication. View your submissions at leetcode.com.',
    platformUrl: `https://leetcode.com/contest/${contestSlug}/`,
  };
}

module.exports = { getCodeforcesDetail, getCodechefDetail, getLeetcodeDetail };
