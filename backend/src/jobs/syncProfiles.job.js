// backend/src/jobs/syncProfiles.job.js
// Nightly cron: scrapes all 4 platforms for every verified, non-blocklisted student
// and upserts platform tables + inserts daily snapshots for analytics charts.
//
// ⚠️  MULTI-INSTANCE SAFE: Uses Redis distributed lock so only ONE EC2 instance
// runs the sync when deployed behind an Auto Scaling Group.
const cron   = require('node-cron');
const { query, getClient } = require('../config/db');
const redis  = require('../config/redis');   // ← for distributed lock
const logger = require('../utils/logger');

const leetcodeScraper  = require('../scrapers/leetcode.scraper');
const codeforcesScraper = require('../scrapers/codeforces.scraper');
const codechefScraper  = require('../scrapers/codechef.scraper');
const hackerrankScraper = require('../scrapers/hackerrank.scraper');

// Run every night at 2:00 AM IST
const CRON_SCHEDULE = process.env.SYNC_CRON || '0 2 * * *';

// Distributed lock constants
const LOCK_KEY = 'cron:sync:nightly:lock';
const LOCK_TTL = 7200; // 2 hours max (prevents stale lock if instance crashes mid-sync)

// ─────────────────────────────────────────────────────────────
// Main sync runner
// ─────────────────────────────────────────────────────────────
async function syncAllStudents() {
  logger.info('🔄 [SyncJob] Starting nightly profile sync...');

  const { rows: students } = await query(
    `SELECT s.email,
            pp.platform_name,
            pp.username
     FROM students s
     JOIN platform_profiles pp ON pp.student_email = s.email
     WHERE s.is_verified    = TRUE
       AND s.is_blocklisted = FALSE
     ORDER BY s.email, pp.platform_name`
  );

  // Group by student
  const studentMap = {};
  for (const row of students) {
    if (!studentMap[row.email]) studentMap[row.email] = {};
    studentMap[row.email][row.platform_name] = row.username;
  }

  const emails = Object.keys(studentMap);
  logger.info(`[SyncJob] Syncing ${emails.length} students...`);

  let success = 0, failed = 0;

  for (const email of emails) {
    try {
      await syncStudent(email, studentMap[email]);
      success++;
    } catch (err) {
      failed++;
      logger.error(`[SyncJob] Failed to sync ${email}: ${err.message}`);
    }
  }

  logger.info(`✅ [SyncJob] Sync complete. Success: ${success}, Failed: ${failed}`);
}

// ─────────────────────────────────────────────────────────────
// Sync a single student across all their platforms
// ─────────────────────────────────────────────────────────────
async function syncStudent(email, handles) {
  const { leetcode, codeforces, codechef, hackerrank } = handles;

  // Scrape all platforms in parallel
  const [lcData, cfData, ccData, hrData] = await Promise.all([
    leetcode   ? leetcodeScraper.getFullProfile(leetcode)    : null,
    codeforces ? codeforcesScraper.getFullProfile(codeforces): null,
    codechef   ? codechefScraper.getFullProfile(codechef)    : null,
    hackerrank ? hackerrankScraper.getFullProfile(hackerrank): null
  ]);

  // Upsert each platform's data
  if (lcData)  await upsertLeetcode(email,   lcData);
  if (cfData)  await upsertCodeforces(email, cfData);
  if (ccData)  await upsertCodechef(email,   ccData);
  if (hrData)  await upsertHackerrank(email, hrData);

  // Insert daily snapshots for analytics
  const today = new Date().toISOString().split('T')[0];

  const snapshots = [
    lcData && { platform: 'leetcode',   rating: Math.round(lcData.contestRating || 0),        solved: lcData.totalSolved },
    cfData && { platform: 'codeforces', rating: cfData.currentRating,                          solved: cfData.totalSolved },
    ccData && { platform: 'codechef',   rating: ccData.currentRating,                          solved: ccData.totalSolved },
    hrData && { platform: 'hackerrank', rating: Math.round(hrData.totalPoints || 0),           solved: 0 }
  ].filter(Boolean);

  for (const snap of snapshots) {
    await query(
      `INSERT INTO platform_daily_snapshots
         (student_email, platform_name, snapshot_date, rating, total_solved_snapshot)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (student_email, platform_name, snapshot_date) DO UPDATE SET
         rating               = EXCLUDED.rating,
         total_solved_snapshot = EXCLUDED.total_solved_snapshot`,
      [email, snap.platform, today, snap.rating, snap.solved]
    );
  }

  logger.debug(`[SyncJob] Synced ${email}`);
}

