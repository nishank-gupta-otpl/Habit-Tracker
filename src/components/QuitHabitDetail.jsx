import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useRewards } from '../context/RewardContext';
import { ENTRY_STATUS } from '../firebase/schema';
import { formatKey } from '../lib/dates';
import StreakCalendar from './StreakCalendar';
import { Modal, ProgressBar } from './ui';

export default function QuitHabitDetail({ quitHabit, open, onClose, onEdit, onLogUrge }) {
  const { quitStats, entryIndex, urges } = useData();
  const { logQuitDay } = useRewards();

  const habitUrges = useMemo(
    () => urges.filter((u) => u.quitHabitId === quitHabit?.id),
    [urges, quitHabit],
  );

  // "What sets me off" — the payoff for logging urges separately.
  const triggerBreakdown = useMemo(() => {
    const counts = {};
    for (const urge of habitUrges) {
      const key = urge.trigger?.trim() || 'Unlabelled';
      counts[key] ||= { total: 0, resisted: 0 };
      counts[key].total += 1;
      if (urge.resisted) counts[key].resisted += 1;
    }
    return Object.entries(counts)
      .map(([trigger, c]) => ({ trigger, ...c, rate: c.total ? c.resisted / c.total : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [habitUrges]);

  if (!quitHabit) return null;

  const stats = quitStats[quitHabit.id] || {};
  const entries = entryIndex[quitHabit.id] || {};
  const saved = quitHabit.costPerSlip ? (stats.current || 0) * Number(quitHabit.costPerSlip) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`${quitHabit.emoji} ${quitHabit.name}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onEdit(quitHabit)}>
            Edit
          </button>
          <button className="btn btn-primary flex-1" onClick={() => onLogUrge(quitHabit)}>
            ⚡ Log an urge
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="card p-5 text-center">
          <div className="text-6xl font-black" style={{ color: 'var(--success)' }}>
            {stats.current || 0}
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
            days since your last slip
          </p>
          {stats.longest > 0 && (
            <p className="mt-2 text-xs font-bold" style={{ color: 'var(--muted)' }}>
              Personal best: {stats.longest} days
            </p>
          )}
          {saved !== null && (
            <p className="mt-2 text-sm font-extrabold" style={{ color: 'var(--accent)' }}>
              {quitHabit.unit || ''}
              {saved.toLocaleString()} saved so far
            </p>
          )}
        </div>

        {quitHabit.motivation && (
          <div className="card p-3" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Why you're quitting
            </p>
            <p className="mt-1 text-sm font-semibold">{quitHabit.motivation}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Box label="Clean days" value={stats.totalCleanDays || 0} />
          <Box label="Slips" value={stats.totalSlips || 0} />
          <Box label="Urges beaten" value={habitUrges.filter((u) => u.resisted).length} />
        </div>

        {triggerBreakdown.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              What sets you off
            </h4>
            <div className="space-y-2.5">
              {triggerBreakdown.slice(0, 6).map((row) => (
                <div key={row.trigger}>
                  <div className="mb-1 flex justify-between text-xs font-bold">
                    <span>{row.trigger}</span>
                    <span style={{ color: 'var(--muted)' }}>
                      {row.resisted}/{row.total} resisted
                    </span>
                  </div>
                  <ProgressBar
                    percent={row.rate * 100}
                    color={row.rate >= 0.7 ? 'var(--success)' : row.rate >= 0.4 ? 'var(--warning)' : 'var(--danger)'}
                    height={7}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-3 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            History
          </h4>
          <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
            Tap a past day to mark it clean, tap again to clear it.
          </p>
          <StreakCalendar
            quit
            habit={quitHabit}
            entries={entries}
            onToggleDay={(dayKey) => logQuitDay(quitHabit, dayKey, ENTRY_STATUS.CLEAN)}
          />
        </div>

        {quitHabit.quitDate && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Clean since {formatKey(quitHabit.quitDate, 'd MMMM yyyy')}
          </p>
        )}
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
