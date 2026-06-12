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
// Upsert all unique AC submissions into student_submissions table
// ─────────────────────────────────────────────────────────────
async function upsertSubmissions(email, platform, submissions) {
  if (!submissions || submissions.length === 0) return;

  // Deduplicate by problem_id — keep best submission per problem
  // (AC beats PA beats WA; on tie keep latest timestamp)
  const statusRank = { AC: 3, PA: 2, WA: 1 };
  const best = new Map();
  for (const s of submissions) {
    const key = s.problem_id;
    if (!key) continue;
    const existing = best.get(key);
    if (!existing) { best.set(key, s); continue; }
    const newRank = statusRank[s.status] ?? 0;
    const oldRank = statusRank[existing.status] ?? 0;
    if (newRank > oldRank) { best.set(key, s); continue; }
    if (newRank === oldRank) {
      // keep whichever was submitted later
      if ((s.submitted_at || '') > (existing.submitted_at || '')) best.set(key, s);
    }
  }
  const unique = Array.from(best.values());

  // Batch in groups of 200 to avoid huge query params
  const BATCH = 200;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;
    for (const s of batch) {
      values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
      params.push(
        email,
        platform,
        s.problem_id,
        s.problem_name || null,
        s.status || 'AC',
        s.language || null,
        s.submitted_at || null,
        s.runtime_ms   || null,
        s.contest_id   || null   // CC stores contest code e.g. START145D
      );
    }
    await query(
      `INSERT INTO student_submissions
         (student_email, platform, problem_id, problem_name, status, language, submitted_at, runtime_ms, contest_id)
       VALUES ${values.join(',')}
       ON CONFLICT (student_email, platform, problem_id) DO UPDATE SET
         problem_name = COALESCE(NULLIF(EXCLUDED.problem_name, EXCLUDED.problem_id), student_submissions.problem_name),
         status       = EXCLUDED.status,
         language     = COALESCE(EXCLUDED.language, student_submissions.language),
         contest_id   = COALESCE(EXCLUDED.contest_id, student_submissions.contest_id)`,
      params
    ).catch(err => logger.warn(`[SyncJob] upsertSubmissions batch failed: ${err.message}`));
  }
  logger.debug(`[SyncJob] Upserted ${unique.length} unique ${platform} submissions for ${email} (from ${submissions.length} raw)`);

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

  // 4. Upsert all unique AC submissions
  await upsertSubmissions(email, 'leetcode', d.allAcSubmissions || []);
}

