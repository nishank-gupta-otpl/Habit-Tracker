// ---------------------------------------------------------------------------
// FIRESTORE SCHEMA — single source of truth for every document shape.
//
// Everything lives under users/{uid} even though this is a single-user app.
// That costs nothing and makes the security rules a one-liner, while leaving
// the door open to a second account (partner, test account) without migration.
//
//   users/{uid}                            profile + settings + lifetime stats
//   users/{uid}/habits/{habitId}           habits to BUILD
//   users/{uid}/quitHabits/{habitId}       habits to QUIT
//   users/{uid}/entries/{habitId_date}     one check-in per habit per day
//   users/{uid}/urges/{urgeId}             urge/trigger log (quit habits, many/day)
//   users/{uid}/goals/{goalId}             goals with measurable progress
//   users/{uid}/goals/{goalId}/progress/{id}  progress-update log
//   users/{uid}/rewards/{rewardId}         user-defined custom rewards
//   users/{uid}/unlocks/{unlockId}         earned badges + cosmetic unlocks
//
// DESIGN DECISIONS (confirmed with the owner before any UI was written):
//
// 1. Check-ins live in ONE flat `entries` collection, not nested under each
//    habit. The doc ID is `${habitId}_${YYYY-MM-DD}`, which makes writes
//    idempotent (checking in twice on the same day overwrites, never
//    duplicates) and lets a single date-range listener feed the dashboard,
//    calendar and trend charts at once.
//
// 2. `habits` and `quitHabits` are SEPARATE collections (owner's call). The
//    streak maths is shared in lib/streaks.js so the two can't drift, but the
//    stored shapes stay independent — quit habits carry slip/urge fields that
//    would be dead weight on a build habit.
//
// 3. Goals store BOTH a current value (for instant % complete) and a progress
//    subcollection (for the trend chart and pace tracking). The log is the
//    audit trail; `current` is the fast read.
//
// 4. Urges are their own collection because there can be many per day, whereas
//    an entry is strictly one per habit per day. Keeping them apart stops the
//    day's entry doc from growing without bound.
//
// 5. DATES ARE LOCAL `YYYY-MM-DD` STRINGS, not timestamps. A streak is a human
//    concept anchored to the user's own midnight, so the day key is computed in
//    the user's timezone (stored in settings.timezone) and compared as a
//    string. Timestamps are kept alongside for ordering/audit only.
//    ASSUMPTION: the owner does not frequently cross timezones. If that changes,
//    historical day keys stay as-recorded rather than shifting retroactively —
//    which is the behaviour you want for a habit tracker.
// ---------------------------------------------------------------------------

import { serverTimestamp } from 'firebase/firestore';

export const COLLECTIONS = {
  HABITS: 'habits',
  QUIT_HABITS: 'quitHabits',
  ENTRIES: 'entries',
  URGES: 'urges',
  GOALS: 'goals',
  GOAL_PROGRESS: 'progress',
  REWARDS: 'rewards',
  UNLOCKS: 'unlocks',
};

/** Habit cadence. `custom` uses daysOfWeek; `weekly` uses timesPerWeek. */
export const FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  CUSTOM: 'custom',
};

/** Entry status. Build habits use done/skipped; quit habits use clean/slip. */
export const ENTRY_STATUS = {
  DONE: 'done',
  SKIPPED: 'skipped',
  CLEAN: 'clean',
  SLIP: 'slip',
};

export const GOAL_TYPE = {
  NUMERIC: 'numeric',
  MILESTONE: 'milestone',
};

export const GOAL_DIRECTION = {
  INCREASE: 'increase',
  DECREASE: 'decrease',
};

export const UNLOCK_TYPE = {
  BADGE: 'badge',
  THEME: 'theme',
  REWARD: 'reward',
};

/** Composite entry ID — the mechanism that makes check-ins idempotent. */
export const entryId = (habitId, dayKey) => `${habitId}_${dayKey}`;

// --- Document factories -----------------------------------------------------
// Every write goes through one of these so no field is ever silently missing.

export function newUserDoc({ uid, displayName, email, photoURL, timezone }) {
  return {
    uid,
    displayName: displayName || 'Habit Hero',
    email: email || null,
    photoURL: photoURL || null,
    createdAt: serverTimestamp(),
    settings: {
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      weekStartsOn: 1, // Monday
      theme: 'nebula', // the free starter theme
      notificationsEnabled: false,
      fcmTokens: [],
      // Which cards appear on the home screen. Empty array = show everything,
      // which is the right default before the user has customised anything.
      dashboardHabits: [],
      dashboardQuitHabits: [],
      dashboardGoals: [],
      // Per-card field visibility — drives the "customisable dashboard".
      cardFields: {
        startDate: false,
        targetDate: true,
        percentComplete: true,
        currentStreak: true,
        points: true,
        lastCheckIn: false,
      },
      // Optional extras, off by default so v1 stays lean.
      features: {
        weeklyReview: true,
        trends: true,
        urgeLogging: true,
      },
    },
    stats: {
      xp: 0,
      level: 1,
      totalCheckIns: 0,
      totalSlips: 0,
      longestStreakEver: 0,
      goalsCompleted: 0,
    },
  };
}