// ─────────────────────────────────────────────────────────────
// Platform upsert helpers
// ─────────────────────────────────────────────────────────────
async function upsertLeetcode(email, d) {
  // 1. Upsert unified platform_profiles (summary/leaderboard row)
  await query(
    `INSERT INTO platform_profiles
       (student_email, platform_name, username, current_rating, global_rank,
        total_solved, easy_solved, medium_solved, hard_solved, last_updated)
     VALUES ($1,'leetcode',$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (student_email, platform_name) DO UPDATE SET
       username = EXCLUDED.username, current_rating = EXCLUDED.current_rating,
       global_rank = EXCLUDED.global_rank, total_solved = EXCLUDED.total_solved,
       easy_solved = EXCLUDED.easy_solved, medium_solved = EXCLUDED.medium_solved,
       hard_solved = EXCLUDED.hard_solved, last_updated = NOW()`,
    [email, d.username, Math.round(d.contestRating), d.contestGlobalRanking,
     d.totalSolved, d.easySolved, d.mediumSolved, d.hardSolved]
  );

  // 2. Upsert leetcode_profiles (full detail row)
  await query(
    `INSERT INTO leetcode_profiles
       (student_email, username,
        -- profile info
        real_name, avatar_url, about_me, school, company, job_title,
        country, reputation,
        -- ranking
        global_ranking,
        -- solving stats
        total_solved, easy_solved, medium_solved, hard_solved,
        acceptance_rate,
        -- calendar
        streak, total_active_days, contribution_calendar,
        -- contest ranking
        contest_rating, top_percentage, attended_contests_count,
        total_participants, contest_badge_name,
        -- JSONB rich data
        language_stats, skill_tags, badges, upcoming_badges,
        active_badge, recent_ac_submissions,
        last_synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
             $22,$23,$24,$25,$26,$27,$28,$29,$30,NOW())
     ON CONFLICT (student_email) DO UPDATE SET
       username = EXCLUDED.username,
       real_name = EXCLUDED.real_name, avatar_url = EXCLUDED.avatar_url,
       about_me = EXCLUDED.about_me, school = EXCLUDED.school,
       company = EXCLUDED.company, job_title = EXCLUDED.job_title,
       country = EXCLUDED.country, reputation = EXCLUDED.reputation,
       global_ranking = EXCLUDED.global_ranking,
       total_solved = EXCLUDED.total_solved, easy_solved = EXCLUDED.easy_solved,
       medium_solved = EXCLUDED.medium_solved, hard_solved = EXCLUDED.hard_solved,
       acceptance_rate = EXCLUDED.acceptance_rate,
       streak = EXCLUDED.streak, total_active_days = EXCLUDED.total_active_days,
       contribution_calendar = EXCLUDED.contribution_calendar,
       contest_rating = EXCLUDED.contest_rating,
       top_percentage = EXCLUDED.top_percentage,
       attended_contests_count = EXCLUDED.attended_contests_count,
       total_participants = EXCLUDED.total_participants,
       contest_badge_name = EXCLUDED.contest_badge_name,
       language_stats = EXCLUDED.language_stats,
       skill_tags = EXCLUDED.skill_tags, badges = EXCLUDED.badges,
       upcoming_badges = EXCLUDED.upcoming_badges,
       active_badge = EXCLUDED.active_badge,
       recent_ac_submissions = EXCLUDED.recent_ac_submissions,
       last_synced = NOW()`,
    [
      email, d.username,
      d.realName, d.avatarUrl, d.aboutMe, d.school, d.company, d.jobTitle,
      d.country, d.reputation,
      d.globalRanking,
      d.totalSolved, d.easySolved, d.mediumSolved, d.hardSolved,
      d.acceptanceRate,
      d.streak, d.totalActiveDays,
      d.contributionCalendar ? JSON.stringify(d.contributionCalendar) : null,
      d.contestRating, d.topPercentage, d.attendedContestsCount,
      d.totalParticipants, d.contestBadgeName,
      JSON.stringify(d.languageStats   || []),
      JSON.stringify(d.skillTags       || {}),
      JSON.stringify(d.badges          || []),
      JSON.stringify(d.upcomingBadges  || []),
      d.activeBadge ? JSON.stringify(d.activeBadge) : null,
      JSON.stringify(d.recentAcSubmissions || []),
    ]
  );

  // 3. Upsert contest history (extended with trendDirection + totalProblems)
  for (const c of (d.contestHistory || [])) {
    await query(
      `INSERT INTO leetcode_contest_history
         (student_email, contest_title, contest_time, rank_achieved,
          finish_time_seconds, problems_solved, rating_after_contest,
          trend_direction, total_problems)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (student_email, contest_title) DO UPDATE SET
         rank_achieved = EXCLUDED.rank_achieved,
         rating_after_contest = EXCLUDED.rating_after_contest,
         trend_direction = EXCLUDED.trend_direction,
         total_problems = EXCLUDED.total_problems`,
      [email, c.contestTitle, c.contestTime, c.rankAchieved,
       c.finishTimeSeconds, c.problemsSolved, c.ratingAfterContest,
       c.trendDirection, c.totalProblems]
    );
  }
}

