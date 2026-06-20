// backend/src/modules/contests/contests.service.js
// Aggregates past contest data from the three history tables and fetches
// upcoming contests from LC / CF / CC public APIs.
'use strict';

const axios = require('axios');
const { query } = require('../../config/db');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function weekBounds(offsetWeeks = 0) {
  // Sun–Sat IST week
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const dow = nowIST.getUTCDay(); // 0=Sun … 6=Sat
  const sun = new Date(nowIST);
  sun.setUTCDate(nowIST.getUTCDate() - dow + offsetWeeks * 7);
  sun.setUTCHours(0, 0, 0, 0);
  const sat = new Date(sun);
  sat.setUTCDate(sun.getUTCDate() + 6);
  sat.setUTCHours(23, 59, 59, 999);
  // Convert back to UTC for DB comparisons
  return {
    start: new Date(sun - IST_OFFSET_MS),
    end:   new Date(sat - IST_OFFSET_MS),
  };
}

// ─── Upcoming contests (public APIs) ─────────────────────────────────────────

async function fetchUpcomingLeetcode() {
  try {
    const r = await axios.post(
      'https://leetcode.com/graphql',
      {
        query: `{ upcomingContests { title titleSlug startTime duration } }`,
      },
      { headers: { 'Content-Type': 'application/json', Origin: 'https://leetcode.com' }, timeout: 8000 }
    );
    return (r.data?.data?.upcomingContests || []).map(c => ({
      platform:    'leetcode',
      contestId:   c.titleSlug,
      name:        c.title,
      startTime:   new Date(c.startTime * 1000).toISOString(),
      durationMin: Math.round(c.duration / 60),
      url:         `https://leetcode.com/contest/${c.titleSlug}/`,
      status:      'upcoming',
      participants: 0,
    }));
  } catch { return []; }
}

async function fetchUpcomingCodeforces(start, end) {
  try {
    const r = await axios.get('https://codeforces.com/api/contest.list?gym=false', { timeout: 8000 });
    return (r.data?.result || [])
      .filter(c => {
        if (c.phase !== 'BEFORE' || !c.startTimeSeconds) return false;
        const st = c.startTimeSeconds * 1000;
        return st >= start.getTime() && st <= end.getTime();
      })
      .map(c => ({
        platform:    'codeforces',
        contestId:   String(c.id),
        name:        c.name,
        startTime:   new Date(c.startTimeSeconds * 1000).toISOString(),
        durationMin: Math.round(c.durationSeconds / 60),
        url:         `https://codeforces.com/contest/${c.id}`,
        status:      'upcoming',
        participants: 0,
      }));
  } catch { return []; }
}

async function fetchUpcomingCodechef(start, end) {
  // Try multiple CodeChef endpoints — the /future endpoint sometimes returns empty
  const CC_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', timeout: 10000 };
  let raw = [];

  // Endpoint 1: official future contests
  try {
    const r = await axios.get('https://www.codechef.com/api/list/contests/future', { headers: CC_HEADERS });
    const list = r.data?.future_contests || [];
    if (list.length) raw = list;
  } catch (_) {}

  // Endpoint 2: broader contests API with category=future (different key structure)
  if (!raw.length) {
    try {
      const r = await axios.get('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all', { headers: CC_HEADERS });
      const all = [
        ...(r.data?.future_contests || []),
        ...(r.data?.present_contests || []),
      ];
      if (all.length) raw = all;
    } catch (_) {}
  }

  return raw
    .filter(c => {
      const st = new Date(c.contest_start_date_iso || c.contest_start_date).getTime();
      return !isNaN(st) && st >= start.getTime() && st <= end.getTime();
    })
    .map(c => ({
      platform:    'codechef',
      contestId:   c.contest_code,
      name:        c.contest_name,
      startTime:   c.contest_start_date_iso || c.contest_start_date,
      durationMin: c.contest_duration ? Math.round(Number(c.contest_duration)) : null,
      url:         `https://www.codechef.com/${c.contest_code}`,
      status:      'upcoming',
      participants: 0,
    }));
}

