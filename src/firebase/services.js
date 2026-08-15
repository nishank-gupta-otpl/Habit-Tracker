// Every Firestore write in the app goes through this module. Keeping the SDK
// calls in one place means the UI never has to think about paths, and the
// schema factories are guaranteed to be used.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import {
  COLLECTIONS,
  entryId,
  newEntry,
  newGoal,
  newGoalProgress,
  newHabit,
  newQuitHabit,
  newReward,
  newUnlock,
  newUrge,
} from './schema';

const userRef = (uid) => doc(db, 'users', uid);
const col = (uid, name) => collection(db, 'users', uid, name);

// --- Habits (build) ---------------------------------------------------------

export const createHabit = (uid, data) => addDoc(col(uid, COLLECTIONS.HABITS), newHabit(data));

export const updateHabit = (uid, habitId, patch) =>
  updateDoc(doc(db, 'users', uid, COLLECTIONS.HABITS, habitId), { ...patch, updatedAt: serverTimestamp() });

export const archiveHabit = (uid, habitId) => updateHabit(uid, habitId, { archived: true });

/** Hard delete, including every entry that referenced the habit. */
export async function deleteHabit(uid, habitId, habitType = 'build') {
  const collectionName = habitType === 'quit' ? COLLECTIONS.QUIT_HABITS : COLLECTIONS.HABITS;
  const entries = await getDocs(query(col(uid, COLLECTIONS.ENTRIES), where('habitId', '==', habitId)));
  const batch = writeBatch(db);
  entries.forEach((d) => batch.delete(d.ref));
  if (habitType === 'quit') {
    const urges = await getDocs(query(col(uid, COLLECTIONS.URGES), where('quitHabitId', '==', habitId)));
    urges.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, 'users', uid, collectionName, habitId));
  await batch.commit();
}

// --- Habits (quit) ----------------------------------------------------------

export const createQuitHabit = (uid, data) => addDoc(col(uid, COLLECTIONS.QUIT_HABITS), newQuitHabit(data));

export const updateQuitHabit = (uid, habitId, patch) =>
  updateDoc(doc(db, 'users', uid, COLLECTIONS.QUIT_HABITS, habitId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });

// --- Entries ----------------------------------------------------------------

/**
 * Write a check-in. The composite doc ID makes this idempotent: checking in
 * twice on the same day updates the record instead of creating a duplicate.
 */
export function setEntry(uid, { habitId, habitType, dayKey, status, value, note, xpAwarded }) {
  const id = entryId(habitId, dayKey);
  return setDoc(
    doc(db, 'users', uid, COLLECTIONS.ENTRIES, id),
    { ...newEntry({ habitId, habitType, dayKey, status, value, note, xpAwarded }), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export const deleteEntry = (uid, habitId, dayKey) =>
  deleteDoc(doc(db, 'users', uid, COLLECTIONS.ENTRIES, entryId(habitId, dayKey)));

// --- Urges ------------------------------------------------------------------

export const logUrge = (uid, data) => addDoc(col(uid, COLLECTIONS.URGES), newUrge(data));

export const deleteUrge = (uid, urgeId) => deleteDoc(doc(db, 'users', uid, COLLECTIONS.URGES, urgeId));

// --- Goals ------------------------------------------------------------------

export const createGoal = (uid, data) => addDoc(col(uid, COLLECTIONS.GOALS), newGoal(data));

export const updateGoal = (uid, goalId, patch) =>
  updateDoc(doc(db, 'users', uid, COLLECTIONS.GOALS, goalId), { ...patch, updatedAt: serverTimestamp() });

export const deleteGoal = (uid, goalId) => deleteDoc(doc(db, 'users', uid, COLLECTIONS.GOALS, goalId));

/** Update a goal's current value and append to its progress log in one batch. */
export async function recordGoalProgress(uid, goalId, { value, previousValue, note, dayKey }) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid, COLLECTIONS.GOALS, goalId), {
    currentValue: value,
    updatedAt: serverTimestamp(),
  });
  batch.set(
    doc(collection(db, 'users', uid, COLLECTIONS.GOALS, goalId, COLLECTIONS.GOAL_PROGRESS)),
    newGoalProgress({ value, delta: value - (previousValue ?? 0), note, dayKey }),
  );
  await batch.commit();
}

export const completeGoal = (uid, goalId) =>
  updateGoal(uid, goalId, { status: 'completed', completedAt: serverTimestamp() });

// --- Rewards & unlocks ------------------------------------------------------

export const createReward = (uid, data) => addDoc(col(uid, COLLECTIONS.REWARDS), newReward(data));

export const updateReward = (uid, rewardId, patch) =>
  updateDoc(doc(db, 'users', uid, COLLECTIONS.REWARDS, rewardId), patch);

export const deleteReward = (uid, rewardId) =>
  deleteDoc(doc(db, 'users', uid, COLLECTIONS.REWARDS, rewardId));

export const claimReward = (uid, rewardId) =>
  updateReward(uid, rewardId, { claimed: true, claimedAt: serverTimestamp() });

/**
 * Record an unlock. The badge/theme key doubles as the doc ID, so awarding the
 * same badge twice is a harmless no-op rather than a duplicate.
 */
export const grantUnlock = (uid, { key, type, label, emoji, meta }) =>
  setDoc(doc(db, 'users', uid, COLLECTIONS.UNLOCKS, key), newUnlock({ key, type, label, emoji, meta }), {
    merge: true,
  });

export const markUnlockSeen = (uid, key) =>
  updateDoc(doc(db, 'users', uid, COLLECTIONS.UNLOCKS, key), { seen: true });

// --- User doc ---------------------------------------------------------------

export const updateSettings = (uid, patch) => {
  const flattened = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`settings.${k}`, v]));
  return updateDoc(userRef(uid), flattened);
};

export const updateStats = (uid, patch) => {
  const flattened = Object.fromEntries(Object.entries(patch).map(([k, v]) => [`stats.${k}`, v]));
  return updateDoc(userRef(uid), flattened);
};

/** XP is incremented atomically so rapid check-ins can't lose points. */
export const awardXp = (uid, amount) =>
  updateDoc(userRef(uid), { 'stats.xp': increment(amount), 'stats.totalCheckIns': increment(amount > 0 ? 1 : 0) });

export const setUserLevel = (uid, level) => updateDoc(userRef(uid), { 'stats.level': level });

/** Write back a recomputed streak cache when it has drifted from the entries. */
export const syncHabitCache = (uid, habitId, cache, habitType = 'build') =>
  updateDoc(doc(db, 'users', uid, habitType === 'quit' ? COLLECTIONS.QUIT_HABITS : COLLECTIONS.HABITS, habitId), {
    cache,
  });
