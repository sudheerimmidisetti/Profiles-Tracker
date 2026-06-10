// Full re-sync script for all students across all platforms
require('dotenv').config();
const { query } = require('./src/config/db');
const cfScraper = require('./src/scrapers/codeforces.scraper');
const ccScraper = require('./src/scrapers/codechef.scraper');
const hrScraper = require('./src/scrapers/hackerrank.scraper');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function upsertCF(email, d) {
  await query(
    `UPDATE codeforces_profiles SET
       current_rating=$2, max_rating=$3, current_rank=$4, max_rank=$5,
       contribution=$6, avatar_url=$7, first_name=$8, last_name=$9,
       country=$10, city=$11, organization=$12, friend_of_count=$13,
       last_online_seconds=$14, registration_seconds=$15,
       total_solved=$16, total_submissions=$17, accepted_submissions=$18,
       acceptance_rate=$19, highest_rated_problem=$20, most_frequent_tag=$21,
       solved_rating_under_1200=$22, solved_rating_1200_1599=$23,
       solved_rating_1600_1899=$24, solved_rating_1900_2199=$25,
       solved_rating_above_2200=$26,
       language_stats=$27, tag_stats=$28,
       submission_calendar=$29, recent_ac_submissions=$30,
       last_synced=NOW()
     WHERE student_email=$1`,
    [
      email,
      d.currentRating, d.maxRating, d.currentRank, d.maxRank,
      d.contribution, d.avatarUrl, d.firstName, d.lastName,
      d.country, d.city, d.organization, d.friendOfCount,
      d.lastOnlineSeconds, d.registrationSeconds,
      d.totalSolved, d.totalSubmissions, d.acceptedSubmissions,
      d.acceptanceRate, d.highestRatedProblem, d.mostFrequentTag,
      d.solvedRatingUnder1200, d.solvedRating1200_1599,
      d.solvedRating1600_1899, d.solvedRating1900_2199, d.solvedRatingAbove2200,
      JSON.stringify(d.languageStats || []),
      JSON.stringify(d.tagStats || []),
      JSON.stringify(d.submissionCalendar || {}),
      JSON.stringify(d.recentAcSubmissions || []),
    ]
  );

  // Update platform_profiles summary
  await query(
    `UPDATE platform_profiles SET current_rating=$2, global_rank=$3, last_updated=NOW()
     WHERE student_email=$1 AND platform_name='codeforces'`,
    [email, d.currentRating, 0]
  );

  // Upsert contest history
  for (const c of (d.contestHistory || [])) {
    await query(
      `INSERT INTO codeforces_contest_history
         (student_email, contest_id, contest_name, rank_achieved,
          old_rating, new_rating, rating_change, timestamp_seconds, division)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (student_email, contest_id) DO UPDATE SET
         rank_achieved=EXCLUDED.rank_achieved,
         old_rating=EXCLUDED.old_rating, new_rating=EXCLUDED.new_rating,
         rating_change=EXCLUDED.rating_change,
         timestamp_seconds=EXCLUDED.timestamp_seconds`,
      [email, c.contestId, c.contestName, c.rankAchieved,
       c.oldRating, c.newRating, c.ratingChange, c.timestampSeconds, c.division]
    );
  }
}

async function upsertCC(email, d) {
  await query(
    `UPDATE codechef_profiles SET
       display_name=$2, avatar_url=$3, country=$4, institution=$5,
       student_or_pro=$6, stars_string=$7, current_rating=$8, highest_rating=$9,
       global_rank=$10, country_rank=$11, current_division=$12,
       dsa_rating=$13, dsa_highest_rating=$14,
       starters_solved=$15, practice_solved=$16, peer_solved=$17,
       total_solved=$18, problems_fully_solved=$19,
       contests_participated=$20, best_rank=$21, win_rate=$22,
       heat_map=$23, badges=$24, rating_graph=$25,
       last_synced=NOW()
     WHERE student_email=$1`,
    [
      email,
      d.displayName, d.avatarUrl, d.country, d.institution,
      d.studentOrPro, d.starsString, d.currentRating, d.highestRating,
      d.globalRank, d.countryRank, d.currentDivision,
      d.dsaRating, d.dsaHighestRating,
      d.startersSolved, d.practiceSolved, d.peerSolved,
      d.totalSolved, d.problemsFullySolved,
      d.contestsParticipated, d.bestRank, d.winRate,
      JSON.stringify(d.heatMap || []),
      JSON.stringify(d.badges  || []),
      JSON.stringify(d.ratingGraph || []),
    ]
  );

  // Update platform_profiles
  await query(
    `UPDATE platform_profiles SET current_rating=$2, last_updated=NOW()
     WHERE student_email=$1 AND platform_name='codechef'`,
    [email, d.currentRating]
  );

  // Contest history
  for (const c of (d.contestHistory || [])) {
    await query(
      `INSERT INTO codechef_contest_history
         (student_email, contest_code, contest_name, rank_achieved,
          rating_after_contest, rating_change, contest_date, contest_type,
          division, problems_solved_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (student_email, contest_code) DO UPDATE SET
         rank_achieved=EXCLUDED.rank_achieved,
         rating_after_contest=EXCLUDED.rating_after_contest,
         rating_change=EXCLUDED.rating_change,
         contest_date=EXCLUDED.contest_date`,
      [email, c.contestCode, c.contestName, c.rankAchieved,
       c.ratingAfterContest, c.ratingChange, c.contestDate,
       c.contestType, c.division, c.problemsSolvedCount]
    );
  }
}

