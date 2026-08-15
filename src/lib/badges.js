// Badge catalogue and evaluation.
//
// Each badge is a pure predicate over a snapshot of the user's state, so
// awarding is idempotent: we re-evaluate everything on every data change and
// grant whatever isn't already unlocked. The unlock doc ID is the badge key,
// so re-granting is a harmless no-op (see services.grantUnlock).

export const BADGES = [
  // --- Build-habit streaks ---
  { key: 'streak_3', label: 'Getting Started', emoji: '🌱', tier: 'bronze', description: 'A 3-day streak on any habit', test: (s) => s.bestCurrentStreak >= 3 },
  { key: 'streak_7', label: 'One Week Strong', emoji: '🔥', tier: 'bronze', description: 'A 7-day streak', test: (s) => s.bestCurrentStreak >= 7 },
  { key: 'streak_14', label: 'Fortnight Fighter', emoji: '⚡', tier: 'silver', description: 'A 14-day streak', test: (s) => s.bestCurrentStreak >= 14 },
  { key: 'streak_30', label: 'Month Master', emoji: '🏅', tier: 'silver', description: 'A 30-day streak', test: (s) => s.bestCurrentStreak >= 30 },
  { key: 'streak_60', label: 'Unshakeable', emoji: '💎', tier: 'gold', description: 'A 60-day streak', test: (s) => s.bestCurrentStreak >= 60 },
  { key: 'streak_100', label: 'Centurion', emoji: '👑', tier: 'gold', description: 'A 100-day streak', test: (s) => s.bestCurrentStreak >= 100 },
  { key: 'streak_365', label: 'Year of Iron', emoji: '🌟', tier: 'mythic', description: 'A 365-day streak', test: (s) => s.bestCurrentStreak >= 365 },

  // --- Volume ---
  { key: 'checkins_10', label: 'Ten Down', emoji: '✅', tier: 'bronze', description: '10 total check-ins', test: (s) => s.totalCheckIns >= 10 },
  { key: 'checkins_50', label: 'Half Century', emoji: '🎯', tier: 'silver', description: '50 total check-ins', test: (s) => s.totalCheckIns >= 50 },
  { key: 'checkins_250', label: 'Relentless', emoji: '🚀', tier: 'gold', description: '250 total check-ins', test: (s) => s.totalCheckIns >= 250 },
  { key: 'checkins_1000', label: 'Machine', emoji: '🤖', tier: 'mythic', description: '1000 total check-ins', test: (s) => s.totalCheckIns >= 1000 },

  // --- Quitting ---
  { key: 'clean_1', label: 'Day One', emoji: '🌅', tier: 'bronze', description: 'One clean day on a habit you’re quitting', test: (s) => s.bestCleanStreak >= 1 },
  { key: 'clean_7', label: 'Clean Week', emoji: '🛡️', tier: 'bronze', description: '7 days clean', test: (s) => s.bestCleanStreak >= 7 },
  { key: 'clean_30', label: 'Thirty Free', emoji: '🕊️', tier: 'silver', description: '30 days clean', test: (s) => s.bestCleanStreak >= 30 },
  { key: 'clean_90', label: 'Quarter Clean', emoji: '🏔️', tier: 'gold', description: '90 days clean', test: (s) => s.bestCleanStreak >= 90 },
  { key: 'clean_365', label: 'Free For Good', emoji: '🦅', tier: 'mythic', description: '365 days clean', test: (s) => s.bestCleanStreak >= 365 },
  { key: 'urges_10', label: 'Urge Surfer', emoji: '🌊', tier: 'silver', description: 'Resisted 10 logged urges', test: (s) => s.urgesResisted >= 10 },
  { key: 'comeback', label: 'Comeback Kid', emoji: '💪', tier: 'silver', description: 'Rebuilt a 7-day clean streak after a slip', test: (s) => s.hasComeback },

  // --- Goals ---
  { key: 'goal_first', label: 'Goal Getter', emoji: '🎉', tier: 'bronze', description: 'Completed your first goal', test: (s) => s.goalsCompleted >= 1 },
  { key: 'goal_5', label: 'Finisher', emoji: '🏆', tier: 'silver', description: 'Completed 5 goals', test: (s) => s.goalsCompleted >= 5 },
  { key: 'goal_10', label: 'Unstoppable', emoji: '🥇', tier: 'gold', description: 'Completed 10 goals', test: (s) => s.goalsCompleted >= 10 },

  // --- Levels ---
  { key: 'level_5', label: 'Level 5', emoji: '⭐', tier: 'bronze', description: 'Reached level 5', test: (s) => s.level >= 5 },
  { key: 'level_10', label: 'Level 10', emoji: '✨', tier: 'silver', description: 'Reached level 10', test: (s) => s.level >= 10 },
  { key: 'level_25', label: 'Level 25', emoji: '💫', tier: 'gold', description: 'Reached level 25', test: (s) => s.level >= 25 },

  // --- Consistency ---
  { key: 'perfect_week', label: 'Perfect Week', emoji: '📆', tier: 'silver', description: 'Every scheduled habit done for a full week', test: (s) => s.perfectWeeks >= 1 },
  { key: 'perfect_month', label: 'Flawless Month', emoji: '🗓️', tier: 'gold', description: 'Four perfect weeks in a row', test: (s) => s.perfectWeeks >= 4 },
  { key: 'early_bird', label: 'Early Bird', emoji: '🐦', tier: 'bronze', description: 'Checked in before 7am', test: (s) => s.earlyCheckIn },
  { key: 'night_owl', label: 'Night Owl', emoji: '🦉', tier: 'bronze', description: 'Checked in after 11pm', test: (s) => s.nightCheckIn },
];

export const BADGES_BY_KEY = Object.fromEntries(BADGES.map((b) => [b.key, b]));

export const TIER_STYLES = {
  bronze: 'from-amber-500 to-orange-600',
  silver: 'from-slate-300 to-slate-500',
  gold: 'from-yellow-300 to-amber-500',
  mythic: 'from-fuchsia-400 via-violet-500 to-cyan-400',
};

/**
 * Given a stats snapshot and the set of already-unlocked keys, return the
 * badges that should now be granted.
 */
export function evaluateBadges(snapshot, unlockedKeys = new Set()) {
  return BADGES.filter((badge) => !unlockedKeys.has(badge.key) && safeTest(badge, snapshot));
}

const safeTest = (badge, snapshot) => {
  try {
    return Boolean(badge.test(snapshot));
  } catch {
    return false;
  }
};
