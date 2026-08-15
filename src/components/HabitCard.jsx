import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useRewards } from '../context/RewardContext';
import { ENTRY_STATUS, FREQUENCY } from '../firebase/schema';
import { cardGradient } from '../lib/themes';
import { formatKey, isScheduledOn, lastNDays, relativeDayLabel } from '../lib/dates';
import { ProgressBar, Stat } from './ui';

/**
 * A habit you're building. Field visibility is driven by settings.cardFields so
 * the same component serves both the dashboard and the full habits list.
 */
export default function HabitCard({ habit, onOpen, compact = false }) {
  const { habitStats, entryIndex, today, settings, timezone } = useData();
  const { checkInHabit } = useRewards();
  const [busy, setBusy] = useState(false);

  const stats = habitStats[habit.id] || { current: 0, longest: 0, total: 0, completionRate: 0 };
  const entries = entryIndex[habit.id] || {};
  const todayEntry = entries[today];
  const isDone = todayEntry?.status === ENTRY_STATUS.DONE;
  const isSkipped = todayEntry?.status === ENTRY_STATUS.SKIPPED;
  const scheduledToday = isScheduledOn(habit, today);
  const fields = settings?.cardFields || {};

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await checkInHabit(habit, today, { status: ENTRY_STATUS.DONE });
    } finally {
      setBusy(false);
    }
  };

  const week = lastNDays(7, timezone);

  return (
    <div className="card p-4">
      {/* Accent stripe keeps cards distinguishable at a glance. */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: cardGradient(habit.color) }} />

      <div className="flex items-start gap-3">
        {/* Opening the detail sheet and checking in are two separate targets,
            so the check-in button is never nested inside a clickable card. */}
        <button
          onClick={() => onOpen?.(habit)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left transition active:scale-[0.99]"
        >
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl"
            style={{ background: cardGradient(habit.color) }}
          >
            {habit.emoji}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-extrabold">{habit.name}</span>
            <span className="block text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              {cadenceLabel(habit)}
              {!scheduledToday && ' · not scheduled today'}
            </span>
          </span>
        </button>

        <button
          onClick={toggle}
          disabled={busy}
          aria-label={isDone ? `Undo check-in for ${habit.name}` : `Check in ${habit.name}`}
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl font-black transition active:scale-90 ${isDone ? '' : 'animate-pulse-ring'}`}
          style={
            isDone
              ? { background: 'var(--success)', color: '#04150d' }
              : { background: 'var(--surface-2)', border: '2px solid var(--border)' }
          }
        >
          {isDone ? '✓' : isSkipped ? '–' : ''}
        </button>
      </div>

      {/* Last 7 days at a glance — the single most useful thing on the card. */}
      <div className="mt-3 flex gap-1.5">
        {week.map((key) => {
          const status = entries[key]?.status;
          const scheduled = isScheduledOn(habit, key);
          return (
            <div
              key={key}
              title={`${formatKey(key, 'EEE d MMM')}: ${status || (scheduled ? 'missed' : 'rest day')}`}
              className="h-2 flex-1 rounded-full"
              style={{
                background:
                  status === ENTRY_STATUS.DONE
                    ? 'var(--success)'
                    : status === ENTRY_STATUS.SKIPPED
                      ? 'var(--warning)'
                      : scheduled
                        ? 'var(--surface-2)'
                        : 'transparent',
                border: scheduled ? 'none' : '1px dashed var(--border)',
              }}
            />
          );
        })}
      </div>

      {!compact && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {fields.currentStreak !== false && (
            <Stat
              label="Streak"
              value={`${stats.current}${habit.frequency === FREQUENCY.WEEKLY ? 'w' : 'd'} 🔥`}
              accent="var(--warning)"
            />
          )}
          {fields.percentComplete && (
            <Stat label="Consistency" value={`${Math.round((stats.completionRate || 0) * 100)}%`} />
          )}
          {fields.points && <Stat label="Check-ins" value={stats.total} />}
          {fields.startDate && habit.startDate && (
            <Stat label="Started" value={formatKey(habit.startDate, 'd MMM yy')} />
          )}
          {fields.lastCheckIn && (
            <Stat
              label="Last done"
              value={stats.lastCheckInDate ? relativeDayLabel(stats.lastCheckInDate, timezone) : '—'}
            />
          )}
        </div>
      )}

      {habit.frequency === FREQUENCY.WEEKLY && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs font-bold" style={{ color: 'var(--muted)' }}>
            <span>This week</span>
            <span>
              {stats.thisWeekCount || 0} / {habit.timesPerWeek}
            </span>
          </div>
          <ProgressBar
            percent={((stats.thisWeekCount || 0) / (habit.timesPerWeek || 1)) * 100}
            color={cardGradient(habit.color)}
            height={8}
          />
        </div>
      )}
    </div>
  );
}

function cadenceLabel(habit) {
  if (habit.frequency === FREQUENCY.DAILY) return 'Every day';
  if (habit.frequency === FREQUENCY.WEEKLY) return `${habit.timesPerWeek}× per week`;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = (habit.daysOfWeek || []).slice().sort();
  if (days.length === 7) return 'Every day';
  return days.map((d) => names[d]).join(', ') || 'No days set';
}