// ─── Past contests from DB ────────────────────────────────────────────────────

async function fetchPastLeetcode(startUTC, endUTC) {
  const res = await query(
    `SELECT
       contest_title   AS name,
       MIN(LOWER(REPLACE(contest_title, ' ', '-'))) AS contest_id,
       COUNT(DISTINCT student_email)                 AS participants,
       MIN(contest_time)                             AS start_unix
     FROM leetcode_contest_history
     WHERE contest_time >= $1 AND contest_time <= $2
     GROUP BY contest_title
     ORDER BY MIN(contest_time) DESC`,
    [Math.floor(startUTC.getTime() / 1000), Math.floor(endUTC.getTime() / 1000)]
  );
  return res.rows.map(r => ({
    platform:     'leetcode',
    contestId:    r.contest_id,
    name:         r.name,
    startTime:    r.start_unix ? new Date(Number(r.start_unix) * 1000).toISOString() : null,
    durationMin:  90,
    url:          `https://leetcode.com/contest/${r.contest_id}/`,
    status:       'past',
    participants: Number(r.participants),
  }));
}

async function fetchPastCodeforces(startUTC, endUTC) {
  const res = await query(
    `SELECT
       contest_id,
       contest_name                     AS name,
       COUNT(DISTINCT student_email)    AS participants,
       MIN(timestamp_seconds)           AS start_unix
     FROM codeforces_contest_history
     WHERE timestamp_seconds >= $1 AND timestamp_seconds <= $2
     GROUP BY contest_id, contest_name
     ORDER BY MIN(timestamp_seconds) DESC`,
    [Math.floor(startUTC.getTime() / 1000), Math.floor(endUTC.getTime() / 1000)]
  );
  return res.rows.map(r => ({
    platform:     'codeforces',
    contestId:    String(r.contest_id),
    name:         r.name,
    startTime:    r.start_unix ? new Date(Number(r.start_unix) * 1000).toISOString() : null,
    durationMin:  null,
    url:          `https://codeforces.com/contest/${r.contest_id}`,
    status:       'past',
    participants: Number(r.participants),
  }));
}

async function fetchPastCodechef(startUTC, endUTC) {
  // CodeChef history doesn't store a timestamp — use contest_date column if available
  const res = await query(
    `SELECT
       contest_code                     AS contest_id,
       MIN(contest_name)                AS name,
       COUNT(DISTINCT student_email)    AS participants,
       MIN(contest_date)                AS contest_date
     FROM codechef_contest_history
     WHERE contest_date >= $1 AND contest_date <= $2
     GROUP BY contest_code
     ORDER BY MIN(contest_date) DESC`,
    [startUTC.toISOString().split('T')[0], endUTC.toISOString().split('T')[0]]
  );
  return res.rows.map(r => ({
    platform:     'codechef',
    contestId:    r.contest_id,
    name:         r.name || r.contest_id,
    startTime:    r.contest_date ? new Date(r.contest_date).toISOString() : null,
    durationMin:  null,
    url:          `https://www.codechef.com/${r.contest_id}`,
    status:       'past',
    participants: Number(r.participants),
  }));
}

// ── Strip division suffix from contest name ───────────────────────────────────
// e.g. "Codeforces Round 987 (Div. 2)" → "Codeforces Round 987"
// e.g. "Starters 243 Division 1" → "Starters 243"
function baseContestName(name = '') {
  return name
    .replace(/\s*\(Div\.?\s*\d+[^)]*\)/gi, '')
    .replace(/\s*Division\s*\d+/gi, '')
    .replace(/\s*Div\.?\s*\d+/gi, '')
    .trim();
}

// ─── Public API: list contests ────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {string}  opts.platform   - 'all' | 'leetcode' | 'codeforces' | 'codechef'
 * @param {number}  opts.weekOffset - 0 = current, -1 = last week, etc.
 */
