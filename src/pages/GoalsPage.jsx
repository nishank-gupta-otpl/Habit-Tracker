import { useState } from 'react';
import { useData } from '../context/DataContext';
import GoalCard from '../components/GoalCard';
import { EmptyState, SegmentedControl } from '../components/ui';

export default function GoalsPage({ onOpenGoal, onNew }) {
  const { goals } = useData();
  const [tab, setTab] = useState('active');

  const active = goals.filter((g) => g.status !== 'completed');
  const completed = goals.filter((g) => g.status === 'completed');
  const shown = tab === 'active' ? active : completed;

  if (!goals.length) {
    return (
      <EmptyState
        emoji="🎯"
        title="No goals yet"
        body="A goal is anything with a finish line — a number to hit or a list of milestones to tick off. You'll get a % complete and a pace marker showing whether you're on track."
        action={
          <button className="btn btn-primary mt-2" onClick={onNew}>
            Set a goal
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: `Active (${active.length})` },
          { value: 'completed', label: `Done (${completed.length})` },
        ]}
      />

      <div className="space-y-3">
        {shown.map((goal) => (
          <GoalCard key={goal.id} goal={goal} onOpen={onOpenGoal} />
        ))}
        {tab === 'active' && (
          <button className="btn btn-ghost w-full" onClick={onNew}>
            + Add a goal
          </button>
        )}
        {tab === 'completed' && !completed.length && (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Nothing finished yet. It's coming.
          </p>
        )}
      </div>
    </div>
  );
}
