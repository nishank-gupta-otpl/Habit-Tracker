import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { RewardProvider, useRewards } from './context/RewardContext';
import AppHeader from './components/AppHeader';
import BottomNav from './components/BottomNav';
import CelebrationLayer from './components/CelebrationLayer';
import HabitForm from './components/HabitForm';
import QuitHabitForm from './components/QuitHabitForm';
import GoalForm from './components/GoalForm';
import RewardForm from './components/RewardForm';
import HabitDetail from './components/HabitDetail';
import QuitHabitDetail from './components/QuitHabitDetail';
import UrgeLogger from './components/UrgeLogger';
import Dashboard from './pages/Dashboard';
import HabitsPage from './pages/HabitsPage';
import GoalsPage from './pages/GoalsPage';
import RewardsPage from './pages/RewardsPage';
import SettingsPage from './pages/SettingsPage';
import SignIn from './pages/SignIn';
import { XpFloaters } from './components/ui';
import { isFirebaseConfigured } from './firebase/config';
import {
  createGoal,
  createHabit,
  createQuitHabit,
  createReward,
  deleteGoal,
  deleteHabit,
  updateGoal,
  updateHabit,
  updateQuitHabit,
} from './firebase/services';
import { applyTheme } from './lib/themes';
import { collectReminders, missedReminders, permission, scheduleAll } from './lib/reminders';

// Recharts is ~400KB and only appears on the Review tab and inside a goal's
// detail sheet, so both are split out of the initial bundle. On a phone that's
// the difference between a fast first paint and a slow one.
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const GoalDetail = lazy(() => import('./components/GoalDetail'));

export default function App() {
  if (!isFirebaseConfigured) return <SetupNeeded />;
  return (
    <AuthProvider>
      <DataProvider>
        <RewardProvider>
          <Shell />
        </RewardProvider>
      </DataProvider>
    </AuthProvider>
  );
}

