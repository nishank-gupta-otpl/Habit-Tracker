import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from './DataContext';
import {
  awardXp,
  claimReward as claimRewardDoc,
  deleteEntry,
  grantUnlock,
  logUrge,
  markUnlockSeen,
  recordGoalProgress,
  setEntry,
  updateGoal,
  updateReward,
  updateStats,
} from '../firebase/services';
import { ENTRY_STATUS, UNLOCK_TYPE } from '../firebase/schema';
import { checkInXp, cleanDayXp, XP } from '../lib/xp';
import { BADGES_BY_KEY, evaluateBadges } from '../lib/badges';
import { THEMES } from '../lib/themes';
import { goalPercent } from '../lib/progress';
import { todayKey } from '../lib/dates';

const RewardContext = createContext(null);

/**
 * Owns every action that can earn points, so XP maths lives in exactly one
 * place. Also drives the celebration queue (level-ups, badge pop-ups).
 */
export function RewardProvider({ children }) {
  const data = useData();
  const { uid, profile, habitStats, quitStats, goals, urges, unlockedKeys, level, timezone, entryIndex } = data;

  const [celebrations, setCelebrations] = useState([]);
  const [floaters, setFloaters] = useState([]);
  const lastLevel = useRef(null);

  const push = useCallback((celebration) => {
    setCelebrations((q) => [...q, { ...celebration, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const dismissCelebration = useCallback((id) => {
    setCelebrations((q) => q.filter((c) => c.id !== id));
  }, []);

  /** Small "+15 XP" number that floats up from the button you tapped. */
  const floatXp = useCallback((amount, label) => {
    if (!amount) return;
    const id = `${Date.now()}-${Math.random()}`;
    setFloaters((f) => [...f, { id, amount, label }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1100);
  }, []);

  // --- Level-up detection ----------------------------------------------------
  useEffect(() => {
    if (!profile) return;
    const current = level.level;
    if (lastLevel.current === null) {
      lastLevel.current = current; // first load is not a level-up
      return;
    }
    if (current > lastLevel.current) {
      const newThemes = THEMES.filter(
        (t) => t.unlockLevel > lastLevel.current && t.unlockLevel <= current,
      );
      push({ type: 'level', level: current, themes: newThemes });
      newThemes.forEach((theme) =>
        grantUnlock(uid, {
          key: `theme_${theme.key}`,
          type: UNLOCK_TYPE.THEME,
          label: theme.name,
          emoji: theme.emoji,
          meta: { themeKey: theme.key, level: theme.unlockLevel },
        }).catch(() => {}),
      );
      if (profile.stats?.level !== current) updateStats(uid, { level: current }).catch(() => {});
    }
    lastLevel.current = current;
  }, [level.level, profile, push, uid]);

  // --- Badge evaluation ------------------------------------------------------
  // Re-runs on every data change; already-unlocked badges are filtered out, and
  // the unlock write is keyed by badge ID, so double-granting is impossible.
  const snapshot = useMemo(() => {
    const buildStreaks = Object.values(habitStats);
    const cleanStreaks = Object.values(quitStats);
    return {
      level: level.level,
      xp: level.xp,
      totalCheckIns: profile?.stats?.totalCheckIns || 0,
      bestCurrentStreak: buildStreaks.reduce((max, s) => Math.max(max, s.current || 0), 0),
      bestCleanStreak: cleanStreaks.reduce((max, s) => Math.max(max, s.current || 0), 0),
      goalsCompleted: goals.filter((g) => g.status === 'completed').length,
      urgesResisted: urges.filter((u) => u.resisted).length,
      hasComeback: cleanStreaks.some((s) => s.lastSlipDate && s.current >= 7),
      perfectWeeks: profile?.stats?.perfectWeeks || 0,
      earlyCheckIn: profile?.stats?.earlyCheckIn || false,
      nightCheckIn: profile?.stats?.nightCheckIn || false,
    };
  }, [habitStats, quitStats, level, profile, goals, urges]);

  useEffect(() => {
    if (!uid || !profile) return;
    const earned = evaluateBadges(snapshot, unlockedKeys);
    earned.forEach((badge) => {
      grantUnlock(uid, {
        key: badge.key,
        type: UNLOCK_TYPE.BADGE,
        label: badge.label,
        emoji: badge.emoji,
        meta: { tier: badge.tier, description: badge.description },
      })
        .then(() => push({ type: 'badge', badge }))
        .catch(() => {});
    });
  }, [snapshot, unlockedKeys, uid, profile, push]);

  // --- Custom rewards --------------------------------------------------------
  // A reward "unlocks" the moment its trigger condition is met; claiming it is
  // a separate, deliberate act by the user.
  useEffect(() => {
    if (!uid) return;
    data.rewards
      .filter((r) => !r.unlockedAt && rewardConditionMet(r, { habitStats, quitStats, goals, level }))
      .forEach((reward) => {
        updateReward(uid, reward.id, { unlockedAt: new Date() })
          .then(() => push({ type: 'reward', reward }))
          .catch(() => {});
      });
  }, [data.rewards, habitStats, quitStats, goals, level, uid, push]);

  // --- Actions ---------------------------------------------------------------

  /** Check in (or un-check) a habit you're building. */
  const checkInHabit = useCallback(
    async (habit, dayKey, { status = ENTRY_STATUS.DONE, value = null, note = '' } = {}) => {
      const existing = entryIndex[habit.id]?.[dayKey];

      // Tapping an already-done day undoes it, refunding exactly the XP that
      // entry granted — that's why xpAwarded is stored on the entry.
      if (existing && existing.status === status) {
        await deleteEntry(uid, habit.id, dayKey);
        if (existing.xpAwarded) await awardXp(uid, -existing.xpAwarded);
        return { undone: true };
      }

      const streakAfter = (habitStats[habit.id]?.current || 0) + 1;
      const gained = status === ENTRY_STATUS.DONE ? checkInXp(streakAfter) : 0;

      await setEntry(uid, {
        habitId: habit.id,
        habitType: 'build',
        dayKey,
        status,
        value,
        note,
        xpAwarded: gained,
      });
      if (gained) {
        await awardXp(uid, gained);
        floatXp(gained, habit.name);
        await recordTimeOfDayFlags(uid, profile);
      }
      return { gained, streak: streakAfter };
    },
    [uid, entryIndex, habitStats, floatXp, profile],
  );

  /** Log a day on a quit habit as clean or as a slip. */
  const logQuitDay = useCallback(
    async (habit, dayKey, status, note = '') => {
      const existing = entryIndex[habit.id]?.[dayKey];
      if (existing && existing.status === status) {
        await deleteEntry(uid, habit.id, dayKey);
        if (existing.xpAwarded) await awardXp(uid, -existing.xpAwarded);
        return { undone: true };
      }

      const streakAfter = (quitStats[habit.id]?.current || 0) + 1;
      const gained = status === ENTRY_STATUS.CLEAN ? cleanDayXp(streakAfter) : XP.SLIP;

      // A slip refunds whatever the day previously earned, so flipping clean ->
      // slip can't leave phantom XP behind.
      if (existing?.xpAwarded) await awardXp(uid, -existing.xpAwarded);

      await setEntry(uid, {
        habitId: habit.id,
        habitType: 'quit',
        dayKey,
        status,
        note,
        xpAwarded: gained,
      });
      if (gained) {
        await awardXp(uid, gained);
        floatXp(gained, habit.name);
      }
      if (status === ENTRY_STATUS.SLIP) {
        await updateStats(uid, { totalSlips: (profile?.stats?.totalSlips || 0) + 1 });
      }
      return { gained };
    },
    [uid, entryIndex, quitStats, floatXp, profile],
  );

  /** Record an urge. Resisting one earns points; giving in never costs any. */
  const recordUrge = useCallback(
    async (quitHabit, { trigger, intensity, resisted, note }) => {
      const dayKey = todayKey(timezone);
      await logUrge(uid, { quitHabitId: quitHabit.id, dayKey, trigger, intensity, resisted, note });
      if (resisted) {
        await awardXp(uid, XP.URGE_RESISTED);
        floatXp(XP.URGE_RESISTED, 'Urge resisted');
      }
      return { gained: resisted ? XP.URGE_RESISTED : 0 };
    },
    [uid, timezone, floatXp],
  );

  // Defined before the two callbacks that use it, so there's no
  // temporal-dead-zone hazard if either ever fires during the first render.
  const completeGoalFlow = useCallback(
    async (goal) => {
      await updateGoal(uid, goal.id, { status: 'completed', completedAt: new Date() });
      await awardXp(uid, XP.GOAL_COMPLETE);
      await updateStats(uid, { goalsCompleted: (profile?.stats?.goalsCompleted || 0) + 1 });
      push({ type: 'goal', goal });
    },
    [uid, profile, push],
  );

  /** Update a numeric goal's value, log it, and celebrate completion. */
  const updateGoalValue = useCallback(
    async (goal, value, note = '') => {
      const previous = Number(goal.currentValue || 0);
      await recordGoalProgress(uid, goal.id, {
        value: Number(value),
        previousValue: previous,
        note,
        dayKey: todayKey(timezone),
      });
      await awardXp(uid, XP.GOAL_PROGRESS);
      floatXp(XP.GOAL_PROGRESS, goal.title);

      const nextPercent = goalPercent({ ...goal, currentValue: Number(value) });
      if (nextPercent >= 100 && goal.status !== 'completed') {
        await completeGoalFlow({ ...goal, currentValue: Number(value) });
      }
    },
    [uid, timezone, floatXp, completeGoalFlow],
  );

  /** Tick or untick a milestone on a milestone-type goal. */
  const toggleMilestone = useCallback(
    async (goal, milestoneId) => {
      const milestones = (goal.milestones || []).map((m) =>
        m.id === milestoneId ? { ...m, done: !m.done, doneAt: !m.done ? new Date().toISOString() : null } : m,
      );
      const justDone = milestones.find((m) => m.id === milestoneId)?.done;
      await updateGoal(uid, goal.id, { milestones });
      if (justDone) {
        await awardXp(uid, XP.MILESTONE);
        floatXp(XP.MILESTONE, 'Milestone!');
      } else {
        await awardXp(uid, -XP.MILESTONE);
      }

      const nextGoal = { ...goal, milestones };
      if (goalPercent(nextGoal) >= 100 && goal.status !== 'completed') {
        await completeGoalFlow(nextGoal);
      }
    },
    [uid, floatXp, completeGoalFlow],
  );

  const claimReward = useCallback(
    async (reward) => {
      await claimRewardDoc(uid, reward.id);
      push({ type: 'claimed', reward });
    },
    [uid, push],
  );

  const seeUnlock = useCallback((key) => markUnlockSeen(uid, key).catch(() => {}), [uid]);

  const value = useMemo(
    () => ({
      celebrations,
      floaters,
      dismissCelebration,
      checkInHabit,
      logQuitDay,
      recordUrge,
      updateGoalValue,
      toggleMilestone,
      completeGoal: completeGoalFlow,
      claimReward,
      seeUnlock,
      badgeFor: (key) => BADGES_BY_KEY[key],
    }),
    [
      celebrations, floaters, dismissCelebration, checkInHabit, logQuitDay, recordUrge,
      updateGoalValue, toggleMilestone, completeGoalFlow, claimReward, seeUnlock,
    ],
  );

  return <RewardContext.Provider value={value}>{children}</RewardContext.Provider>;
}

/** Has a user-defined reward's trigger condition been met? */
function rewardConditionMet(reward, { habitStats, quitStats, goals, level }) {
  const t = reward.trigger || {};
  switch (t.kind) {
    case 'streak': {
      const stat = habitStats[t.habitId] || quitStats[t.habitId];
      return (stat?.current || 0) >= (t.threshold || 0);
    }
    case 'xp':
      return level.xp >= (t.threshold || 0);
    case 'level':
      return level.level >= (t.threshold || 0);
    case 'goal': {
      const goal = goals.find((g) => g.id === t.goalId);
      return goal ? goalPercent(goal) >= 100 : false;
    }
    default:
      return false; // 'manual' rewards are unlocked by hand
  }
}

/** One-off badges for checking in very early or very late. */
async function recordTimeOfDayFlags(uid, profile) {
  const hour = new Date().getHours();
  const patch = {};
  if (hour < 7 && !profile?.stats?.earlyCheckIn) patch.earlyCheckIn = true;
  if (hour >= 23 && !profile?.stats?.nightCheckIn) patch.nightCheckIn = true;
  if (Object.keys(patch).length) await updateStats(uid, patch).catch(() => {});
}

export const useRewards = () => {
  const ctx = useContext(RewardContext);
  if (!ctx) throw new Error('useRewards must be used inside RewardProvider');
  return ctx;
};
