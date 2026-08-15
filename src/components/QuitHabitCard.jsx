import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useRewards } from '../context/RewardContext';
import { ENTRY_STATUS } from '../firebase/schema';
import { cardGradient } from '../lib/themes';
import { formatKey, lastNDays, relativeDayLabel } from '../lib/dates';
import { Stat } from './ui';

/**
 * A habit you're quitting. The headline number is days-since-last-slip, and
 * the two buttons deliberately give equal visual weight to logging a slip —
 * a tracker you're afraid to be honest with is useless.
 */
export default function QuitHabitCard({ quitHabit, onOpen, onLogUrge }) {
  const { quitStats, entryIndex, today, settings, timezone, urges } = useData();
  const { logQuitDay } = useRewards();
  const [busy, setBusy] = useState(false);

  const stats = quitStats[quitHabit.id] || { current: 0, longest: 0, totalSlips: 0 };
  const entries = entryIndex[quitHabit.id] || {};
  const todayEntry = entries[today];
  const fields = settings?.cardFields || {};
  const todayUrges = urges.filter((u) => u.quitHabitId === quitHabit.id && u.dayKey === today);

  const log = async (status) => {
    if (busy) return;
    setBusy(true);
    try {
      await logQuitDay(quitHabit, today, status);
    } finally {
      setBusy(false);
    }
  };

  const saved = quitHabit.costPerSlip ? stats.current * Number(quitHabit.costPerSlip) : null;
  const week = lastNDays(7, timezone);

  return (
    <div className="card p-4">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: cardGradient(quitHabit.color) }} />

      <button
        onClick={() => onOpen?.(quitHabit)}
        className="flex w-full items-start gap-3 text-left transition active:scale-[0.99]"
      >
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
          style={{ background: cardGradient(quitHabit.color) }}
        >
          {quitHabit.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-extrabold">{quitHabit.name}</span>
          <span className="block text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            {stats.lastSlipDate
              ? `Last slip ${relativeDayLabel(stats.lastSlipDate, timezone).toLowerCase()}`
              : 'No slips recorded'}
          </span>
        </span>
      </button>

      {/* The number that matters. */}
      <div className="mt-4 flex items-end gap-2">
        <span className="text-5xl font-black leading-none" style={{ color: 'var(--success)' }}>
          {stats.current}
        </span>
        <span className="pb-1 text-sm font-bold" style={{ color: 'var(--muted)' }}>
          day{stats.current === 1 ? '' : 's'} clean
        </span>
      </div>

      <div className="mt-3 flex gap-1.5">
        {week.map((key) => {
          const status = entries[key]?.status;
          return (
            <div
              key={key}
              title={`${formatKey(key, 'EEE d MMM')}: ${status || 'not logged'}`}
              className="h-2 flex-1 rounded-full"
              style={{
                background:
                  status === ENTRY_STATUS.CLEAN
                    ? 'var(--success)'
                    : status === ENTRY_STATUS.SLIP
                      ? 'var(--danger)'
                      : 'var(--surface-2)',
              }}
            />
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {fields.currentStreak !== false && <Stat label="Best run" value={`${stats.longest}d`} />}
        {fields.points && <Stat label="Slips" value={stats.totalSlips} accent="var(--danger)" />}
        {saved !== null && (
          <Stat label="Saved" value={`${quitHabit.unit || ''}${saved.toLocaleString()}`} accent="var(--success)" />
        )}
        {fields.startDate && quitHabit.quitDate && (
          <Stat label="Quit on" value={formatKey(quitHabit.quitDate, 'd MMM yy')} />
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          onClick={() => log(ENTRY_STATUS.CLEAN)}
          disabled={busy}
          className="btn !px-2 text-sm"
          style={
            todayEntry?.status === ENTRY_STATUS.CLEAN
              ? { background: 'var(--success)', color: '#04150d' }
              : { background: 'var(--surface-2)', border: '1px solid var(--border)' }
          }
        >
          ✓ Clean
        </button>
        <button
          onClick={() => log(ENTRY_STATUS.SLIP)}
          disabled={busy}
          className="btn !px-2 text-sm"
          style={
            todayEntry?.status === ENTRY_STATUS.SLIP
              ? { background: 'var(--danger)', color: '#1a0510' }
              : { background: 'var(--surface-2)', border: '1px solid var(--border)' }
          }
        >
          ✗ Slipped
        </button>
        <button onClick={() => onLogUrge?.(quitHabit)} className="btn btn-ghost !px-2 text-sm">
          ⚡ Urge{todayUrges.length ? ` (${todayUrges.length})` : ''}
        </button>
      </div>
    </div>
  );
}
