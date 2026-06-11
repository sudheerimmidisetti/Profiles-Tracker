// backend/src/modules/contest/contest.service.js
// Fetches per-contest detail: problems, user submissions, and where possible, source code.
const axios   = require('axios');
const cheerio = require('cheerio');
const { query } = require('../../config/db');

const CF_API = 'https://codeforces.com/api';
const CC_API = 'https://www.codechef.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':     'application/json, text/html, */*',
};

// ── CODEFORCES ────────────────────────────────────────────────────────────────
// IMPORTANT: CF standings API now blocks ANY extra parameter for non-gym contests.
// Only ?contestId=<id> works. We get the problem list from the public standings
// and per-user submissions from contest.status (which does accept a handle).
async function getCodeforcesDetail(contestId, handle) {
  const [standingsRes, statusRes] = await Promise.all([
    // ⚠ NO extra params — even from/count breaks it
    axios.get(`${CF_API}/contest.standings?contestId=${contestId}`, {
      headers: HEADERS,
      timeout: 15000,
    }).catch(e => { console.warn('[CF standings]', e.message); return null; }),

    // contest.status — handle param IS allowed here
    axios.get(`${CF_API}/contest.status`, {
      params: { contestId, handle, from: 1, count: 300 },
      headers: HEADERS,
      timeout: 15000,
    }).catch(e => { console.warn('[CF status]', e.message); return null; }),
  ]);

  const contestName = standingsRes?.data?.result?.contest?.name || `Contest #${contestId}`;
  const problems = (standingsRes?.data?.result?.problems || []).map(p => ({
    index:  p.index,
    name:   p.name,
    points: p.points || null,
    rating: p.rating || null,
    tags:   p.tags   || [],
    url:    `https://codeforces.com/contest/${contestId}/problem/${p.index}`,
  }));

  // Build submission list for this user
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

  // Build solved map from submission verdicts
  const solved = {};
  submissions.forEach(s => {
    const key = s.problemIndex;
    if (!key) return;
    if (!solved[key]) solved[key] = { accepted: false, attempts: 0 };
    if (s.verdict === 'OK') {
      solved[key].accepted = true;
    } else if (s.verdict !== 'COMPILATION_ERROR') {
      if (!solved[key].accepted) solved[key].attempts++;
    }
  });

  // Fetch source code for ACCEPTED submissions (up to 5)
  const acceptedSubs = submissions.filter(s => s.verdict === 'OK').slice(0, 5);
  await Promise.all(acceptedSubs.map(async sub => {
    try {
      const page = await axios.get(sub.codeUrl, {
        headers: { ...HEADERS, 'Accept': 'text/html' },
        timeout: 8000,
      });
      const $ = cheerio.load(page.data);
      sub.sourceCode =
        $('#program-source-text').text().trim() ||
        $('pre.source-code').text().trim()      ||
        $('pre.prettyprint').text().trim()      || null;
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
    rank:   null,
    points: null,
  };
}

// ── CODECHEF ──────────────────────────────────────────────────────────────────
// CC has no public submissions API that works without authentication.
// Strategy:
//   1. Get problem list from public contest API (works fine)
//   2. Get solved info from DB (codechef_contest_history.problems_solved_count)
//      and from the stored scraper data where available
//   3. Try the /api/rankings endpoint with search for per-problem solved info
async function getCodechefDetail(contestCode, email, dbQuery) {
  // Parallel: contest info + DB data for this user + this contest
  const [contestRes, dbRes] = await Promise.all([
    axios.get(`${CC_API}/api/contests/${contestCode}`, {
      headers: {
        ...HEADERS,
        'Referer': 'https://www.codechef.com',
      },
      timeout: 15000,
    }).catch(e => { console.warn('[CC contest]', e.message); return null; }),

    dbQuery(
      `SELECT h.*, p.username
       FROM codechef_contest_history h
       JOIN codechef_profiles p ON p.student_email = h.student_email
       WHERE h.student_email = $1 AND h.contest_code = $2
       LIMIT 1`,
      [email, contestCode]
    ).catch(() => null),
  ]);

  // Parse problem list from the public contest API
  const raw = contestRes?.data;
  let problems = [];
  if (raw?.problems && typeof raw.problems === 'object') {
    // Sort by problem index if available, else alphabetically
    const entries = Object.entries(raw.problems);
    entries.sort((a, b) => {
      const ia = a[1].index || a[0];
      const ib = b[1].index || b[0];
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
    problems = entries.map(([code, p], i) => ({
      index:  p.index || String.fromCharCode(65 + i),  // A, B, C...
      code,
      name:   p.name || code,
      tags:   p.categories || [],
      url:    `https://www.codechef.com/problems/${code}`,
      successfulSubmissions: p.successful_submissions || null,
    }));
  }

  const dbRow = dbRes?.rows?.[0];
  const handle = dbRow?.username || '';

  // Try CC rankings API to find the user's per-problem results
  // Format: /api/rankings/<contest>?page=1&itemsPerPage=10&order=asc&sortBy=rank&search=<username>
  let rankingRow = null;
  if (handle) {
    try {
      const rankRes = await axios.get(
        `${CC_API}/api/rankings/${contestCode}`,
        {
          params: {
            page: 1,
            itemsPerPage: 50,
            order: 'asc',
            sortBy: 'rank',
            search: handle,
          },
          headers: { ...HEADERS, 'Referer': 'https://www.codechef.com' },
          timeout: 15000,
        }
      );
      const rankList = rankRes.data?.list || rankRes.data?.rankings || [];
      rankingRow = rankList.find(r =>
        (r.user_handle || r.username || '').toLowerCase() === handle.toLowerCase()
      ) || rankList[0] || null;
    } catch (e) {
      console.warn('[CC rankings]', e.message);
    }
  }

  // Build solved map
  // If rankingRow has per-problem results use them, otherwise fall back to count from DB
  const solved = {};
  if (rankingRow?.problems) {
    // Format: { PROBLEMCODE: { score, totalAttempts, pendingAttempts, ... } }
    Object.entries(rankingRow.problems).forEach(([code, pr]) => {
      solved[code] = {
        accepted: (pr.score || 0) > 0 || pr.result === 'AC',
        attempts: pr.totalAttempts || pr.wrongAttempts || 0,
        score:    pr.score || null,
        penalty:  pr.penalty || null,
      };
    });
  } else if (dbRow?.problems_solved_count > 0) {
    // We know count but not which ones — mark first N as solved (best effort)
    const numSolved = Number(dbRow.problems_solved_count);
    problems.slice(0, numSolved).forEach(p => {
      solved[p.code] = { accepted: true, attempts: 1 };
    });
  }

  return {
    platform:    'codechef',
    contestId:   contestCode,
    contestName: raw?.name || dbRow?.contest_name || contestCode,
    handle,
    problems,
    solved,
    submissions: [],  // CC submissions API requires auth — not available
    myData: dbRow ? {
      rank:           dbRow.rank_achieved,
      problemsSolved: dbRow.problems_solved_count,
      ratingAfter:    dbRow.rating_after_contest,
      ratingChange:   dbRow.rating_change,
      division:       dbRow.division,
    } : null,
    note: rankingRow
      ? null
      : (handle
          ? `Submission details require CodeChef authentication. Solved count from our database: ${dbRow?.problems_solved_count ?? '?'} problems.`
          : 'CodeChef submission details require authentication.'),
    platformUrl: `https://www.codechef.com/${contestCode}`,
  };
}

// ── LEETCODE ──────────────────────────────────────────────────────────────────
async function getLeetcodeDetail(contestSlug, email, dbQuery) {
  const LC_GQL = 'https://leetcode.com/graphql/';
  const LC_HEADERS = {
    ...HEADERS,
    'Content-Type': 'application/json',
    Referer: 'https://leetcode.com',
    Origin:  'https://leetcode.com',
  };

  async function lcGql(query, variables = {}) {
    const r = await axios.post(LC_GQL, { query, variables }, { headers: LC_HEADERS, timeout: 10000 });
    return r.data?.data || {};
  }

  // ── 1. Contest history from DB ──
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

  // ── 2. Fetch problem list — 'difficulty' is NOT on ContestQuestionNode, use credit ──
  let questions = [];
  try {
    const d = await lcGql(
      `query contestInfo($titleSlug: String!) {
         contest(titleSlug: $titleSlug) {
           title
           questions { title titleSlug credit }
         }
       }`,
      { titleSlug: contestSlug }
    );
    questions = d?.contest?.questions || [];
  } catch (e) {
    console.warn('[LC contest]', e.message);
  }

  // ── 3. Fetch per-problem difficulty in parallel (Easy / Medium / Hard) ──
  const diffMap = {};
  await Promise.all(questions.map(async q => {
    try {
      const d = await lcGql(
        `query q($slug: String!) { question(titleSlug: $slug) { difficulty } }`,
        { slug: q.titleSlug }
      );
      diffMap[q.titleSlug] = d?.question?.difficulty || null;
    } catch { diffMap[q.titleSlug] = null; }
  }));

  const problems = questions.map((q, i) => ({
    index:      String.fromCharCode(65 + i),
    slug:       q.titleSlug,
    name:       q.title,
    difficulty: diffMap[q.titleSlug] || null,  // Easy / Medium / Hard
    points:     q.credit,                       // Contest score weight (3/4/5/7)
    url:        `https://leetcode.com/problems/${q.titleSlug}/`,
  }));

  // ── 4. Check student_submissions table to find which problems user solved ──
  // student_submissions stores titleSlug as problem_id for LC
  let solved = {};
  const slugs = problems.map(p => p.slug).filter(Boolean);
  if (email && slugs.length > 0) {
    try {
      const subsRes = await dbQuery(
        `SELECT problem_id, submitted_at FROM student_submissions
         WHERE student_email = $1
           AND platform = 'leetcode'
           AND problem_id = ANY($2)
         ORDER BY submitted_at ASC`,
        [email, slugs]
      );
      // Mark each matched problem as solved
      for (const sub of (subsRes?.rows || [])) {
        solved[sub.problem_id] = { accepted: true, attempts: 1 };
      }
    } catch (e) {
      console.warn('[LC solved-check]', e.message);
    }
  }

  // Also build solved map indexed by A/B/C/D for the ProblemsTab component
  // which uses problem.index as the key
  const solvedByIndex = {};
  problems.forEach(p => {
    const bySlug = solved[p.slug];
    if (bySlug) solvedByIndex[p.index] = bySlug;
  });

  const numSolved = Number(row?.problems_solved) || Object.keys(solvedByIndex).length;

  return {
    platform:     'leetcode',
    contestId:    contestSlug,
    contestName:  row?.contest_title || contestSlug,
    handle:       row?.username || '',
    problems,
    submissions:  [],
    solved:       solvedByIndex,  // Now populated from student_submissions DB!
    myData: row ? {
      rank:           row.rank_achieved,
      problemsSolved: numSolved,
      totalProblems:  row.total_problems,
      finishTime:     row.finish_time_seconds,
      rating:         row.rating_after_contest,
      trendDirection: row.trend_direction,
    } : null,
    note: numSolved > 0
      ? `Solved ${numSolved}/${row?.total_problems ?? problems.length} problems in this contest.`
      : `Solved ${numSolved}/${row?.total_problems ?? problems.length} problems. Run a sync to update solved status.`,
    platformUrl: `https://leetcode.com/contest/${contestSlug}/`,
  };
}


module.exports = { getCodeforcesDetail, getCodechefDetail, getLeetcodeDetail };