async function listContests({ platform = 'all', weekOffset = 0 } = {}) {
  const { start, end } = weekBounds(weekOffset);
  const isCurrentWeek  = weekOffset === 0;

  const lcFilter = !platform || platform === 'all' || platform === 'leetcode';
  const cfFilter = !platform || platform === 'all' || platform === 'codeforces';
  const ccFilter = !platform || platform === 'all' || platform === 'codechef';

  // Fetch past contests from DB in parallel
  const [lcPast, cfPast, ccPast] = await Promise.all([
    lcFilter ? fetchPastLeetcode(start, end)    : [],
    cfFilter ? fetchPastCodeforces(start, end)  : [],
    ccFilter ? fetchPastCodechef(start, end)    : [],
  ]);

  // ── Group CF past by base name (collapse Div 1/2/3/4 of same round) ─────────
  const cfGrouped = [];
  const cfSeen = new Map();
  for (const c of cfPast) {
    const base = baseContestName(c.name);
    if (cfSeen.has(base)) {
      // Merge: accumulate participants, keep earliest startTime, collect contestIds
      const existing = cfSeen.get(base);
      existing.participants += c.participants;
      existing._contestIds.push(c.contestId);
      if (c.startTime && (!existing.startTime || c.startTime < existing.startTime)) {
        existing.startTime = c.startTime;
      }
    } else {
      const entry = { ...c, name: base, _contestIds: [c.contestId] };
      cfSeen.set(base, entry);
      cfGrouped.push(entry);
    }
  }

  // ── Group CC past by base name too ──────────────────────────────────────────
  const ccGrouped = [];
  const ccSeen = new Map();
  for (const c of ccPast) {
    const base = baseContestName(c.name);
    if (ccSeen.has(base)) {
      const existing = ccSeen.get(base);
      existing.participants += c.participants;
      existing._contestIds.push(c.contestId);
    } else {
      const entry = { ...c, name: base, _contestIds: [c.contestId] };
      ccSeen.set(base, entry);
      ccGrouped.push(entry);
    }
  }

  // Upcoming — only fetch for current week, filtered to Sun–Sat range
  let upcoming = [];
  if (isCurrentWeek) {
    const [lcUp, cfUp, ccUp] = await Promise.all([
      lcFilter ? fetchUpcomingLeetcode()            : [],
      cfFilter ? fetchUpcomingCodeforces(start, end) : [],
      ccFilter ? fetchUpcomingCodechef(start, end)   : [],
    ]);

    // Also filter LC to this week
    const lcUpFiltered = lcUp.filter(c => {
      const st = new Date(c.startTime).getTime();
      return st >= start.getTime() && st <= end.getTime();
    });

    upcoming = [...lcUpFiltered, ...cfUp, ...ccUp]
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }

  const past = [...lcPast, ...cfGrouped, ...ccGrouped]
    .sort((a, b) => new Date(b.startTime || 0) - new Date(a.startTime || 0));

  return { upcoming, past, week: { start: start.toISOString(), end: end.toISOString() } };
}

// ─── Contest participants ─────────────────────────────────────────────────────

