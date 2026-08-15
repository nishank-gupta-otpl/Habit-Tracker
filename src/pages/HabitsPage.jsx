import { useState } from 'react';
import { useData } from '../context/DataContext';
import HabitCard from '../components/HabitCard';
import QuitHabitCard from '../components/QuitHabitCard';
import { EmptyState, SegmentedControl } from '../components/ui';

export default function HabitsPage({ onOpenHabit, onOpenQuit, onNew, onNewQuit, onLogUrge }) {
  const { habits, quitHabits, allHabits, allQuitHabits } = useData();
  const [tab, setTab] = useState('build');

  const archivedCount = allHabits.length - habits.length + (allQuitHabits.length - quitHabits.length);

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'build', label: `🔥 Building (${habits.length})` },
          { value: 'quit', label: `🚭 Quitting (${quitHabits.length})` },
        ]}
      />

      {tab === 'build' ? (
        <>
          {habits.length === 0 ? (
            <EmptyState
              emoji="🌱"
              title="No habits yet"
              body="Start with one small thing you can do most days. One habit done consistently beats five you abandon."
              action={
                <button className="btn btn-primary mt-2" onClick={onNew}>
                  Add a habit
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {habits.map((habit) => (
                <HabitCard key={habit.id} habit={habit} onOpen={onOpenHabit} />
              ))}
              <button className="btn btn-ghost w-full" onClick={onNew}>
                + Add another habit
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {quitHabits.length === 0 ? (
            <EmptyState
              emoji="🛡️"
              title="Nothing to quit — yet"
              body="Track something you're trying to stop. You'll get a days-clean counter, urge logging, and honest slip tracking that never punishes you with lost points."
              action={
                <button className="btn btn-primary mt-2" onClick={onNewQuit}>
                  Quit a habit
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {quitHabits.map((habit) => (
                <QuitHabitCard
                  key={habit.id}
                  quitHabit={habit}
                  onOpen={onOpenQuit}
                  onLogUrge={onLogUrge}
                />
              ))}
              <button className="btn btn-ghost w-full" onClick={onNewQuit}>
                + Quit something else
              </button>
            </div>
          )}
        </>
      )}

      {archivedCount > 0 && (
        <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
          {archivedCount} archived — restore from Settings
        </p>
      )}
    </div>
  );
}