async function upsertCodeforces(email, d) {
  // 1. platform_profiles (unified summary)
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

  // 2. codeforces_profiles (full detail)
  await query(
    `INSERT INTO codeforces_profiles
       (student_email, username,
        first_name, last_name, country, city, organization,
        avatar_url, title_photo,
        current_rating, max_rating, current_rank, max_rank,
        contribution, friend_of_count,
        last_online_seconds, registration_seconds,
        total_solved, total_submissions, accepted_submissions, acceptance_rate,
        highest_rated_problem, most_frequent_tag,
        solved_rating_under_1200, solved_rating_1200_1599, solved_rating_1600_1899,
        solved_rating_1900_2199, solved_rating_above_2200,
        language_stats, tag_stats, submission_calendar, recent_ac_submissions,
        last_synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
             $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,NOW())
     ON CONFLICT (student_email) DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
       country = EXCLUDED.country, city = EXCLUDED.city,
       organization = EXCLUDED.organization, avatar_url = EXCLUDED.avatar_url,
       title_photo = EXCLUDED.title_photo,
       current_rating = EXCLUDED.current_rating, max_rating = EXCLUDED.max_rating,
       current_rank = EXCLUDED.current_rank, max_rank = EXCLUDED.max_rank,
       contribution = EXCLUDED.contribution, friend_of_count = EXCLUDED.friend_of_count,
       last_online_seconds = EXCLUDED.last_online_seconds,
       registration_seconds = EXCLUDED.registration_seconds,
       total_solved = EXCLUDED.total_solved,
       total_submissions = EXCLUDED.total_submissions,
       accepted_submissions = EXCLUDED.accepted_submissions,
       acceptance_rate = EXCLUDED.acceptance_rate,
       highest_rated_problem = EXCLUDED.highest_rated_problem,
       most_frequent_tag = EXCLUDED.most_frequent_tag,
       solved_rating_under_1200 = EXCLUDED.solved_rating_under_1200,
       solved_rating_1200_1599  = EXCLUDED.solved_rating_1200_1599,
       solved_rating_1600_1899  = EXCLUDED.solved_rating_1600_1899,
       solved_rating_1900_2199  = EXCLUDED.solved_rating_1900_2199,
       solved_rating_above_2200 = EXCLUDED.solved_rating_above_2200,
       language_stats = EXCLUDED.language_stats,
       tag_stats = EXCLUDED.tag_stats,
       submission_calendar = EXCLUDED.submission_calendar,
       recent_ac_submissions = EXCLUDED.recent_ac_submissions,
       last_synced = NOW()`,
    [
      email, d.username,
      d.firstName, d.lastName, d.country, d.city, d.organization,
      d.avatarUrl, d.titlePhoto,
      d.currentRating, d.maxRating, d.currentRank, d.maxRank,
      d.contribution, d.friendOfCount,
      d.lastOnlineSeconds, d.registrationSeconds,
      d.totalSolved, d.totalSubmissions, d.acceptedSubmissions, d.acceptanceRate,
      d.highestRatedProblem, d.mostFrequentTag,
      d.solvedRatingUnder1200, d.solvedRating1200_1599, d.solvedRating1600_1899,
      d.solvedRating1900_2199, d.solvedRatingAbove2200,
      JSON.stringify(d.languageStats       || []),
      JSON.stringify(d.tagStats            || []),
      JSON.stringify(d.submissionCalendar  || {}),
      JSON.stringify(d.recentAcSubmissions || []),
    ]
  );

  // 3. Contest history
  for (const c of (d.contestHistory || [])) {
    await query(
      `INSERT INTO codeforces_contest_history
         (student_email, contest_id, contest_name, rank_achieved,
          old_rating, new_rating, rating_change, timestamp_seconds,
          division, problems_solved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (student_email, contest_id) DO UPDATE SET
         rank_achieved  = EXCLUDED.rank_achieved,
         old_rating     = EXCLUDED.old_rating,
         new_rating     = EXCLUDED.new_rating,
         rating_change  = EXCLUDED.rating_change,
         division       = EXCLUDED.division,
         problems_solved = EXCLUDED.problems_solved`,
      [email, c.contestId, c.contestName, c.rankAchieved,
       c.oldRating, c.newRating, c.ratingChange, c.timestampSeconds,
       c.division, c.problemsSolved ?? 0]
    );
  }

  // 4. Upsert all unique AC submissions
  await upsertSubmissions(email, 'codeforces', d.allAcSubmissions || []);
}