async function getContestParticipants(platform, contestId, cohortId = null) {
  // contestId may be a comma-separated list for grouped contests
  const ids = String(contestId).split(',').map(s => s.trim()).filter(Boolean);
  // cohortId is injected inline into each query via JS template literals
  if (platform === 'leetcode') {
    const res = await query(
      `SELECT
         ch.student_email,
         s.full_name,
         s.roll_number,
         s.branch,
         pp.username,
         ch.rank_achieved,
         ch.problems_solved,
         ch.total_problems,
         ch.rating_after_contest,
         ch.finish_time_seconds,
         ch.trend_direction,
         ch.contest_title    AS contest_name
       FROM leetcode_contest_history ch
       JOIN students s           ON s.email = ch.student_email
       JOIN platform_profiles pp ON pp.student_email = ch.student_email
                                 AND pp.platform_name = 'leetcode'
       ${cohortId ? 'JOIN cohort_members cm ON cm.student_email = ch.student_email AND cm.cohort_id = ' + cohortId : ''}
       WHERE LOWER(REPLACE(ch.contest_title, ' ', '-')) = LOWER($1)
         AND s.is_blocklisted = FALSE
       ORDER BY ch.rank_achieved ASC NULLS LAST`,
      [contestId]
    );
    return res.rows.map((r, i) => ({
      cohortRank:      i + 1,
      email:           r.student_email,
      name:            r.full_name,
      rollNumber:      r.roll_number,
      branch:          r.branch,
      handle:          r.username,
      globalRank:      r.rank_achieved,
      problemsSolved:  r.problems_solved,
      totalProblems:   r.total_problems,
      ratingAfter:     r.rating_after_contest != null ? Math.round(r.rating_after_contest) : null,
      ratingBefore:    null, // LC doesn't store rating_before in history
      ratingChange:    null,
      finishTime:      r.finish_time_seconds,
      trend:           r.trend_direction,
      contestName:     r.contest_name,
      platform:        'leetcode',
    }));
  }

  if (platform === 'codeforces') {
    const intIds = ids.map(id => parseInt(id, 10)).filter(n => !isNaN(n));
    const res = await query(
      `SELECT
         ch.student_email,
         s.full_name,
         s.roll_number,
         s.branch,
         pp.username,
         ch.rank_achieved,
         ch.old_rating,
         ch.new_rating,
         ch.rating_change,
         ch.problems_solved,
         ch.contest_name,
         ch.division
       FROM codeforces_contest_history ch
       JOIN students s           ON s.email = ch.student_email
       JOIN platform_profiles pp ON pp.student_email = ch.student_email
                                 AND pp.platform_name = 'codeforces'
       ${cohortId ? 'JOIN cohort_members cm ON cm.student_email = ch.student_email AND cm.cohort_id = ' + cohortId : ''}
       WHERE ch.contest_id = ANY($1)
         AND s.is_blocklisted = FALSE
       ORDER BY ch.rank_achieved ASC NULLS LAST`,
      [intIds]
    );
    return res.rows.map((r, i) => ({
      cohortRank:      i + 1,
      email:           r.student_email,
      name:            r.full_name,
      rollNumber:      r.roll_number,
      branch:          r.branch,
      handle:          r.username,
      globalRank:      r.rank_achieved,
      problemsSolved:  r.problems_solved,
      totalProblems:   null,
      ratingBefore:    r.old_rating,
      ratingAfter:     r.new_rating,
      ratingChange:    r.rating_change,
      finishTime:      null,
      trend:           r.rating_change >= 0 ? 'UP' : 'DOWN',
      contestName:     r.contest_name,
      division:        r.division,
      platform:        'codeforces',
    }));
  }

  if (platform === 'codechef') {
    const res = await query(
      `SELECT
         ch.student_email,
         s.full_name,
         s.roll_number,
         s.branch,
         s.college,
         pp.username,
         ch.rank_achieved,
         ch.rating_after_contest,
         ch.rating_change,
         ch.problems_solved_count,
         ch.contest_name,
         ch.division
       FROM codechef_contest_history ch
       JOIN students s           ON s.email = ch.student_email
       JOIN platform_profiles pp ON pp.student_email = ch.student_email
                                 AND pp.platform_name = 'codechef'
       ${cohortId ? 'JOIN cohort_members cm ON cm.student_email = ch.student_email AND cm.cohort_id = ' + cohortId : ''}
       WHERE ch.contest_code = ANY($1)
         AND s.is_blocklisted = FALSE
       ORDER BY ch.rank_achieved ASC NULLS LAST`,
      [ids]
    );
    return res.rows.map((r, i) => ({
      cohortRank:      i + 1,
      email:           r.student_email,
      name:            r.full_name,
      rollNumber:      r.roll_number,
      branch:          r.branch,
      college:         r.college,
      handle:          r.username,
      globalRank:      r.rank_achieved,
      problemsSolved:  r.problems_solved_count,
      totalProblems:   null,
      ratingBefore:    r.rating_after_contest != null && r.rating_change != null
                         ? r.rating_after_contest - r.rating_change : null,
      ratingAfter:     r.rating_after_contest,
      ratingChange:    r.rating_change,
      finishTime:      null,
      trend:           r.rating_change >= 0 ? 'UP' : 'DOWN',
      contestName:     r.contest_name,
      division:        r.division,
      platform:        'codechef',
    }));
  }

  throw new Error(`Unknown platform: ${platform}`);
}