function Shell() {
  const { user, loading: authLoading } = useAuth();
  const { loading, settings, uid, habits, quitHabits, goals, entryIndex, today } = useData();
  const { floaters } = useRewards();

  const [tab, setTab] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [habitForm, setHabitForm] = useState(null); // null | { initial }
  const [quitForm, setQuitForm] = useState(null);
  const [goalForm, setGoalForm] = useState(null);
  const [rewardForm, setRewardForm] = useState(false);
  const [detail, setDetail] = useState(null); // { type, item }
  const [urgeTarget, setUrgeTarget] = useState(null);
  const [missed, setMissed] = useState([]);

  // Keep the theme in sync with the user's choice, and remember it locally so
  // the next launch paints the right colours before Firestore responds.
  useEffect(() => {
    if (!settings?.theme) return;
    applyTheme(settings.theme);
    try {
      localStorage.setItem('momentum.theme', settings.theme);
    } catch {
      // Private mode — the theme still applies, we just lose the pre-paint.
    }
  }, [settings?.theme]);

  // Re-arm scheduled notifications whenever reminders change or the app opens.
  // Chrome only holds a finite queue of triggers, so topping it up on every
  // launch is what keeps reminders alive over weeks.
  useEffect(() => {
    if (!uid || permission() !== 'granted') return;
    const reminders = collectReminders({ habits, quitHabits, goals });
    scheduleAll(reminders).catch(() => {});
    setMissed(missedReminders(reminders, { entryIndex, today }));
  }, [uid, habits, quitHabits, goals, entryIndex, today]);

  // Tapping a reminder deep-links to the right thing.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = (event) => {
      if (event.data?.type !== 'notification-click') return;
      const { kind, refId } = event.data.data || {};
      if (kind === 'goal') {
        const goal = goals.find((g) => g.id === refId);
        if (goal) setDetail({ type: 'goal', item: goal });
        setTab('goals');
      } else {
        setTab('home');
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [goals]);

  const openDetail = useCallback((type) => (item) => setDetail({ type, item }), []);

  if (authLoading) return <Splash />;
  if (!user) return <SignIn />;
  if (loading) return <Splash />;

  return (
    <div className="min-h-full">
      <AppHeader onOpenSettings={() => setSettingsOpen(true)} />

      <main className="relative z-10 mx-auto max-w-2xl px-4 pb-28 pt-5">
        {missed.length > 0 && tab === 'home' && (
          <div
            className="mb-4 flex items-start gap-3 rounded-2xl p-3.5"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--warning)' }}
          >
            <span className="text-xl">⏰</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">Still to log today</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {missed.map((m) => m.title).join(', ')}
              </p>
            </div>
            <button className="text-lg" onClick={() => setMissed([])} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {tab === 'home' && (
          <Dashboard
            onOpenHabit={openDetail('habit')}
            onOpenQuit={openDetail('quit')}
            onOpenGoal={openDetail('goal')}
            onLogUrge={setUrgeTarget}
            onNavigate={setTab}
          />
        )}
        {tab === 'habits' && (
          <HabitsPage
            onOpenHabit={openDetail('habit')}
            onOpenQuit={openDetail('quit')}
            onNew={() => setHabitForm({ initial: null })}
            onNewQuit={() => setQuitForm({ initial: null })}
            onLogUrge={setUrgeTarget}
          />
        )}
        {tab === 'goals' && (
          <GoalsPage onOpenGoal={openDetail('goal')} onNew={() => setGoalForm({ initial: null })} />
        )}
        {tab === 'rewards' && <RewardsPage onNewReward={() => setRewardForm(true)} />}
        {tab === 'review' && (
          <Suspense fallback={<ChartsLoading />}>
            <ReviewPage />
          </Suspense>
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
      <XpFloaters floaters={floaters} />
      <CelebrationLayer />

      {/* --- Detail sheets --- */}
      <HabitDetail
        habit={detail?.type === 'habit' ? detail.item : null}
        open={detail?.type === 'habit'}
        onClose={() => setDetail(null)}
        onEdit={(habit) => {
          setDetail(null);
          setHabitForm({ initial: habit });
        }}
      />
      <QuitHabitDetail
        quitHabit={detail?.type === 'quit' ? detail.item : null}
        open={detail?.type === 'quit'}
        onClose={() => setDetail(null)}
        onEdit={(habit) => {
          setDetail(null);
          setQuitForm({ initial: habit });
        }}
        onLogUrge={(habit) => {
          setDetail(null);
          setUrgeTarget(habit);
        }}
      />
      {detail?.type === 'goal' && (
        <Suspense fallback={null}>
          <GoalDetail
            goal={goals.find((g) => g.id === detail.item.id) || detail.item}
            open
            onClose={() => setDetail(null)}
            onEdit={(goal) => {
              setDetail(null);
              setGoalForm({ initial: goal });
            }}
          />
        </Suspense>
      )}

      {/* --- Forms --- */}
      {habitForm && (
        <HabitForm
          open
          initial={habitForm.initial}
          timezone={settings?.timezone}
          onClose={() => setHabitForm(null)}
          onSave={(data) =>
            habitForm.initial ? updateHabit(uid, habitForm.initial.id, data) : createHabit(uid, data)
          }
          onDelete={async (habit) => {
            await deleteHabit(uid, habit.id, 'build');
            setHabitForm(null);
          }}
        />
      )}
      {quitForm && (
        <QuitHabitForm
          open
          initial={quitForm.initial}
          timezone={settings?.timezone}
          onClose={() => setQuitForm(null)}
          onSave={(data) =>
            quitForm.initial ? updateQuitHabit(uid, quitForm.initial.id, data) : createQuitHabit(uid, data)
          }
          onDelete={async (habit) => {
            await deleteHabit(uid, habit.id, 'quit');
            setQuitForm(null);
          }}
        />
      )}
      {goalForm && (
        <GoalForm
          open
          initial={goalForm.initial}
          timezone={settings?.timezone}
          habits={habits}
          onClose={() => setGoalForm(null)}
          onSave={(data) =>
            goalForm.initial ? updateGoal(uid, goalForm.initial.id, data) : createGoal(uid, data)
          }
          onDelete={async (goal) => {
            await deleteGoal(uid, goal.id);
            setGoalForm(null);
          }}
        />
      )}
      <RewardForm
        open={rewardForm}
        onClose={() => setRewardForm(false)}
        onSave={(data) => createReward(uid, data)}
      />
      <UrgeLogger open={Boolean(urgeTarget)} quitHabit={urgeTarget} onClose={() => setUrgeTarget(null)} />
      <SettingsPage open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

const ChartsLoading = () => (
  <div className="grid place-items-center py-20">
    <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
      Loading charts…
    </p>
  </div>
);

function Splash() {
  return (
    <div className="grid min-h-full place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-pulse-ring grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-500 to-cyan-400 text-4xl">
          ⚡
        </div>
        <p className="font-bold" style={{ color: 'var(--muted)' }}>
          Loading your momentum…
        </p>
      </div>
    </div>
  );
}

/** Shown when .env.local hasn't been filled in — much clearer than a crash. */
function SetupNeeded() {
  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="card max-w-md p-6">
        <h1 className="text-2xl font-black">⚙️ Setup needed</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          Firebase isn’t configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and fill in
          your Firebase web app config, then restart the dev server.
        </p>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Full step-by-step instructions are in the README.
        </p>
      </div>
    </div>
  );
}