async function upsertCodeforces(email, d) {
  await query(
    `INSERT INTO platform_profiles
       (student_email, platform_name, username, current_rating, global_rank,
        total_solved, last_updated)
     VALUES ($1,'codeforces',$2,$3,$4,$5,NOW())
     ON CONFLICT (student_email, platform_name) DO UPDATE SET
       username = EXCLUDED.username, current_rating = EXCLUDED.current_rating,
       global_rank = EXCLUDED.global_rank, total_solved = EXCLUDED.total_solved,
       last_updated = NOW()`,
    [email, d.username, d.currentRating, 0, d.totalSolved]
  );

  await query(
    `INSERT INTO codeforces_profiles
       (student_email, username, current_rating, max_rating, current_rank, max_rank,
        contribution, avatar_url,
        solved_rating_under_1200, solved_rating_1200_1599, solved_rating_1600_1899,
        solved_rating_1900_2199, solved_rating_above_2200, last_synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
     ON CONFLICT (student_email) DO UPDATE SET
       username = EXCLUDED.username, current_rating = EXCLUDED.current_rating,
       max_rating = EXCLUDED.max_rating, current_rank = EXCLUDED.current_rank,
       max_rank = EXCLUDED.max_rank, contribution = EXCLUDED.contribution,
       avatar_url = EXCLUDED.avatar_url,
       solved_rating_under_1200 = EXCLUDED.solved_rating_under_1200,
       solved_rating_1200_1599  = EXCLUDED.solved_rating_1200_1599,
       solved_rating_1600_1899  = EXCLUDED.solved_rating_1600_1899,
       solved_rating_1900_2199  = EXCLUDED.solved_rating_1900_2199,
       solved_rating_above_2200 = EXCLUDED.solved_rating_above_2200,
       last_synced = NOW()`,
    [email, d.username, d.currentRating, d.maxRating, d.currentRank, d.maxRank,
     d.contribution, d.avatarUrl,
     d.solvedRatingUnder1200, d.solvedRating1200_1599, d.solvedRating1600_1899,
     d.solvedRating1900_2199, d.solvedRatingAbove2200]
  );

  for (const c of (d.contestHistory || [])) {
    await query(
      `INSERT INTO codeforces_contest_history
         (student_email, contest_id, contest_name, rank_achieved,
          old_rating, new_rating, rating_change, timestamp_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (student_email, contest_id) DO NOTHING`,
      [email, c.contestId, c.contestName, c.rankAchieved,
       c.oldRating, c.newRating, c.ratingChange, c.timestampSeconds]
    );
  }
}

async function upsertCodechef(email, d) {
  await query(
    `INSERT INTO platform_profiles
       (student_email, platform_name, username, current_rating, global_rank,
        total_solved, last_updated)
     VALUES ($1,'codechef',$2,$3,$4,$5,NOW())
     ON CONFLICT (student_email, platform_name) DO UPDATE SET
       username = EXCLUDED.username, current_rating = EXCLUDED.current_rating,
       global_rank = EXCLUDED.global_rank, total_solved = EXCLUDED.total_solved,
       last_updated = NOW()`,
    [email, d.username, d.currentRating, d.globalRank, d.totalSolved]
  );

  await query(
    `INSERT INTO codechef_profiles
       (student_email, username, stars_string, current_rating, highest_rating,
        global_rank, country_rank, current_division,
        starters_solved, practice_solved, peer_solved, total_solved, last_synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT (student_email) DO UPDATE SET
       username = EXCLUDED.username, stars_string = EXCLUDED.stars_string,
       current_rating = EXCLUDED.current_rating, highest_rating = EXCLUDED.highest_rating,
       global_rank = EXCLUDED.global_rank, country_rank = EXCLUDED.country_rank,
       current_division = EXCLUDED.current_division,
       starters_solved = EXCLUDED.starters_solved, practice_solved = EXCLUDED.practice_solved,
       peer_solved = EXCLUDED.peer_solved, total_solved = EXCLUDED.total_solved,
       last_synced = NOW()`,
    [email, d.username, d.starsString, d.currentRating, d.highestRating,
     d.globalRank, d.countryRank, d.currentDivision,
     d.startersSolved, d.practiceSolved, d.peerSolved, d.totalSolved]
  );

  for (const c of (d.contestHistory || [])) {
    await query(
      `INSERT INTO codechef_contest_history
         (student_email, contest_code, contest_name, rank_achieved,
          rating_after_contest, rating_change)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (student_email, contest_code) DO NOTHING`,
      [email, c.contestCode, c.contestName, c.rankAchieved,
       c.ratingAfterContest, c.ratingChange]
    );
  }
}