async function upsertCodechef(email, d) {
  // 1. platform_profiles (unified summary)
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

  // 2. codechef_profiles (full detail)
  await query(
    `INSERT INTO codechef_profiles
       (student_email, username, display_name, avatar_url, country, institution,
        student_or_pro, is_pro_user,
        stars_string, current_rating, highest_rating,
        global_rank, country_rank, current_division,
        dsa_rating, dsa_highest_rating, dsa_global_rank, dsa_country_rank,
        starters_solved, practice_solved, peer_solved, total_solved,
        problems_fully_solved, problems_partial_solved,
        contests_participated, best_rank, win_rate,
        heat_map, badges, rating_graph,
        last_synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
             $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,NOW())
     ON CONFLICT (student_email) DO UPDATE SET
       username = EXCLUDED.username, display_name = EXCLUDED.display_name,
       avatar_url = EXCLUDED.avatar_url, country = EXCLUDED.country,
       institution = EXCLUDED.institution, student_or_pro = EXCLUDED.student_or_pro,
       is_pro_user = EXCLUDED.is_pro_user,
       stars_string = EXCLUDED.stars_string, current_rating = EXCLUDED.current_rating,
       highest_rating = EXCLUDED.highest_rating, global_rank = EXCLUDED.global_rank,
       country_rank = EXCLUDED.country_rank, current_division = EXCLUDED.current_division,
       dsa_rating = EXCLUDED.dsa_rating, dsa_highest_rating = EXCLUDED.dsa_highest_rating,
       dsa_global_rank = EXCLUDED.dsa_global_rank, dsa_country_rank = EXCLUDED.dsa_country_rank,
       starters_solved = EXCLUDED.starters_solved, practice_solved = EXCLUDED.practice_solved,
       peer_solved = EXCLUDED.peer_solved, total_solved = EXCLUDED.total_solved,
       problems_fully_solved = EXCLUDED.problems_fully_solved,
       problems_partial_solved = EXCLUDED.problems_partial_solved,
       contests_participated = EXCLUDED.contests_participated,
       best_rank = EXCLUDED.best_rank, win_rate = EXCLUDED.win_rate,
       heat_map = EXCLUDED.heat_map, badges = EXCLUDED.badges,
       rating_graph = EXCLUDED.rating_graph,
       last_synced = NOW()`,
    [
      email, d.username, d.displayName, d.avatarUrl, d.country, d.institution,
      d.studentOrPro, d.isProUser,
      d.starsString, d.currentRating, d.highestRating,
      d.globalRank, d.countryRank, d.currentDivision,
      d.dsaRating, d.dsaHighestRating, d.dsaGlobalRank, d.dsaCountryRank,
      d.startersSolved, d.practiceSolved, d.peerSolved, d.totalSolved,
      d.problemsFullySolved, d.problemsPartialSolved,
      d.contestsParticipated, d.bestRank, d.winRate,
      JSON.stringify(d.heatMap      || []),
      JSON.stringify(d.badges       || []),
      JSON.stringify(d.ratingGraph  || []),
    ]
  );

  // 3. Contest history
  for (const c of (d.contestHistory || [])) {
    await query(
      `INSERT INTO codechef_contest_history
         (student_email, contest_code, contest_name, rank_achieved,
          rating_after_contest, rating_change,
          contest_date, contest_type, division, problems_solved_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (student_email, contest_code) DO UPDATE SET
         rank_achieved        = EXCLUDED.rank_achieved,
         rating_after_contest = EXCLUDED.rating_after_contest,
         rating_change        = EXCLUDED.rating_change,
         contest_date         = EXCLUDED.contest_date,
         contest_type         = EXCLUDED.contest_type,
         division             = EXCLUDED.division,
         problems_solved_count = EXCLUDED.problems_solved_count`,
      [
        email, c.contestCode, c.contestName, c.rankAchieved,
        c.ratingAfterContest, c.ratingChange,
        c.contestDate, c.contestType, c.division, c.problemsSolvedCount,
      ]
    );
  }

  // 4. Upsert real AC submissions (scraped from /recent/user with actual problem codes)
  //    First, purge old fake rows (problem_id like 'cc-YYYY-M-D-N') from heatmap era
  const newSubs = d.allAcSubmissions || [];
  if (newSubs.length > 0) {
    await query(
      `DELETE FROM student_submissions
       WHERE student_email = $1
         AND platform = 'codechef'
         AND problem_id ~ '^cc-[0-9]'`,
      [email]
    ).catch(err => logger.warn(`[SyncJob] CC fake-row cleanup failed: ${err.message}`));
  }
  await upsertSubmissions(email, 'codechef', newSubs);
}



