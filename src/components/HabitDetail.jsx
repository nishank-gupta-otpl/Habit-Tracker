import { useData } from '../context/DataContext';
import { useRewards } from '../context/RewardContext';
import { ENTRY_STATUS } from '../firebase/schema';
import { formatKey } from '../lib/dates';
import StreakCalendar from './StreakCalendar';
import { Modal, Stat } from './ui';

export default function HabitDetail({ habit, open, onClose, onEdit }) {
  const { habitStats, entryIndex } = useData();
  const { checkInHabit } = useRewards();

  if (!habit) return null;

  const stats = habitStats[habit.id] || {};
  const entries = entryIndex[habit.id] || {};

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`${habit.emoji} ${habit.name}`}
      footer={
        <button className="btn btn-ghost flex-1" onClick={() => onEdit(habit)}>
          Edit habit
        </button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box label="Current streak" value={`${stats.current || 0} 🔥`} />
          <Box label="Best streak" value={stats.longest || 0} />
          <Box label="Total check-ins" value={stats.total || 0} />
          <Box label="Consistency" value={`${Math.round((stats.completionRate || 0) * 100)}%`} />
        </div>

        {habit.notes && (
          <div className="card p-3" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Why this matters
            </p>
            <p className="mt-1 text-sm font-semibold">{habit.notes}</p>
          </div>
        )}

        <div>
          <h4 className="mb-3 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            History
          </h4>
          <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
            Tap any past day to fill in a check-in you forgot to log.
          </p>
          <StreakCalendar
            habit={habit}
            entries={entries}
            onToggleDay={(dayKey) => checkInHabit(habit, dayKey, { status: ENTRY_STATUS.DONE })}
          />
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {habit.startDate && <Stat label="Started" value={formatKey(habit.startDate, 'd MMM yyyy')} />}
          {stats.lastCheckInDate && (
            <Stat label="Last done" value={formatKey(stats.lastCheckInDate, 'd MMM yyyy')} />
          )}
          {habit.reminder?.enabled && <Stat label="Reminder" value={habit.reminder.time} />}
        </div>
      </div>
    </Modal>
  );
}

const Box = ({ label, value }) => (
  <div className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-2)' }}>
    <div className="text-2xl font-black">{value}</div>
    <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
      {label}
    </div>
  </div>
);
