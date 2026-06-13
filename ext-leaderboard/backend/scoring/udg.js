// scoring/udg.js
// Unified Difficulty Grade — exact same as main project's UDG system.
// Tier points: T1=1, T2=2, T3=4, T4=7, T5=11, T6=16
'use strict';

const TIER_POINTS = [0, 1, 2, 4, 7, 11, 16];

function lcTier(tag, acceptanceRate, totalSubmissions = 999999) {
  const acc  = Number(acceptanceRate) || 0;
  const subs = Number(totalSubmissions);
  const t    = (tag || '').toLowerCase();

  if (subs < 1000) {
    if (t === 'easy')   return 2;
    if (t === 'medium') return 4;
    if (t === 'hard')   return 5;
    return 3;
  }

  if (t === 'easy') {
    if (acc > 65) return 1;
    return 2;
  }
  if (t === 'medium') {
    if (acc > 60)  return 2;
    if (acc > 39)  return 3;
    if (acc > 25)  return 4;
    return 5;
  }
  // hard
  if (acc > 45) return 5;
  return 6;
}

// For static profile totals: map Easy/Medium/Hard to a representative tier
// Easy  → T2 (2 pts avg), Medium → T3/T4 mix → use T3 (4 pts), Hard → T5 (11 pts)
const STATIC_LC_TIER = { Easy: 2, Medium: 3, Hard: 5 };
const STATIC_LC_PTS  = { Easy: 2, Medium: 4, Hard: 11 };

module.exports = { TIER_POINTS, lcTier, STATIC_LC_TIER, STATIC_LC_PTS };
