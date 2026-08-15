import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { COLLECTIONS } from '../firebase/schema';
import { useAuth } from './AuthContext';
import { computeBuildStreak, computeCleanStreak, entriesForHabit } from '../lib/streaks';
import { goalPercent } from '../lib/progress';
import { levelProgress } from '../lib/xp';
import { shiftKey, todayKey } from '../lib/dates';

const DataContext = createContext(null);

// How much history to keep live in memory. 400 days covers a full year of
// streaks plus the calendar's look-back, and at one user's volume that is a
// few thousand small docs — well inside Firestore's free daily read quota,
// and cached offline after the first load.
const HISTORY_DAYS = 400;

export function DataProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [profile, setProfile] = useState(null);
  const [habits, setHabits] = useState([]);
  const [quitHabits, setQuitHabits] = useState([]);
  const [entries, setEntries] = useState([]);
  const [urges, setUrges] = useState([]);
  const [goals, setGoals] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [unlocks, setUnlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setHabits([]);
      setQuitHabits([]);
      setEntries([]);
      setUrges([]);
      setGoals([]);
      setRewards([]);
      setUnlocks([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const withId = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const since = shiftKey(todayKey(), -HISTORY_DAYS);

    const unsubs = [
      onSnapshot(doc(db, 'users', uid), (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      }),
      onSnapshot(collection(db, 'users', uid, COLLECTIONS.HABITS), (s) => setHabits(withId(s))),
      onSnapshot(collection(db, 'users', uid, COLLECTIONS.QUIT_HABITS), (s) => setQuitHabits(withId(s))),
      onSnapshot(
        query(collection(db, 'users', uid, COLLECTIONS.ENTRIES), where('dayKey', '>=', since)),
        (s) => setEntries(withId(s)),
      ),
      onSnapshot(
        query(collection(db, 'users', uid, COLLECTIONS.URGES), where('dayKey', '>=', since)),
        (s) => setUrges(withId(s)),
      ),
      onSnapshot(collection(db, 'users', uid, COLLECTIONS.GOALS), (s) => setGoals(withId(s))),
      onSnapshot(collection(db, 'users', uid, COLLECTIONS.REWARDS), (s) => setRewards(withId(s))),
      onSnapshot(
        query(collection(db, 'users', uid, COLLECTIONS.UNLOCKS), orderBy('unlockedAt', 'desc')),
        (s) => setUnlocks(withId(s)),
      ),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [uid]);

  const settings = profile?.settings;
  const timezone = settings?.timezone;

  // --- Derived state ---------------------------------------------------------
  // Computed once per data change and shared by every consumer, so no component
  // ever recomputes a streak on its own.

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const activeQuitHabits = useMemo(() => quitHabits.filter((h) => !h.archived), [quitHabits]);

  const entryIndex = useMemo(() => {
    const byHabit = {};
    for (const entry of entries) {
      (byHabit[entry.habitId] ||= {})[entry.dayKey] = entry;
    }
    return byHabit;
  }, [entries]);

  const habitStats = useMemo(() => {
    const out = {};
    for (const habit of activeHabits) {
      out[habit.id] = computeBuildStreak(habit, entryIndex[habit.id] || {}, timezone);
    }
    return out;
  }, [activeHabits, entryIndex, timezone]);

  const quitStats = useMemo(() => {
    const out = {};
    for (const habit of activeQuitHabits) {
      out[habit.id] = computeCleanStreak(habit, entryIndex[habit.id] || {}, timezone);
    }
    return out;
  }, [activeQuitHabits, entryIndex, timezone]);

  const goalStats = useMemo(() => {
    const out = {};
    for (const goal of goals) out[goal.id] = goalPercent(goal);
    return out;
  }, [goals]);

  const level = useMemo(() => levelProgress(profile?.stats?.xp || 0), [profile?.stats?.xp]);

  const unlockedKeys = useMemo(() => new Set(unlocks.map((u) => u.key)), [unlocks]);

  const today = todayKey(timezone);

  /** Fast lookup for "have I checked this in today?" */
  const todayEntries = useMemo(() => {
    const map = {};
    for (const entry of entries) if (entry.dayKey === today) map[entry.habitId] = entry;
    return map;
  }, [entries, today]);

  const value = useMemo(
    () => ({
      uid,
      loading,
      profile,
      settings,
      timezone,
      today,
      habits: activeHabits,
      allHabits: habits,
      quitHabits: activeQuitHabits,
      allQuitHabits: quitHabits,
      entries,
      entryIndex,
      todayEntries,
      urges,
      goals,
      rewards,
      unlocks,
      unlockedKeys,
      habitStats,
      quitStats,
      goalStats,
      level,
      entriesFor: (habitId) => entriesForHabit(entries, habitId),
    }),
    [
      uid, loading, profile, settings, timezone, today, activeHabits, habits, activeQuitHabits,
      quitHabits, entries, entryIndex, todayEntries, urges, goals, rewards, unlocks, unlockedKeys,
      habitStats, quitStats, goalStats, level,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
};