async function upsertHackerrank(email, d) {
  await query(
    `INSERT INTO platform_profiles
       (student_email, platform_name, username, current_rating, global_rank, last_updated)
     VALUES ($1,'hackerrank',$2,$3,$4,NOW())
     ON CONFLICT (student_email, platform_name) DO UPDATE SET
       username = EXCLUDED.username, current_rating = EXCLUDED.current_rating,
       global_rank = EXCLUDED.global_rank, last_updated = NOW()`,
    [email, d.username, Math.round(d.totalPoints), d.globalRank]
  );

  await query(
    `INSERT INTO hackerrank_profiles
       (student_email, username, total_points, global_rank,
        problem_solving_stars, problem_solving_score,
        cpp_stars, java_stars, python_stars, sql_stars, last_synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
     ON CONFLICT (student_email) DO UPDATE SET
       username = EXCLUDED.username, total_points = EXCLUDED.total_points,
       global_rank = EXCLUDED.global_rank,
       problem_solving_stars = EXCLUDED.problem_solving_stars,
       problem_solving_score = EXCLUDED.problem_solving_score,
       cpp_stars = EXCLUDED.cpp_stars, java_stars = EXCLUDED.java_stars,
       python_stars = EXCLUDED.python_stars, sql_stars = EXCLUDED.sql_stars,
       last_synced = NOW()`,
    [email, d.username, d.totalPoints, d.globalRank,
     d.problemSolvingStars, d.problemSolvingScore,
     d.cppStars, d.javaStars, d.pythonStars, d.sqlStars]
  );

  for (const sub of (d.recentSubmissions || [])) {
    await query(
      `INSERT INTO hackerrank_recent_submissions
         (student_email, challenge_slug, challenge_name, language, status, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (student_email, challenge_slug) DO NOTHING`,
      [email, sub.challengeSlug, sub.challengeName, sub.language, sub.status, sub.submittedAt]
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Distributed-lock wrapper — only ONE instance runs the nightly sync
// even when multiple EC2s are in the Auto Scaling Group.
// Uses Redis SET NX (set if not exists):
//   - First instance to call: acquires lock, runs sync, releases lock
//   - All other instances:    lock already set, log and skip
// ─────────────────────────────────────────────────────────────
async function syncAllStudentsWithLock() {
  // SET NX = set only if the key doesn't exist  →  atomic, safe across instances
  const acquired = await redis.set(LOCK_KEY, process.env.HOSTNAME || 'instance', 'EX', LOCK_TTL, 'NX');

  if (!acquired) {
    logger.info('[SyncJob] ⏭️  Another instance holds the sync lock — skipping this run.');
    return;
  }

  try {
    logger.info('[SyncJob] � udd10 Distributed lock acquired — starting sync...');
    await syncAllStudents();
  } finally {
    // Always release even if sync throws
    await redis.del(LOCK_KEY);
    logger.info('[SyncJob] � udd13 Lock released.');
  }
}

// ─────────────────────────────────────────────────────────────
// Register and start the cron job
// ─────────────────────────────────────────────────────────────
function startSyncJob() {
  logger.info(`[SyncJob] Scheduled: "${CRON_SCHEDULE}" (${new Date().toLocaleString()})`);
  // Use locked version for multi-instance safety
  cron.schedule(CRON_SCHEDULE, syncAllStudentsWithLock, { timezone: 'Asia/Kolkata' });
}

// Export syncStudent so other modules can trigger single-student syncs
module.exports = { startSyncJob, syncAllStudents, syncStudent };
