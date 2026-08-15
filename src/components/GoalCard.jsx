import { useData } from '../context/DataContext';
import { GOAL_TYPE } from '../firebase/schema';
import { goalPace, goalPercent } from '../lib/progress';
import { cardGradient } from '../lib/themes';
import { formatKey } from '../lib/dates';
import { ProgressBar, RingProgress, Stat } from './ui';

export default function GoalCard({ goal, onOpen }) {
  const { settings, timezone } = useData();
  const percent = goalPercent(goal);
  const pace = goalPace(goal, timezone);
  const fields = settings?.cardFields || {};
  const complete = goal.status === 'completed' || percent >= 100;

  return (
    <div className="card p-4">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: cardGradient(goal.color) }} />

      <button
        onClick={() => onOpen?.(goal)}
        className="flex w-full items-start gap-3 text-left transition active:scale-[0.99]"
      >
        <RingProgress
          percent={percent}
          color={complete ? 'var(--success)' : 'var(--primary)'}
          size={60}
          stroke={6}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="text-lg">{goal.emoji}</span>
            <span className="truncate text-base font-extrabold">{goal.title}</span>
          </span>
          {goal.type === GOAL_TYPE.NUMERIC ? (
            <span className="block text-sm font-bold" style={{ color: 'var(--muted)' }}>
              {formatValue(goal.currentValue)} / {formatValue(goal.targetValue)} {goal.unit}
            </span>
          ) : (
            <span className="block text-sm font-bold" style={{ color: 'var(--muted)' }}>
              {(goal.milestones || []).filter((m) => m.done).length} / {(goal.milestones || []).length} milestones
            </span>
          )}
          {complete && (
            <span className="chip mt-1.5" style={{ background: 'var(--success)', color: '#04150d' }}>
              🎉 Complete
            </span>
          )}
        </span>
      </button>

      {/* Pace bar: the ghost marker shows where you "should" be today. */}
      {!complete && pace && (
        <div className="relative mt-4">
          <ProgressBar percent={percent} color={cardGradient(goal.color)} height={10} />
          <div
            className="absolute top-0 h-2.5 w-0.5 rounded"
            style={{ left: `${pace.expectedPercent}%`, background: 'var(--text)', opacity: 0.75 }}
            title={`On-pace target: ${pace.expectedPercent}%`}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {fields.percentComplete !== false && <Stat label="Complete" value={`${percent}%`} />}
        {fields.targetDate && goal.targetDate && (
          <Stat label="Target" value={formatKey(goal.targetDate, 'd MMM yy')} />
        )}
        {fields.startDate && goal.startDate && (
          <Stat label="Started" value={formatKey(goal.startDate, 'd MMM yy')} />
        )}
        {pace && !complete && (
          <Stat
            label={pace.overdue ? 'Overdue' : 'Days left'}
            value={pace.overdue ? `${Math.abs(pace.daysLeft)}d` : `${pace.daysLeft}d`}
            accent={pace.overdue ? 'var(--danger)' : undefined}
          />
        )}
        {pace && !complete && (
          <Stat
            label="Pace"
            value={pace.onTrack ? `+${pace.delta}%` : `${pace.delta}%`}
            accent={pace.onTrack ? 'var(--success)' : 'var(--warning)'}
          />
        )}
      </div>
    </div>
  );
}

const formatValue = (v) => {
  const n = Number(v || 0);
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
};
