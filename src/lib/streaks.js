// Streak engine.
//
// Shared by both habit collections so the two can't drift apart, even though
// `habits` and `quitHabits` are stored separately.
//
// Rules, decided up front and applied consistently:
//   - `done`    extends a build streak.
//   - `skipped` is a planned rest day: it does NOT break a streak, but it does
//     not extend it either. This keeps "I deliberately took Sunday off" from
//     wiping out three weeks of work.
//   - a scheduled day with no entry breaks the streak — but only once it is in
//     the past. Today being blank is "not yet", not a failure.
//   - `slip` resets a quit habit's clean streak to zero.

import { daysBetween, dayOfWeek, keyRange, prevKey, todayKey } from './dates';
import { ENTRY_STATUS, FREQUENCY } from '../firebase/schema';

/** Index a flat entries array by day key for one habit. */
export function entriesForHabit(entries, habitId) {
  const map = {};
  for (const entry of entries) {
    if (entry.habitId === habitId) map[entry.dayKey] = entry;
  }
  return map;
}

const isScheduledDay = (habit, dayKey) => {
  if (habit.frequency === FREQUENCY.CUSTOM) return (habit.daysOfWeek || []).includes(dayOfWeek(dayKey));
  return true; // daily, and weekly-quota habits (handled separately)
};

/**
 * Current and longest streak for a habit you're building.
 * Returns { current, longest, total, lastCheckInDate, completionRate }.
 */
export function computeBuildStreak(habit, entryMap, timezone) {
  const today = todayKey(timezone);
  if (habit.frequency === FREQUENCY.WEEKLY) return computeWeeklyStreak(habit, entryMap, timezone);

  const done = (key) => entryMap[key]?.status === ENTRY_STATUS.DONE;
  const skipped = (key) => entryMap[key]?.status === ENTRY_STATUS.SKIPPED;

  // Walk backwards from today. Today not being done yet is not a break, so we
  // start the walk at yesterday when today is still blank.
  let cursor = done(today) || skipped(today) ? today : prevKey(today);
  let current = 0;
  const floor = habit.startDate || '1970-01-01';

  while (daysBetween(cursor, floor) >= 0) {
    if (!isScheduledDay(habit, cursor)) {
      cursor = prevKey(cursor);
      continue;
    }
    if (done(cursor)) {
      current += 1;
    } else if (skipped(cursor)) {
      // Neutral — keep walking without incrementing.
    } else {
      break;
    }
    cursor = prevKey(cursor);
  }

  // Longest streak needs a forward pass over the full recorded history.
  const keys = Object.keys(entryMap).sort();
  let longest = 0;
  let running = 0;
  let previous = null;
  for (const key of keys) {
    const status = entryMap[key].status;
    if (status !== ENTRY_STATUS.DONE && status !== ENTRY_STATUS.SKIPPED) {
      running = 0;
      previous = key;
      continue;
    }
    if (previous) {
      // Any *scheduled* gap between the two entries breaks the run.
      const gap = keyRange(previous, key).slice(1, -1);
      if (gap.some((k) => isScheduledDay(habit, k))) running = 0;
    }
    if (status === ENTRY_STATUS.DONE) running += 1;
    longest = Math.max(longest, running);
    previous = key;
  }

  const doneKeys = keys.filter((k) => entryMap[k].status === ENTRY_STATUS.DONE);
  const scheduledSoFar = keyRange(habit.startDate || today, today).filter((k) => isScheduledDay(habit, k));

  return {
    current,
    longest: Math.max(longest, current),
    total: doneKeys.length,
    lastCheckInDate: doneKeys.length ? doneKeys[doneKeys.length - 1] : null,
    completionRate: scheduledSoFar.length ? doneKeys.length / scheduledSoFar.length : 0,
  };
}

/**
 * "N times per week" habits: the streak counts consecutive weeks that hit
 * quota. The in-flight week counts as long as it is still achievable.
 */
