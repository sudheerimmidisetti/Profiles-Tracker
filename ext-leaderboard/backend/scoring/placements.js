// scoring/placements.js
// External Placements Leaderboard — adapted from main project's placements.scorer.js
//
// KEY DIFFERENCE from main project:
//   Codeforces (20pts) is absent → weight redistributed:
//     LeetCode  = 40 pts  (was 30, +10)
//     CodeChef  = 40 pts  (was 30, +10)
//     HackerRank = 20 pts (unchanged)
//     TOTAL     = 100 pts
//
// Since we have static profile data (not per-submission history), we estimate
// UDG points from Easy/Medium/Hard profile counts directly.

'use strict';

const { STATIC_LC_PTS } = require('./udg');

// ── Weights ───────────────────────────────────────────────────────────────────
const WEIGHTS = { lc: 40, cc: 40, hr: 20 };

// ── Benchmarks (effective points at 100%) ────────────────────────────────────
const LC_BENCHMARK = 450;  // same as main project
const CC_BENCHMARK = 350;  // same as main project

// ── LC rating anchors → level score (0–1) ────────────────────────────────────
const LC_ANCHORS = [
  [1400, 0.05], [1500, 0.20], [1600, 0.35], [1700, 0.50],
  [1800, 0.65], [1900, 0.80], [2100, 0.95], [9999, 1.0],
];

// ── CC stars → level score (0–1) ─────────────────────────────────────────────
const CC_STAR_L = [0, 0.10, 0.25, 0.45, 0.65, 0.80, 0.95];

function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }

function lerp(anchors, val) {
  if (!val || val <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    if (val <= anchors[i][0]) {
      const [x0, y0] = anchors[i - 1];
      const [x1, y1] = anchors[i];
      return y0 + (y1 - y0) * ((val - x0) / (x1 - x0));
    }
  }
  return anchors[anchors.length - 1][1];
}

// ── LeetCode Score (40 pts total = 20 problem + 20 contest) ──────────────────
function lcScore(lcData) {
  if (!lcData) return { score: 0, prob: 0, contest: 0, detail: {} };

  const maxTotal   = WEIGHTS.lc;        // 40
  const maxProb    = maxTotal * 0.5;    // 20
  const maxContest = maxTotal * 0.5;    // 20

  // ── Problem score ─────────────────────────────────────────────────────────
  // Estimate raw UDG points from Easy/Medium/Hard counts
  const rawPts = (lcData.easy_solved   || 0) * STATIC_LC_PTS.Easy
               + (lcData.medium_solved || 0) * STATIC_LC_PTS.Medium
               + (lcData.hard_solved   || 0) * STATIC_LC_PTS.Hard;

  // Consistency factor: since we don't have per-week data, use a softer
  // static factor based on total solve count (more problems → more consistent)
  const total = lcData.total_solved || 0;
  const cf    = total >= 300 ? 0.85
              : total >= 150 ? 0.75
              : total >= 50  ? 0.65
              : 0.55;

  const effective = rawPts * cf;
  const ratio     = clamp(effective / LC_BENCHMARK);
  const probScore = maxProb * Math.pow(ratio, 0.7);

  // ── Contest score ─────────────────────────────────────────────────────────
  // P: Participation (40% weight within contest) — expected ~20 contests
  const P = clamp((lcData.contest_count || 0) / 20);
  // L: Absolute level from rating (60% weight).
  // If student has never participated, L = 0 (not the lerp floor of 0.05)
  const L = (lcData.contest_count || 0) > 0
    ? lerp(LC_ANCHORS, lcData.contest_rating || 0)
    : 0;
  const contestScore = maxContest * (0.40 * P + 0.60 * L);

  const total_score = +(probScore + contestScore).toFixed(4);

  return {
    score:   total_score,
    prob:    +probScore.toFixed(4),
    contest: +contestScore.toFixed(4),
    detail: {
      easy_solved:    lcData.easy_solved   || 0,
      medium_solved:  lcData.medium_solved || 0,
      hard_solved:    lcData.hard_solved   || 0,
      total_solved:   total,
      rawPts:         +rawPts.toFixed(2),
      effective:      +effective.toFixed(2),
      cf,
      ratio:          +ratio.toFixed(4),
      contest_rating: lcData.contest_rating || 0,
      contest_count:  lcData.contest_count  || 0,
      P: +P.toFixed(4), L: +L.toFixed(4),
    },
  };
}

