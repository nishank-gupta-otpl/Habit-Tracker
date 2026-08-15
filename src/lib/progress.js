// Goal progress maths.
//
// Two goal shapes, one output contract: every goal reports a 0-100 percentage,
// so cards and progress bars never need to branch on type.

import { daysBetween, todayKey } from './dates';
import { GOAL_DIRECTION, GOAL_TYPE } from '../firebase/schema';

/**
 * Percent complete, clamped to 0-100.
 *
 * Numeric goals measure from `startValue`, not from zero — losing 5kg of a
 * 90 -> 75 goal is 33% done, not 83%. Decrease goals invert the ratio so
 * progress still counts up.
 */
export function goalPercent(goal) {
  if (!goal) return 0;

  if (goal.type === GOAL_TYPE.MILESTONE) {
    const milestones = goal.milestones || [];
    if (!milestones.length) return goal.status === 'completed' ? 100 : 0;
    const done = milestones.filter((m) => m.done).length;
    return Math.round((done / milestones.length) * 100);
  }

  const start = Number(goal.startValue ?? 0);
  const target = Number(goal.targetValue ?? 0);
  const current = Number(goal.currentValue ?? 0);
  const span = target - start;
  if (span === 0) return current >= target ? 100 : 0;

  const ratio = (current - start) / span; // works for both directions
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * Pace: are you ahead or behind where you should be today, given the target
 * date? Returns null for goals with no target date.
 */
export function goalPace(goal, timezone) {
  if (!goal?.targetDate || !goal?.startDate) return null;
  const today = todayKey(timezone);
  const totalDays = daysBetween(goal.targetDate, goal.startDate);
  if (totalDays <= 0) return null;

  const elapsed = Math.max(0, Math.min(totalDays, daysBetween(today, goal.startDate)));
  const expectedPercent = Math.round((elapsed / totalDays) * 100);
  const actualPercent = goalPercent(goal);
  const daysLeft = daysBetween(goal.targetDate, today);

  return {
    expectedPercent,
    actualPercent,
    delta: actualPercent - expectedPercent,
    daysLeft,
    totalDays,
    onTrack: actualPercent >= expectedPercent,
    overdue: daysLeft < 0 && actualPercent < 100,
  };
}

/** What the remaining daily rate needs to be to still land on time. */
export function requiredDailyRate(goal, timezone) {
  if (goal?.type !== GOAL_TYPE.NUMERIC || !goal.targetDate) return null;
  const daysLeft = daysBetween(goal.targetDate, todayKey(timezone));
  if (daysLeft <= 0) return null;
  const remaining = Number(goal.targetValue) - Number(goal.currentValue);
  if (goal.direction === GOAL_DIRECTION.DECREASE) {
    return Math.abs(remaining) / daysLeft;
  }
  return remaining <= 0 ? 0 : remaining / daysLeft;
}

export const isGoalComplete = (goal) => goalPercent(goal) >= 100;

/** Turn the progress log into chart-ready points, oldest first. */
export function progressSeries(progressDocs = []) {
  return [...progressDocs]
    .filter((p) => p.dayKey)
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
    .map((p) => ({ date: p.dayKey, value: Number(p.value) || 0 }));
}