function computeWeeklyStreak(habit, entryMap, timezone) {
  const today = todayKey(timezone);
  const quota = habit.timesPerWeek || 3;
  const doneKeys = Object.keys(entryMap)
    .filter((k) => entryMap[k].status === ENTRY_STATUS.DONE)
    .sort();

  const weekOf = (key) => {
    // ISO-ish week bucket: shift back to the most recent Monday.
    const dow = dayOfWeek(key);
    const back = (dow + 6) % 7;
    let cursor = key;
    for (let i = 0; i < back; i += 1) cursor = prevKey(cursor);
    return cursor;
  };

  const counts = {};
  for (const key of doneKeys) {
    const week = weekOf(key);
    counts[week] = (counts[week] || 0) + 1;
  }

  let current = 0;
  let cursorWeek = weekOf(today);
  const thisWeekCount = counts[cursorWeek] || 0;
  if (thisWeekCount >= quota) current += 1;
  // Step back a week at a time while quota was met.
  cursorWeek = prevKey(cursorWeek);
  for (let i = 0; i < 260; i += 1) {
    const week = weekOf(cursorWeek);
    if ((counts[week] || 0) >= quota) {
      current += 1;
      cursorWeek = prevKey(week);
    } else {
      break;
    }
  }

  const weeks = Object.keys(counts).sort();
  let longest = 0;
  let running = 0;
  let previousWeek = null;
  for (const week of weeks) {
    if (counts[week] < quota) {
      running = 0;
      previousWeek = week;
      continue;
    }
    if (previousWeek && daysBetween(week, previousWeek) > 7) running = 0;
    running += 1;
    longest = Math.max(longest, running);
    previousWeek = week;
  }

  return {
    current,
    longest: Math.max(longest, current),
    total: doneKeys.length,
    lastCheckInDate: doneKeys.length ? doneKeys[doneKeys.length - 1] : null,
    completionRate: thisWeekCount / quota,
    thisWeekCount,
    quota,
    unit: 'weeks',
  };
}

/**
 * Quit habits. The headline number is "days since last slip", counted from the
 * slip date (or the quit date if you've never slipped).
 */
export function computeCleanStreak(quitHabit, entryMap, timezone) {
  const today = todayKey(timezone);
  const keys = Object.keys(entryMap).sort();
  const slipKeys = keys.filter((k) => entryMap[k].status === ENTRY_STATUS.SLIP);
  const cleanKeys = keys.filter((k) => entryMap[k].status === ENTRY_STATUS.CLEAN);

  const lastSlipDate = slipKeys.length ? slipKeys[slipKeys.length - 1] : null;
  const anchor = lastSlipDate || quitHabit.quitDate || quitHabit.startDate || today;

  // Days since the anchor. A slip today means zero days clean.
  const daysSince = Math.max(0, daysBetween(today, anchor) - (lastSlipDate ? 0 : -1));
  const current = lastSlipDate ? daysBetween(today, lastSlipDate) : daysBetween(today, anchor) + 1;

  // Longest clean run across all history.
  let longest = 0;
  let runStart = quitHabit.quitDate || quitHabit.startDate || today;
  for (const slip of slipKeys) {
    longest = Math.max(longest, Math.max(0, daysBetween(slip, runStart)));
    runStart = slip;
  }
  longest = Math.max(longest, Math.max(0, daysBetween(today, runStart)));

  return {
    current: Math.max(0, current),
    longest: Math.max(longest, Math.max(0, current)),
    daysSinceLastSlip: daysSince,
    lastSlipDate,
    totalSlips: slipKeys.length,
    totalCleanDays: cleanKeys.length,
  };
}

/** Have the cached numbers drifted from the recomputed truth? */
export function cacheIsStale(cache = {}, computed = {}) {
  return Object.entries(computed).some(([key, value]) => {
    if (!(key in cache)) return false;
    return cache[key] !== value;
  });
}