module.exports = { listContests, getContestParticipants, fetchContestCalendar, getAllStudentEmails };

// ─── Contest Calendar: upcoming contests for next N weeks ─────────────────────

async function fetchContestCalendar(weeks = 4) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const dow = nowIST.getUTCDay();
  const weekStart = new Date(nowIST);
  weekStart.setUTCDate(nowIST.getUTCDate() - dow);
  weekStart.setUTCHours(0, 0, 0, 0);
  const start = new Date(weekStart - IST_OFFSET_MS);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + weeks * 7);
  weekEnd.setUTCHours(23, 59, 59, 999);
  const end = new Date(weekEnd - IST_OFFSET_MS);

  const [lcRaw, cfRaw, ccRaw] = await Promise.allSettled([
    axios.post('https://leetcode.com/graphql',
      { query: '{ upcomingContests { title titleSlug startTime duration } }' },
      { headers: { 'Content-Type': 'application/json', Origin: 'https://leetcode.com' }, timeout: 8000 }
    ),
    axios.get('https://codeforces.com/api/contest.list?gym=false', { timeout: 8000 }),
    axios.get('https://www.codechef.com/api/list/contests/future',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 }
    ),
  ]);

  const contests = [];
  const nowMs = Date.now();

  if (lcRaw.status === 'fulfilled') {
    for (const c of lcRaw.value.data?.data?.upcomingContests || []) {
      const st = c.startTime * 1000;
      if (st >= start.getTime() && st <= end.getTime()) {
        contests.push({
          platform: 'leetcode', contestId: c.titleSlug, name: c.title,
          startTime: new Date(st).toISOString(), durationMin: Math.round(c.duration / 60),
          url: `https://leetcode.com/contest/${c.titleSlug}/`,
          status: st > nowMs ? 'upcoming' : 'past',
        });
      }
    }
  }

  if (cfRaw.status === 'fulfilled') {
    for (const c of cfRaw.value.data?.result || []) {
      if (!c.startTimeSeconds) continue;
      const st = c.startTimeSeconds * 1000;
      if (st < start.getTime() || st > end.getTime()) continue;
      if (c.phase !== 'BEFORE' && c.phase !== 'CODING') continue;
      // Use FULL name in calendar (not stripped) so "Codeforces Round 987 (Div. 2)" shows correctly
      contests.push({
        platform: 'codeforces', contestId: String(c.id), name: c.name,
        startTime: new Date(st).toISOString(), durationMin: Math.round(c.durationSeconds / 60),
        url: `https://codeforces.com/contest/${c.id}`,
        status: st > nowMs ? 'upcoming' : 'ongoing',
      });
    }
  }

  if (ccRaw.status === 'fulfilled') {
    // CodeChef may return contests under future_contests or present_contests
    const ccContests = [
      ...(ccRaw.value.data?.future_contests || []),
      ...(ccRaw.value.data?.present_contests || []),
    ];
    for (const c of ccContests) {
      const st = new Date(c.contest_start_date_iso || c.contest_start_date).getTime();
      if (isNaN(st) || st < start.getTime() || st > end.getTime()) continue;
      contests.push({
        platform: 'codechef', contestId: c.contest_code, name: c.contest_name,
        startTime: new Date(st).toISOString(),
        durationMin: c.contest_duration ? Math.round(Number(c.contest_duration)) : null,
        url: `https://www.codechef.com/${c.contest_code}`,
        status: st > nowMs ? 'upcoming' : 'ongoing',
      });
    }
  }

  contests.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  return contests;
}

async function getAllStudentEmails() {
  const res = await query(
    `SELECT DISTINCT s.email FROM students s WHERE s.is_blocklisted = FALSE AND s.email IS NOT NULL`
  );
  return res.rows.map(r => r.email);
}