async function upsertHackerrank(email, d) {
  // 1. platform_profiles (unified summary)
  await query(
    `INSERT INTO platform_profiles
       (student_email, platform_name, username, current_rating, global_rank, last_updated)
     VALUES ($1,'hackerrank',$2,$3,$4,NOW())
     ON CONFLICT (student_email, platform_name) DO UPDATE SET
       username = EXCLUDED.username, current_rating = EXCLUDED.current_rating,
       global_rank = EXCLUDED.global_rank, last_updated = NOW()`,
    [email, d.username, Math.round(d.totalPoints), d.globalRank]
  );

  // 2. hackerrank_profiles (full detail)
  await query(
    `INSERT INTO hackerrank_profiles
       (student_email, username, display_name, avatar_url, country, city,
        school, jobs_headline, about, graduation_year, created_at_hr,
        linkedin_url, github_url, website, twitter_url,
        followers_count, following_count,
        total_points, leaderboard_rank, level, elo_rating, contest_points, global_rank,
        medals_gold, medals_silver, medals_bronze, contests_participated,
        submissions_count, accepted_submissions, acceptance_rate,
        problem_solving_stars, problem_solving_score,
        cpp_stars, java_stars, python_stars, sql_stars,
        ruby_stars, js_stars, sql_score, algorithms_score, ds_score,
        badges, certificates, track_scores,
        last_synced)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
             $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
             $33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,NOW())
     ON CONFLICT (student_email) DO UPDATE SET
       username = EXCLUDED.username, display_name = EXCLUDED.display_name,
       avatar_url = EXCLUDED.avatar_url, country = EXCLUDED.country,
       city = EXCLUDED.city, school = EXCLUDED.school,
       jobs_headline = EXCLUDED.jobs_headline, about = EXCLUDED.about,
       graduation_year = EXCLUDED.graduation_year, created_at_hr = EXCLUDED.created_at_hr,
       linkedin_url = EXCLUDED.linkedin_url, github_url = EXCLUDED.github_url,
       website = EXCLUDED.website, twitter_url = EXCLUDED.twitter_url,
       followers_count = EXCLUDED.followers_count, following_count = EXCLUDED.following_count,
       total_points = EXCLUDED.total_points, leaderboard_rank = EXCLUDED.leaderboard_rank,
       level = EXCLUDED.level, elo_rating = EXCLUDED.elo_rating,
       contest_points = EXCLUDED.contest_points, global_rank = EXCLUDED.global_rank,
       medals_gold = EXCLUDED.medals_gold, medals_silver = EXCLUDED.medals_silver,
       medals_bronze = EXCLUDED.medals_bronze,
       contests_participated = EXCLUDED.contests_participated,
       submissions_count = EXCLUDED.submissions_count,
       accepted_submissions = EXCLUDED.accepted_submissions,
       acceptance_rate = EXCLUDED.acceptance_rate,
       problem_solving_stars = EXCLUDED.problem_solving_stars,
       problem_solving_score = EXCLUDED.problem_solving_score,
       cpp_stars = EXCLUDED.cpp_stars, java_stars = EXCLUDED.java_stars,
       python_stars = EXCLUDED.python_stars, sql_stars = EXCLUDED.sql_stars,
       ruby_stars = EXCLUDED.ruby_stars, js_stars = EXCLUDED.js_stars,
       sql_score = EXCLUDED.sql_score, algorithms_score = EXCLUDED.algorithms_score,
       ds_score = EXCLUDED.ds_score,
       badges = EXCLUDED.badges, certificates = EXCLUDED.certificates,
       track_scores = EXCLUDED.track_scores,
       last_synced = NOW()`,
    [
      email, d.username, d.displayName, d.avatarUrl, d.country, d.city,
      d.school, d.jobsHeadline, d.about, d.graduationYear, d.createdAtHr,
      d.linkedinUrl, d.githubUrl, d.website, d.twitterUrl,
      d.followersCount, d.followingCount,
      d.totalPoints, d.leaderboardRank, d.level, d.eloRating, d.contestPoints, d.globalRank,
      d.medalsGold, d.medalsSilver, d.medalsBronze, d.contestsParticipated,
      d.submissionsCount, d.acceptedSubmissions, d.acceptanceRate,
      d.problemSolvingStars, d.problemSolvingScore,
      d.cppStars, d.javaStars, d.pythonStars, d.sqlStars,
      d.rubyStars, d.jsStars, d.sqlScore, d.algorithmsScore, d.dsScore,
      JSON.stringify(d.badges        || []),
      JSON.stringify(d.certificates  || []),
      JSON.stringify(d.trackScores   || []),
    ]
  );

  // 3. Recent submissions (upsert with score/track/difficulty)
  for (const sub of (d.recentSubmissions || [])) {
    await query(
      `INSERT INTO hackerrank_recent_submissions
         (student_email, challenge_slug, challenge_name, language, status,
          score, track, difficulty, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (student_email, challenge_slug) DO UPDATE SET
         language   = EXCLUDED.language,
         status     = EXCLUDED.status,
         score      = EXCLUDED.score,
         track      = EXCLUDED.track,
         difficulty = EXCLUDED.difficulty,
         submitted_at = EXCLUDED.submitted_at`,
      [
        email, sub.challengeSlug, sub.challengeName, sub.language, sub.status,
        sub.score, sub.track, sub.difficulty, sub.submittedAt,
      ]
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
