// Test LeetCode GQL fields one by one
const axios = require('axios');
const GQL = 'https://leetcode.com/graphql';
const H = { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com', 'User-Agent': 'Mozilla/5.0' };

async function test(label, query, variables) {
  try {
    const r = await axios.post(GQL, { query, variables }, { headers: H, timeout: 15000 });
    if (r.data.errors) {
      console.log(`❌ ${label}: ${r.data.errors[0].message}`);
    } else {
      const keys = Object.keys(r.data.data || {});
      console.log(`✅ ${label}: ${JSON.stringify(keys)}`);
    }
  } catch (e) {
    console.log(`❌ ${label}: ${e.response?.status} ${e.message}`);
  }
}

async function run() {
  const u = 'gowrishjanapareddy';

  // Test 1: Basic profile
  await test('basic profile', `
    query T($u: String!) {
      matchedUser(username: $u) {
        username
        profile { realName userAvatar school company countryName ranking }
      }
    }`, { u });

  // Test 2: Language stats
  await test('language stats', `
    query T($u: String!) {
      matchedUser(username: $u) { languageProblemCount { languageName problemsSolved } }
    }`, { u });

  // Test 3: Tag stats
  await test('tag problem counts', `
    query T($u: String!) {
      matchedUser(username: $u) {
        tagProblemCounts {
          advanced { tagName problemsSolved }
          intermediate { tagName problemsSolved }
          fundamental { tagName problemsSolved }
        }
      }
    }`, { u });

  // Test 4: Badges
  await test('badges', `
    query T($u: String!) {
      matchedUser(username: $u) {
        badges { name displayName icon creationDate }
        upcomingBadges { name icon progress }
        activeBadge { name icon }
      }
    }`, { u });

  // Test 5: Calendar with year
  await test('calendar year=2025', `
    query T($u: String!, $year: Int!) {
      matchedUser(username: $u) {
        userCalendar(year: $year) { streak totalActiveDays submissionCalendar }
      }
    }`, { u, year: 2025 });

  // Test 6: Calendar without year
  await test('calendar no year', `
    query T($u: String!) {
      matchedUser(username: $u) {
        userCalendar { streak totalActiveDays submissionCalendar }
      }
    }`, { u });

  // Test 7: problemsSolvedBeatsStats as root
  await test('beats stats', `
    query T($u: String!) {
      problemsSolvedBeatsStats(username: $u) { difficulty percentage }
    }`, { u });

  // Test 8: Contest ranking
  await test('contest ranking', `
    query T($u: String!) {
      userContestRanking(username: $u) { rating globalRanking attendedContestsCount }
      userContestRankingHistory(username: $u) {
        attended trendDirection rating ranking problemsSolved totalProblems finishTimeInSeconds
        contest { title startTime }
      }
    }`, { u });

  // Test 9: Recent AC submissions
  await test('recent ac submissions', `
    query T($u: String!) {
      recentAcSubmissionList(username: $u, limit: 5) { id title titleSlug timestamp }
    }`, { u });
}

run();
