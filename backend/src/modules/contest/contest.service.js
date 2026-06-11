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
    rank:          null,
    points:        null,
    // Live solved count from actual submissions (not from DB which may be stale)
    problemsSolvedLive: Object.values(solved).filter(s => s.accepted).length,
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

  // ── 4. Fetch which problems user solved ──
  // Source A: /recent/user HTML scraping (works for recent contests, up to ~300 submissions)
  // Source B: student_submissions table in DB (populated by sync job)
  // The solved map is keyed by PROBLEM CODE (e.g. "EQMNG"), then remapped to INDEX ("A","B"...) below.
  let solvedByCode = {};

  // Source A: /recent/user scraping
  if (handle) {
    try {
      const MAX_PAGES = 15; // 15 pages × 20 rows = 300 submissions
      let page = 0;
      let contestFound = false;
      let pagesWithoutContest = 0;

      while (page < MAX_PAGES) {
        const recentRes = await axios.get(`${CC_API}/recent/user`, {
          params: { page, user_handle: handle },
          headers: { ...CC_HEADERS, 'Accept': 'application/json' },
          timeout: 10000,
        });

        const html      = recentRes.data?.content || '';
        const maxPage   = recentRes.data?.max_page  || 0;
        if (!html || html.trim() === '<') break;

        const $ = cheerio.load(html);
        let contestRowsThisPage = 0;

        $('table tr').each((_, row) => {
          const cells = $(row).find('td');
          if (cells.length < 3) return;

          const linkEl    = $(cells[1]).find('a').first();
          const href      = linkEl.attr('href') || '';
          const scoreText = $(cells[2]).text().trim(); // e.g. "(100)" or "100"

          // Only count submissions for THIS contest
          if (!href.includes(`/${contestCode}/`)) return;

          const probCode = href.split('/problems/')[1]?.split('?')[0]?.trim();
          if (!probCode) return;

          contestRowsThisPage++;
          contestFound = true;

          const scoreMatch = scoreText.match(/(\d+)/);
          const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

          if (!solvedByCode[probCode]) {
            solvedByCode[probCode] = { accepted: false, attempts: 0, score: 0 };
          }
          solvedByCode[probCode].attempts++;
          if (score > (solvedByCode[probCode].score || 0)) {
            solvedByCode[probCode].score    = score;
            solvedByCode[probCode].accepted = score >= 100;
          }
        });

        // Stop scanning early: if we found the contest and this page had none, we've passed it
        if (contestFound && contestRowsThisPage === 0) { pagesWithoutContest++; if (pagesWithoutContest >= 2) break; }
        else pagesWithoutContest = 0;

        // Hard stop if next page doesn't exist
        if (page >= maxPage) break;
        page++;
        if (page < MAX_PAGES) await new Promise(r => setTimeout(r, 200));
      }
    } catch (e) {
      console.warn('[CC recent/user]', e.message);
    }
  }

  // Source B: student_submissions DB (real problem codes stored by sync job)
  // Only useful if the scraper now stores real CC problem codes (not fake cc-date-N IDs)
  const problemCodes = problems.map(p => p.code).filter(Boolean);
  if (email && problemCodes.length > 0) {
    try {
      const dbSubs = await dbQuery(
        `SELECT problem_id, status FROM student_submissions
         WHERE student_email = $1
           AND platform = 'codechef'
           AND problem_id = ANY($2)`,
        [email, problemCodes]
      );
      for (const sub of (dbSubs?.rows || [])) {
        if (!solvedByCode[sub.problem_id]) {
          solvedByCode[sub.problem_id] = { accepted: true, attempts: 1, score: 100 };
        } else if (!solvedByCode[sub.problem_id].accepted) {
          solvedByCode[sub.problem_id].accepted = true;
          solvedByCode[sub.problem_id].score    = 100;
        }
      }
    } catch (e) {
      console.warn('[CC db-check]', e.message);
    }
  }

  // ── 5. Remap solved: code→index for ProblemsTab (which uses p.index "A","B"... as key) ──
  // Build BOTH mappings so the panel works regardless of which key it uses:
  //   solved["A"] = ... AND solved["EQMNG"] = ...
  const solved = { ...solvedByCode }; // keep code-based entries too
  problems.forEach(p => {
    const byCode = solvedByCode[p.code];
    if (byCode) solved[p.index] = byCode;  // add index-based entry
  });

  // Fallback: no data at all but DB says N problems solved — mark first N by index
  const solvedCount = problems.filter(p => solved[p.index]?.accepted).length;
  if (solvedCount === 0 && (dbRow?.problems_solved_count || 0) > 0) {
    const numSolved = Number(dbRow.problems_solved_count);
    problems.slice(0, numSolved).forEach(p => {
      solved[p.index] = { accepted: true, attempts: 1, score: 100 };
      solved[p.code]  = { accepted: true, attempts: 1, score: 100 };
    });
  }

  const finalSolvedCount = problems.filter(p => solved[p.index]?.accepted).length
    || (dbRow?.problems_solved_count || 0);

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
      problemsSolved: finalSolvedCount,
      ratingAfter:    dbRow.rating_after_contest,
      ratingChange:   dbRow.rating_change,
      // Include division from DB (may be null if not detected from name)
      division:       dbRow.division || null,
      // CC has no finish_time in DB — show total problems instead
      totalProblems:  problems.length,
    } : null,
    note: handle
      ? `Solved ${finalSolvedCount}/${problems.length} problems in this contest.`
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

  // ── 4. Determine which problems user solved in this contest ──
  // Strategy (in order of priority):
  //   a) Cross-reference problem slugs with student_submissions filtered to contest time window
  //   b) Cross-reference with recent_ac_submissions JSON from LC profile (has timestamps)
  //   c) Fallback: if DB says N problems solved, mark first N by index
  let solvedByIndex = {};
  const slugs = problems.map(p => p.slug).filter(Boolean);
  const contestTimeMs = row?.contest_time ? Number(row.contest_time) * 1000 : null;

  if (email && slugs.length > 0) {
    try {
      // a) DB student_submissions — only count if submitted WITHIN contest window
      //    contest_time is Unix seconds; contests last ~1.5h so use 2h window
      const windowSql = contestTimeMs
        ? `AND submitted_at >= to_timestamp($3) AND submitted_at <= to_timestamp($3) + INTERVAL '2 hours'`
        : '';
      const params = contestTimeMs
        ? [email, slugs, Number(row.contest_time)]
        : [email, slugs];

      const subsRes = await dbQuery(
        `SELECT problem_id FROM student_submissions
         WHERE student_email = $1
           AND platform = 'leetcode'
           AND problem_id = ANY($2)
           ${windowSql}
         ORDER BY submitted_at ASC`,
        params
      );

      for (const sub of (subsRes?.rows || [])) {
        const prob = problems.find(p => p.slug === sub.problem_id);
        if (prob) solvedByIndex[prob.index] = { accepted: true, attempts: 1 };
      }
    } catch (e) {
      console.warn('[LC solved-check window]', e.message);
    }
  }

  // b) Cross-reference recent_ac_submissions JSON (already on the profile)
  if (Object.keys(solvedByIndex).length === 0 && row) {
    try {
      const lcProfileRes = await dbQuery(
        `SELECT recent_ac_submissions FROM leetcode_profiles WHERE student_email = $1 LIMIT 1`,
        [email]
      );
      const recentRaw = lcProfileRes?.rows?.[0]?.recent_ac_submissions;
      const recentSubs = recentRaw
        ? (typeof recentRaw === 'string' ? JSON.parse(recentRaw) : recentRaw)
        : [];

      // Filter to submissions near the contest time (±2h window)
      if (contestTimeMs) {
        const windowStart = contestTimeMs;
        const windowEnd   = contestTimeMs + 2 * 60 * 60 * 1000;
        for (const sub of recentSubs) {
          const subMs = Number(sub.timestamp) * 1000;
          if (subMs >= windowStart && subMs <= windowEnd) {
            const prob = problems.find(p => p.slug === sub.titleSlug);
            if (prob) solvedByIndex[prob.index] = { accepted: true, attempts: 1 };
          }
        }
      }
    } catch (e) {
      console.warn('[LC recent_ac cross-ref]', e.message);
    }
  }

  // c) Final fallback: DB says N solved — mark first N problems by index
  const numSolvedDb = Number(row?.problems_solved) || 0;
  if (Object.keys(solvedByIndex).length === 0 && numSolvedDb > 0) {
    problems.slice(0, numSolvedDb).forEach(p => {
      solvedByIndex[p.index] = { accepted: true, attempts: 1 };
    });
  }

  const numSolved = Object.values(solvedByIndex).filter(s => s.accepted).length || numSolvedDb;

  return {
    platform:     'leetcode',
    contestId:    contestSlug,
    contestName:  row?.contest_title || contestSlug,
    handle:       row?.username || '',
    problems,
    submissions:  [],
    solved:       solvedByIndex,
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
      : `Solved 0/${row?.total_problems ?? problems.length} problems. Run a sync to update.`,
    platformUrl: `https://leetcode.com/contest/${contestSlug}/`,
  };
}


module.exports = { getCodeforcesDetail, getCodechefDetail, getLeetcodeDetail };