export function newHabit({
  name,
  emoji = '✅',
  color = 'violet',
  frequency = FREQUENCY.DAILY,
  daysOfWeek = [1, 2, 3, 4, 5, 6, 0],
  timesPerWeek = 3,
  startDate,
  targetValue = null,
  unit = null,
  reminder = null,
  notes = '',
}) {
  return {
    name,
    emoji,
    color,
    frequency,
    daysOfWeek,
    timesPerWeek,
    startDate, // YYYY-MM-DD
    targetValue, // e.g. 20 (push-ups) — null means a simple yes/no habit
    unit, // e.g. 'reps', 'minutes'
    notes,
    reminder, // { enabled, time: 'HH:mm', days: [0-6] }
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // Denormalised cache so habit cards render without scanning entries.
    // lib/streaks.js recomputes from entries and writes back when they differ,
    // so a stale cache self-heals rather than corrupting history.
    cache: {
      currentStreak: 0,
      longestStreak: 0,
      totalCheckIns: 0,
      lastCheckInDate: null,
    },
  };
}

export function newQuitHabit({
  name,
  emoji = '🚭',
  color = 'rose',
  startDate,
  quitDate,
  reminder = null,
  notes = '',
  motivation = '',
  commonTriggers = [],
  costPerSlip = null,
  unit = null,
}) {
  return {
    name,
    emoji,
    color,
    startDate, // YYYY-MM-DD — when tracking began
    quitDate, // YYYY-MM-DD — the "clean since" anchor
    notes,
    motivation, // shown in the urge-logging flow as a nudge
    commonTriggers, // string[] preset trigger tags for fast logging
    costPerSlip, // optional money/calorie cost, powers "saved so far"
    unit, // label for costPerSlip, e.g. '£', 'cigarettes'
    reminder,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    cache: {
      currentCleanStreak: 0,
      longestCleanStreak: 0,
      totalSlips: 0,
      totalCleanDays: 0,
      lastSlipDate: null,
    },
  };
}

export function newEntry({ habitId, habitType, dayKey, status, value = null, note = '', xpAwarded = 0 }) {
  return {
    habitId,
    habitType, // 'build' | 'quit' — tells us which collection habitId points at
    dayKey, // YYYY-MM-DD, local to the user's timezone
    status, // ENTRY_STATUS
    value, // numeric progress for measurable habits
    note,
    xpAwarded, // recorded so undoing a check-in can reverse exactly what it gave
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function newUrge({ quitHabitId, dayKey, trigger = '', intensity = 3, resisted = true, note = '' }) {
  return {
    quitHabitId,
    dayKey,
    trigger, // free text or one of the habit's commonTriggers
    intensity, // 1-5
    resisted, // false means it turned into a slip
    note,
    createdAt: serverTimestamp(),
  };
}

export function newGoal({
  title,
  emoji = '🎯',
  color = 'amber',
  type = GOAL_TYPE.NUMERIC,
  direction = GOAL_DIRECTION.INCREASE,
  startDate,
  targetDate,
  startValue = 0,
  currentValue = 0,
  targetValue = 100,
  unit = '',
  milestones = [],
  linkedHabitIds = [],
  reminder = null,
  notes = '',
}) {
  return {
    title,
    emoji,
    color,
    type, // numeric | milestone
    direction, // increase (0 -> 100) | decrease (90kg -> 75kg)
    startDate,
    targetDate,
    startValue, // the baseline % complete is measured from
    currentValue,
    targetValue,
    unit,
    // Bounded array on the doc — milestone lists are short, so a subcollection
    // would be overkill. Each: { id, label, done, doneAt }
    milestones,
    linkedHabitIds, // habits that feed this goal, for the "why" on a card
    reminder,
    notes,
    status: 'active', // active | completed | abandoned
    completedAt: null,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function newGoalProgress({ value, delta, note = '', dayKey }) {
  return {
    value, // absolute value after this update
    delta, // change vs the previous update
    note,
    dayKey,
    createdAt: serverTimestamp(),
  };
}

export function newReward({ title, emoji = '🎁', description = '', trigger }) {
  return {
    title,
    emoji,
    description,
    // What earns it: { kind: 'streak'|'xp'|'level'|'goal'|'manual',
    //                  habitId?, goalId?, threshold? }
    trigger,
    claimed: false,
    claimedAt: null,
    unlockedAt: null,
    createdAt: serverTimestamp(),
  };
}

export function newUnlock({ key, type, label, emoji = '🏆', meta = {} }) {
  return {
    key, // stable ID from lib/badges.js or lib/themes.js — also the doc ID
    type, // UNLOCK_TYPE
    label,
    emoji,
    meta,
    seen: false, // drives the "new!" pop-up
    unlockedAt: serverTimestamp(),
  };
}
