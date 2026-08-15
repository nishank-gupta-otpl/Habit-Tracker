import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { computeBuildStreak, computeCleanStreak } from './streaks';
import { goalPercent, goalPace } from './progress';
import { checkInXp, levelFromXp, levelProgress, xpForLevel } from './xp';
import { GOAL_TYPE } from '../firebase/schema';

// The streak engine is entirely relative to "today", so every test pins the
// clock to Saturday 15 August 2026.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 15, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

const entries = (map) =>
  Object.fromEntries(Object.entries(map).map(([day, status]) => [day, { dayKey: day, status }]));

const daily = (overrides = {}) => ({
  frequency: 'daily',
  startDate: '2026-01-01',
  ...overrides,
});

describe('build streaks', () => {
  it('counts consecutive done days up to today', () => {
    const stats = computeBuildStreak(
      daily(),
      entries({ '2026-08-13': 'done', '2026-08-14': 'done', '2026-08-15': 'done' }),
    );
    expect(stats.current).toBe(3);
  });

  it('does not break the streak when today is not logged yet', () => {
    // Yesterday and the day before are done; today is still blank. That's
    // "not yet", not a failure.
    const stats = computeBuildStreak(
      daily(),
      entries({ '2026-08-13': 'done', '2026-08-14': 'done' }),
    );
    expect(stats.current).toBe(2);
  });

  it('breaks the streak on a missed past day', () => {
    const stats = computeBuildStreak(
      daily(),
      entries({ '2026-08-12': 'done', '2026-08-14': 'done', '2026-08-15': 'done' }),
    );
    expect(stats.current).toBe(2); // 13th was missed
  });

  it('treats a skipped day as a neutral rest day', () => {
    const stats = computeBuildStreak(
      daily(),
      entries({
        '2026-08-12': 'done',
        '2026-08-13': 'done',
        '2026-08-14': 'skipped',
        '2026-08-15': 'done',
      }),
    );
    // Skipped neither extends nor breaks: 3 done days survive the rest day.
    expect(stats.current).toBe(3);
  });

  it('skips over days the habit is not scheduled on', () => {
    // Weekdays only. Today is Saturday, so the streak should reach back
    // through the weekend to Friday without breaking.
    const weekdays = daily({ frequency: 'custom', daysOfWeek: [1, 2, 3, 4, 5] });
    const stats = computeBuildStreak(
      weekdays,
      entries({ '2026-08-13': 'done', '2026-08-14': 'done' }), // Thu + Fri
    );
    expect(stats.current).toBe(2);
  });

  it('reports zero with no entries at all', () => {
    expect(computeBuildStreak(daily(), {}).current).toBe(0);
  });

  it('tracks the longest streak across history', () => {
    const stats = computeBuildStreak(
      daily(),
      entries({
        '2026-08-01': 'done',
        '2026-08-02': 'done',
        '2026-08-03': 'done',
        '2026-08-04': 'done',
        // gap
        '2026-08-14': 'done',
        '2026-08-15': 'done',
      }),
    );
    expect(stats.longest).toBe(4);
    expect(stats.current).toBe(2);
    expect(stats.total).toBe(6);
  });

  it('counts weekly-quota habits in whole weeks', () => {
    const weekly = daily({ frequency: 'weekly', timesPerWeek: 3 });
    const stats = computeBuildStreak(
      weekly,
      entries({
        // week of Mon 10 Aug — quota met
        '2026-08-10': 'done',
        '2026-08-12': 'done',
        '2026-08-14': 'done',
      }),
    );
    expect(stats.current).toBe(1);
    expect(stats.thisWeekCount).toBe(3);
  });
});

describe('quit habits', () => {
  it('counts days since the last slip', () => {
    const stats = computeCleanStreak(
      { quitDate: '2026-01-01' },
      entries({ '2026-08-10': 'slip' }),
    );
    expect(stats.current).toBe(5); // 10th -> 15th
    expect(stats.lastSlipDate).toBe('2026-08-10');
  });

  it('counts from the quit date when there has never been a slip', () => {
    const stats = computeCleanStreak({ quitDate: '2026-08-01' }, {});
    expect(stats.current).toBe(15); // 1st through 15th inclusive
    expect(stats.lastSlipDate).toBeNull();
  });

  it('resets to zero on a slip today', () => {
    const stats = computeCleanStreak(
      { quitDate: '2026-01-01' },
      entries({ '2026-08-15': 'slip' }),
    );
    expect(stats.current).toBe(0);
  });

  it('remembers the best run after a relapse', () => {
    const stats = computeCleanStreak(
      { quitDate: '2026-06-01' },
      entries({ '2026-08-14': 'slip' }),
    );
    expect(stats.current).toBe(1);
    expect(stats.longest).toBeGreaterThan(70); // June 1 -> Aug 14
  });
});

describe('goal progress', () => {
  it('measures a numeric goal from its starting value', () => {
    // 90kg -> 75kg, currently 85kg. Five of fifteen kg lost = 33%.
    expect(
      goalPercent({ type: GOAL_TYPE.NUMERIC, startValue: 90, currentValue: 85, targetValue: 75 }),
    ).toBe(33);
  });

  it('handles increasing goals', () => {
    expect(
      goalPercent({ type: GOAL_TYPE.NUMERIC, startValue: 0, currentValue: 42, targetValue: 100 }),
    ).toBe(42);
  });

  it('clamps overshoot to 100', () => {
    expect(
      goalPercent({ type: GOAL_TYPE.NUMERIC, startValue: 0, currentValue: 150, targetValue: 100 }),
    ).toBe(100);
  });

  it('counts milestones for milestone goals', () => {
    expect(
      goalPercent({
        type: GOAL_TYPE.MILESTONE,
        milestones: [{ done: true }, { done: true }, { done: false }, { done: false }],
      }),
    ).toBe(50);
  });

  it('reports pace against the target date', () => {
    // Halfway through the window, 20% done => behind pace.
    const pace = goalPace(
      {
        type: GOAL_TYPE.NUMERIC,
        startDate: '2026-08-05',
        targetDate: '2026-08-25',
        startValue: 0,
        currentValue: 20,
        targetValue: 100,
      },
      undefined,
    );
    expect(pace.expectedPercent).toBe(50);
    expect(pace.actualPercent).toBe(20);
    expect(pace.onTrack).toBe(false);
    expect(pace.daysLeft).toBe(10);
  });
});

describe('xp and levels', () => {
  it('starts everyone at level 1', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
  });

  it('levels up on the documented curve', () => {
    expect(xpForLevel(2)).toBe(100);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(300)).toBe(3);
  });

  it('never reports a negative or NaN level', () => {
    expect(levelFromXp(-50)).toBe(1);
    expect(levelFromXp(undefined)).toBe(1);
  });

  it('reports progress within the current level', () => {
    const progress = levelProgress(150);
    expect(progress.level).toBe(2);
    expect(progress.xpIntoLevel).toBe(50);
    expect(progress.xpForNextLevel).toBe(200); // 300 - 100
    expect(progress.percent).toBe(25);
  });

  it('grows check-in xp with the streak but caps the bonus', () => {
    expect(checkInXp(1)).toBe(10);
    expect(checkInXp(6)).toBe(20);
    expect(checkInXp(500)).toBe(40); // 10 base + 30 cap
  });
});
