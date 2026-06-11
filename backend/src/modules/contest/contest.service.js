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
// Strategy:
//   1. Problem list from /api/contests/{contestCode} (public)
//   2. Problem difficulty_rating from /api/contests/{code}/problems/{pCode} per problem
//   3. User solved: scraped from /recent/user?user_handle={handle} (HTML table,
//      filtered to this contest code — scores like (100) = accepted)
async function getCodechefDetail(contestCode, email, dbQuery) {
  const CC_HEADERS = {
    ...HEADERS,
    'Referer': `https://www.codechef.com/${contestCode}`,
    'Accept':  'application/json, text/html, */*',
  };

  // ── 1. Parallel: contest info + DB row ──
  const [contestRes, dbRes] = await Promise.all([
    axios.get(`${CC_API}/api/contests/${contestCode}`, {
      headers: CC_HEADERS, timeout: 15000,
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

  // ── 2. Parse problem list ──
  const raw = contestRes?.data;
  let problems = [];
  if (raw?.problems && typeof raw.problems === 'object' && !Array.isArray(raw.problems)) {
    const entries = Object.entries(raw.problems);
    entries.sort((a, b) => {
      const ia = a[1].index || a[0];
      const ib = b[1].index || b[0];
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
    problems = entries.map(([code, p], i) => ({
      index:  p.index || String.fromCharCode(65 + i),
      code,
      name:   p.name || code,
      tags:   p.categories || [],
      url:    `https://www.codechef.com/problems/${code}`,
      successfulSubmissions: p.successful_submissions || null,
      accuracy: p.accuracy || null,
    }));
  }

  const dbRow = dbRes?.rows?.[0];
  const handle = dbRow?.username || '';

  // ── 3. Fetch problem difficulty_rating in parallel ──
  // GET /api/contests/{contestCode}/problems/{problemCode} → { difficulty_rating }
  if (problems.length > 0) {
    await Promise.all(problems.map(async p => {
      try {
        const r = await axios.get(
          `${CC_API}/api/contests/${contestCode}/problems/${p.code}`,
          { headers: CC_HEADERS, timeout: 8000 }
        );
        const dr = r.data?.difficulty_rating;
        // -1 means unrated; positive number is the actual difficulty rating
        p.difficulty_rating = (dr != null && Number(dr) > 0) ? Number(dr) : null;
      } catch {
        p.difficulty_rating = null;
      }
    }));
  }

  // ── 4. Scrape user submissions from /recent/user to find which problems solved ──
  // The endpoint returns HTML with rows: [time, problem_code, score, language, view]
  // Links embed the contest code e.g. href="/START242D/problems/EQMNG"
  let solved = {};
  if (handle) {
    try {
      const MAX_PAGES = 5; // Each page = 20 rows, 5 pages = 100 recent submissions
      let page = 0;
      let found = false;

      while (page < MAX_PAGES) {
        const recentRes = await axios.get(`${CC_API}/recent/user`, {
          params: { page, user_handle: handle },
          headers: { ...CC_HEADERS, 'Accept': 'application/json' },
          timeout: 10000,
        });

        const html = recentRes.data?.content || '';
        if (!html || html.trim() === '<') break;

        const $ = cheerio.load(html);
        let rowsOnPage = 0;

        $('table tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 3) return;

          const linkEl    = $(cells[1]).find('a').first();
          const href      = linkEl.attr('href') || '';
          const probCode  = href.split('/problems/')[1] || $(cells[1]).text().trim();
          const scoreText = $(cells[2]).text().trim(); // e.g. "(100)" or "(0)"
          const lang      = $(cells[3]).text().trim();

          // Only count submissions for THIS contest
          if (!href.includes(`/${contestCode}/`)) return;

          rowsOnPage++;
          found = true;

          // Score > 0 means at least partial credit (for starters, 100 = full AC)
          const scoreMatch = scoreText.match(/\((\d+)\)/);
          const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

          if (!solved[probCode]) {
            solved[probCode] = { accepted: false, attempts: 0, score: 0 };
          }
          solved[probCode].attempts++;
          if (score > 0 && score > (solved[probCode].score || 0)) {
            solved[probCode].score    = score;
            solved[probCode].accepted = score >= 100; // 100 = full AC in IOI-style
          }
        });

        // If we already found this contest's rows and next page has none, stop
        if (found && rowsOnPage === 0) break;
        // If we never find this contest on several pages, stop early
        if (!found && page >= 2) break;
        page++;

        // Small delay between pages
        if (page < MAX_PAGES) await new Promise(r => setTimeout(r, 300));
      }
    } catch (e) {
      console.warn('[CC recent/user]', e.message);
    }
  }

  // Fallback: if recent/user had no data but DB has count, mark first N as solved
  if (Object.keys(solved).length === 0 && (dbRow?.problems_solved_count || 0) > 0) {
    const numSolved = Number(dbRow.problems_solved_count);
    problems.slice(0, numSolved).forEach(p => {
      solved[p.code] = { accepted: true, attempts: 1, score: 100 };
    });
  }

  const solvedCount = Object.values(solved).filter(s => s.accepted).length;

  return {
    platform:    'codechef',
    contestId:   contestCode,
    contestName: raw?.name || dbRow?.contest_name || contestCode,
    handle,
    problems,
    solved,
    submissions: [],
    myData: dbRow ? {
      rank:           dbRow.rank_achieved,
      problemsSolved: dbRow.problems_solved_count || solvedCount,
      ratingAfter:    dbRow.rating_after_contest,
      ratingChange:   dbRow.rating_change,
      division:       dbRow.division,
    } : null,
    note: handle
      ? `Solved ${solvedCount}/${problems.length} problems.`
      : 'CodeChef submission details require a synced profile.',
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
