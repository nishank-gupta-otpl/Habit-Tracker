// XP, levels and the point economy.
//
// The curve is quadratic-ish: level N needs 50 * N * (N-1) total XP. Early
// levels arrive fast (level 2 at 100 XP, roughly four days of check-ins) and
// then stretch out, which is the shape that keeps a tracker rewarding without
// running out of runway.

export const XP = {
  CHECK_IN: 10,
  STREAK_BONUS_PER_DAY: 2, // added per day of streak, capped below
  STREAK_BONUS_CAP: 30,
  CLEAN_DAY: 12, // staying clean is worth slightly more than a build check-in
  SLIP: 0, // honesty is never punished with negative XP
  URGE_RESISTED: 5,
  GOAL_PROGRESS: 8,
  MILESTONE: 25,
  GOAL_COMPLETE: 150,
  PERFECT_WEEK: 75,
};

/** Total XP required to have reached a given level. */
export const xpForLevel = (level) => 50 * level * (level - 1);

/** Level from a lifetime XP total. */
export function levelFromXp(xp) {
  const safe = Math.max(0, xp || 0);
  // Invert xpForLevel: level = floor((1 + sqrt(1 + 4*xp/50)) / 2)
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * safe) / 50)) / 2));
}

/** Everything the XP bar needs in one call. */
export function levelProgress(xp) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const into = (xp || 0) - floor;
  const span = ceiling - floor;
  return {
    level,
    xp: xp || 0,
    xpIntoLevel: into,
    xpForNextLevel: span,
    xpRemaining: ceiling - (xp || 0),
    percent: span > 0 ? Math.min(100, Math.round((into / span) * 100)) : 0,
  };
}

/** XP for a build-habit check-in, including the streak bonus. */
export function checkInXp(streakAfterCheckIn = 0) {
  const bonus = Math.min(XP.STREAK_BONUS_CAP, Math.max(0, streakAfterCheckIn - 1) * XP.STREAK_BONUS_PER_DAY);
  return XP.CHECK_IN + bonus;
}

/** XP for logging a clean day on a quit habit. */
export function cleanDayXp(cleanStreak = 0) {
  const bonus = Math.min(XP.STREAK_BONUS_CAP, Math.max(0, cleanStreak - 1) * XP.STREAK_BONUS_PER_DAY);
  return XP.CLEAN_DAY + bonus;
}

/** Playful rank shown next to the level number. */
export function levelTitle(level) {
  if (level >= 40) return 'Mythic';
  if (level >= 30) return 'Legend';
  if (level >= 22) return 'Champion';
  if (level >= 15) return 'Veteran';
  if (level >= 10) return 'Adept';
  if (level >= 6) return 'Apprentice';
  if (level >= 3) return 'Rookie';
  return 'Beginner';
}
