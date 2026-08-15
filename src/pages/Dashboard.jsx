import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import HabitCard from '../components/HabitCard';
import QuitHabitCard from '../components/QuitHabitCard';
import GoalCard from '../components/GoalCard';
import { EmptyState } from '../components/ui';
import { ENTRY_STATUS } from '../firebase/schema';
import { formatKey, isScheduledOn } from '../lib/dates';

/**
 * The home screen. Which cards appear here is controlled from Settings:
 * an empty selection means "show everything", which is the right default
 * before the user has customised anything.
 */
export default function Dashboard({ onOpenHabit, onOpenQuit, onOpenGoal, onLogUrge, onNavigate }) {
  const { habits, quitHabits, goals, settings, today, entryIndex, profile } = useData();

  const selected = settings?.dashboardHabits || [];
  const selectedQuit = settings?.dashboardQuitHabits || [];
  const selectedGoals = settings?.dashboardGoals || [];

  const shownHabits = selected.length ? habits.filter((h) => selected.includes(h.id)) : habits;
  const shownQuit = selectedQuit.length ? quitHabits.filter((h) => selectedQuit.includes(h.id)) : quitHabits;
  const shownGoals = (selectedGoals.length ? goals.filter((g) => selectedGoals.includes(g.id)) : goals).filter(
    (g) => g.status !== 'completed',
  );

  // Today's completion ring across every habit that is actually scheduled today.
  const todayProgress = useMemo(() => {
    const due = habits.filter((h) => isScheduledOn(h, today));
    const done = due.filter((h) => entryIndex[h.id]?.[today]?.status === ENTRY_STATUS.DONE).length;
    const quitLogged = quitHabits.filter((h) => entryIndex[h.id]?.[today]).length;
    return {
      done,
      due: due.length,
      percent: due.length ? Math.round((done / due.length) * 100) : 0,
      quitLogged,
      quitTotal: quitHabits.length,
    };
  }, [habits, quitHabits, entryIndex, today]);

  const isEmpty = !habits.length && !quitHabits.length && !goals.length;

  if (isEmpty) {
    return (
      <div className="space-y-4">
        <EmptyState
          emoji="🚀"
          title="Let's get started"
          body="Add your first habit, something you want to quit, or a goal you're chasing. Everything else — streaks, XP, badges — builds itself from there."
          action={
            <button className="btn btn-primary mt-2" onClick={() => onNavigate('habits')}>
              Add my first habit
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily summary banner */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              {formatKey(today, 'EEEE d MMMM')}
            </p>
            <h2 className="mt-0.5 text-2xl font-black">
              {greeting()}, {(profile?.displayName || 'there').split(' ')[0]}
            </h2>
            <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
              {todayProgress.due === 0
                ? 'Nothing scheduled today — rest up.'
                : todayProgress.done === todayProgress.due
                  ? 'Everything done today. Perfect day! 🎉'
                  : `${todayProgress.done} of ${todayProgress.due} habits done`}
            </p>
          </div>
          <div className="relative grid h-20 w-20 shrink-0 place-items-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-2)" strokeWidth="12" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="var(--success)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={264}
                strokeDashoffset={264 - (todayProgress.percent / 100) * 264}
                style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.34, 1.3, 0.64, 1)' }}
              />
            </svg>
            <span className="text-lg font-black">{todayProgress.percent}%</span>
          </div>
        </div>
      </section>

      {shownHabits.length > 0 && (
        <Section title="Habits" count={shownHabits.length} onSeeAll={() => onNavigate('habits')}>
          {shownHabits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} onOpen={onOpenHabit} />
          ))}
        </Section>
      )}

      {shownQuit.length > 0 && (
        <Section title="Quitting" count={shownQuit.length} onSeeAll={() => onNavigate('habits')}>
          {shownQuit.map((habit) => (
            <QuitHabitCard key={habit.id} quitHabit={habit} onOpen={onOpenQuit} onLogUrge={onLogUrge} />
          ))}
        </Section>
      )}

      {shownGoals.length > 0 && (
        <Section title="Goals" count={shownGoals.length} onSeeAll={() => onNavigate('goals')}>
          {shownGoals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onOpen={onOpenGoal} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children, onSeeAll }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          {title} <span style={{ color: 'var(--primary-soft)' }}>{count}</span>
        </h3>
        <button className="text-xs font-bold" style={{ color: 'var(--primary-soft)' }} onClick={onSeeAll}>
          See all
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}
