// Day-key handling.
//
// The whole app agrees that a "day" is a local `YYYY-MM-DD` string. Streaks are
// a human concept anchored to the user's own midnight, so we never compare raw
// timestamps — we compare day keys as strings, which sidesteps every DST and
// UTC-offset trap in one move.

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';

/** Today's key in the user's timezone. Falls back to the device timezone. */
export function todayKey(timezone) {
  return dayKeyFrom(new Date(), timezone);
}

/**
 * Convert a Date to a local `YYYY-MM-DD` key. When a timezone is supplied we
 * format *in that zone* so the key flips at the user's midnight, not UTC's.
 */
export function dayKeyFrom(date, timezone) {
  if (!timezone) return format(date, 'yyyy-MM-dd');
  try {
    // en-CA gives ISO-ordered output (2026-08-15) directly.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return format(date, 'yyyy-MM-dd');
  }
}

/** Parse a day key back into a Date at local midnight (never UTC midnight). */
export function keyToDate(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const shiftKey = (dayKey, days) => format(addDays(keyToDate(dayKey), days), 'yyyy-MM-dd');

export const prevKey = (dayKey) => shiftKey(dayKey, -1);
export const nextKey = (dayKey) => shiftKey(dayKey, 1);

/** Positive when a is after b. */
export const daysBetween = (a, b) => differenceInCalendarDays(keyToDate(a), keyToDate(b));

/** Inclusive list of day keys from start to end. */
export function keyRange(startKey, endKey) {
  if (daysBetween(endKey, startKey) < 0) return [];
  return eachDayOfInterval({ start: keyToDate(startKey), end: keyToDate(endKey) }).map((d) =>
    format(d, 'yyyy-MM-dd'),
  );
}

/** The last n days ending today, oldest first. */
export function lastNDays(n, timezone) {
  const end = todayKey(timezone);
  return keyRange(format(subDays(keyToDate(end), n - 1), 'yyyy-MM-dd'), end);
}

/** 0 = Sunday … 6 = Saturday, matching habit.daysOfWeek. */
export const dayOfWeek = (dayKey) => keyToDate(dayKey).getDay();

/** Calendar grid for a month, padded so weeks line up. */
export function monthGrid(dayKey, weekStartsOn = 1) {
  const date = keyToDate(dayKey);
  const first = startOfMonth(date);
  const last = endOfMonth(date);
  const gridStart = startOfWeek(first, { weekStartsOn });
  const cells = eachDayOfInterval({ start: gridStart, end: last });
  // Pad to a whole number of weeks so the grid never has a ragged last row.
  while (cells.length % 7 !== 0) cells.push(addDays(cells[cells.length - 1], 1));
  return cells.map((d) => ({
    key: format(d, 'yyyy-MM-dd'),
    inMonth: d.getMonth() === date.getMonth(),
    dayNumber: d.getDate(),
  }));
}

export const formatKey = (dayKey, pattern = 'd MMM yyyy') => format(keyToDate(dayKey), pattern);

export const isFutureKey = (dayKey, timezone) => daysBetween(dayKey, todayKey(timezone)) > 0;

/** Human-friendly relative label used across cards. */
export function relativeDayLabel(dayKey, timezone) {
  const diff = daysBetween(todayKey(timezone), dayKey);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  if (diff > 1) return `${diff} days ago`;
  return `in ${Math.abs(diff)} days`;
}

/** Is this habit meant to be done on this day, given its cadence? */
export function isScheduledOn(habit, dayKey) {
  if (!habit) return false;
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'custom') return (habit.daysOfWeek || []).includes(dayOfWeek(dayKey));
  // Weekly ("n times per week") has no fixed days — every day is fair game
  // until the quota is met, so scheduling is handled by the streak engine.
  return true;
}

export { parseISO, format };