async function upsertHR(email, d) {
  await query(
    `UPDATE hackerrank_profiles SET
       display_name=$2, avatar_url=$3, school=$4, jobs_headline=$5, about=$6,
       created_at_hr=$7, linkedin_url=$8, github_url=$9, website=$10,
       followers_count=$11, total_points=$12, level=$13,
       problem_solving_stars=$14, problem_solving_score=$15,
       cpp_stars=$16, java_stars=$17, python_stars=$18, sql_stars=$19,
       ruby_stars=$20, js_stars=$21, sql_score=$22,
       algorithms_score=$23, ds_score=$24,
       badges=$25, certificates=$26, track_scores=$27,
       last_synced=NOW()
     WHERE student_email=$1`,
    [
      email,
      d.displayName, d.avatarUrl, d.school, d.jobsHeadline, d.about,
      d.createdAtHr, d.linkedinUrl, d.githubUrl, d.website,
      d.followersCount, d.totalPoints, d.level,
      d.problemSolvingStars, d.problemSolvingScore,
      d.cppStars, d.javaStars, d.pythonStars, d.sqlStars,
      d.rubyStars, d.jsStars, d.sqlScore, d.algorithmsScore, d.dsScore,
      JSON.stringify(d.badges || []),
      JSON.stringify(d.certificates || []),
      JSON.stringify(d.trackScores || []),
    ]
  );

  // Update platform_profiles
  await query(
    `UPDATE platform_profiles SET current_rating=$2, last_updated=NOW()
     WHERE student_email=$1 AND platform_name='hackerrank'`,
    [email, Math.round(d.totalPoints)]
  );

  // Submissions
  for (const sub of (d.recentSubmissions || [])) {
    await query(
      `INSERT INTO hackerrank_recent_submissions
         (student_email, challenge_slug, challenge_name, language, status,
          score, track, difficulty, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (student_email, challenge_slug) DO UPDATE SET
         language=EXCLUDED.language, status=EXCLUDED.status,
         score=EXCLUDED.score, track=EXCLUDED.track,
         difficulty=EXCLUDED.difficulty, submitted_at=EXCLUDED.submitted_at`,
      [email, sub.challengeSlug, sub.challengeName, sub.language, sub.status,
       sub.score, sub.track, sub.difficulty, sub.submittedAt]
    );
  }
}

// Main re-sync
async function main() {
  const students = await query(`
    SELECT s.email,
      pp_cf.username as cf_handle,
      pp_cc.username as cc_handle,
      pp_hr.username as hr_handle
    FROM students s
    LEFT JOIN platform_profiles pp_cf ON s.email=pp_cf.student_email AND pp_cf.platform_name='codeforces'
    LEFT JOIN platform_profiles pp_cc ON s.email=pp_cc.student_email AND pp_cc.platform_name='codechef'
    LEFT JOIN platform_profiles pp_hr ON s.email=pp_hr.student_email AND pp_hr.platform_name='hackerrank'
    ORDER BY s.email
  `);

  for (const student of students.rows) {
    console.log(`\n=== Syncing ${student.email} ===`);

    // Codeforces
    if (student.cf_handle) {
      console.log(`  [CF] syncing ${student.cf_handle}...`);
      try {
        const cfData = await cfScraper.getFullProfile(student.cf_handle);
        if (cfData) {
          await upsertCF(student.email, cfData);
          console.log(`  [CF] ✓ solved=${cfData.totalSolved} subs=${cfData.totalSubmissions} tags=${cfData.tagStats?.length}`);
        } else {
          console.log(`  [CF] ✗ null result`);
        }
      } catch(e) {
        console.error(`  [CF] ✗ error: ${e.message}`);
      }
      await sleep(3000); // CF rate limit
    }

    // CodeChef
    if (student.cc_handle) {
      console.log(`  [CC] syncing ${student.cc_handle}...`);
      try {
        const ccData = await ccScraper.getFullProfile(student.cc_handle);
        if (ccData) {
          await upsertCC(student.email, ccData);
          console.log(`  [CC] ✓ rating=${ccData.currentRating} solved=${ccData.totalSolved} heatmap=${ccData.heatMap?.length} contests=${ccData.contestHistory?.length}`);
        } else {
          console.log(`  [CC] ✗ null result`);
        }
      } catch(e) {
        console.error(`  [CC] ✗ error: ${e.message}`);
      }
      await sleep(2000);
    }

    // HackerRank
    if (student.hr_handle) {
      console.log(`  [HR] syncing ${student.hr_handle}...`);
      try {
        const hrData = await hrScraper.getFullProfile(student.hr_handle);
        if (hrData) {
          await upsertHR(student.email, hrData);
          console.log(`  [HR] ✓ points=${hrData.totalPoints} badges=${hrData.badges?.length} tracks=${hrData.trackScores?.length}`);
        } else {
          console.log(`  [HR] ✗ null result`);
        }
      } catch(e) {
        console.error(`  [HR] ✗ error: ${e.message}`);
      }
      await sleep(2000);
    }
  }

  console.log('\n✅ Full re-sync complete');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