// ── CodeChef Score (40 pts total = 20 problem + 20 contest) ──────────────────
function ccScore(ccData) {
  if (!ccData) return { score: 0, prob: 0, contest: 0, detail: {} };

  const maxTotal   = WEIGHTS.cc;
  const maxProb    = maxTotal * 0.5;    // 20
  const maxContest = maxTotal * 0.5;    // 20

  // ── Problem score ─────────────────────────────────────────────────────────
  // CC problems — most are T3-ish. Estimate avg 4 pts per problem solved.
  const problems = ccData.problems_solved || 0;
  const rawPts   = problems * 4;  // T3 = 4 pts average

  // Static consistency factor based on count
  const cf = problems >= 400 ? 0.80
           : problems >= 200 ? 0.70
           : problems >= 100 ? 0.60
           : 0.50;

  const effective = rawPts * cf;
  const ratio     = clamp(effective / CC_BENCHMARK);
  const probScore = maxProb * Math.pow(ratio, 0.7);

  // ── Contest score ─────────────────────────────────────────────────────────
  // P: Participation — expected ~18 contests
  const P = clamp((ccData.contest_count || 0) / 18);
  // L: Absolute level from stars
  const stars = ccData.stars || 0;
  const L     = CC_STAR_L[Math.min(stars, 6)] || 0;
  const contestScore = maxContest * (0.40 * P + 0.60 * L);

  const total_score = +(probScore + contestScore).toFixed(4);

  return {
    score:   total_score,
    prob:    +probScore.toFixed(4),
    contest: +contestScore.toFixed(4),
    detail: {
      problems_solved: problems,
      current_rating:  ccData.current_rating || 0,
      stars,
      rawPts:          +rawPts.toFixed(2),
      effective:       +effective.toFixed(2),
      cf, ratio:       +ratio.toFixed(4),
      contest_count:   ccData.contest_count || 0,
      P: +P.toFixed(4), L: +L.toFixed(4),
    },
  };
}

// ── HackerRank Score (20 pts — same as main project) ─────────────────────────
function hrScore(hrData) {
  if (!hrData) return { score: 0, detail: {} };

  const PS_PTS = [0, 1, 2, 3, 5, 7, 10];
  const psStars  = clamp(hrData.problem_solving_stars || 0, 0, 6);
  const sqlStars = clamp(hrData.sql_stars             || 0, 0, 5);
  const javStars = clamp(hrData.java_stars            || 0, 0, 5);
  const pytStars = clamp(hrData.python_stars          || 0, 0, 5);

  const ps     = PS_PTS[psStars] || 0;
  const sql    = sqlStars * 0.7;
  const java   = javStars * 0.7;
  const python = pytStars * 0.6;
  const raw    = ps + sql + java + python;
  // Max raw = 10 + 3.5 + 3.5 + 3.0 = 20
  const score  = clamp(raw, 0, 20);

  return {
    score: +score.toFixed(4),
    detail: {
      psStars, sqlStars, javStars, pytStars,
      ps, sql, java, python,
    },
  };
}

// ── Full Placements Score for one student ─────────────────────────────────────
function computeScore(student) {
  const lc = lcScore(student.lc_data);
  const cc = ccScore(student.cc_data);
  const hr = hrScore(student.hr_data);

  const total = clamp(lc.score + cc.score + hr.score, 0, 100);

  return {
    student_id: student.student_id,
    lc_handle:  student.lc_handle,
    cc_handle:  student.cc_handle,
    hr_handle:  student.hr_handle,
    total_score: +total.toFixed(4),
    lc_score:    lc.score,
    cc_score:    cc.score,
    hr_score:    hr.score,
    lc_prob:     lc.prob,
    lc_contest:  lc.contest,
    cc_prob:     cc.prob,
    cc_contest:  cc.contest,
    lc_detail:   lc.detail,
    cc_detail:   cc.detail,
    hr_detail:   hr.detail,
  };
}

module.exports = { computeScore };
