import { useMemo, useState } from 'react';
import { ENTRY_STATUS } from '../firebase/schema';
import { formatKey, isFutureKey, isScheduledOn, monthGrid, shiftKey, todayKey } from '../lib/dates';
import { useData } from '../context/DataContext';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Month calendar of a single habit's history. Tapping a past day toggles it,
 * which is how you backfill a check-in you forgot to log.
 */
export default function StreakCalendar({ habit, entries, onToggleDay, quit = false }) {
  const { timezone, settings } = useData();
  const today = todayKey(timezone);
  const [anchor, setAnchor] = useState(today);

  const cells = useMemo(() => monthGrid(anchor, settings?.weekStartsOn ?? 1), [anchor, settings]);
  const monthLabel = formatKey(anchor, 'MMMM yyyy');

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          className="btn btn-ghost !px-3 !py-1.5"
          onClick={() => setAnchor(shiftKey(startOfMonthKey(anchor), -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="font-extrabold">{monthLabel}</span>
        <button
          className="btn btn-ghost !px-3 !py-1.5"
          onClick={() => setAnchor(shiftKey(endOfMonthKey(anchor), 1))}
          aria-label="Next month"
          disabled={isFutureKey(startOfMonthKey(shiftKey(endOfMonthKey(anchor), 1)), timezone)}
        >
          ›
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-center text-[11px] font-bold" style={{ color: 'var(--muted)' }}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          const entry = entries[cell.key];
          const future = isFutureKey(cell.key, timezone);
          const scheduled = quit || isScheduledOn(habit, cell.key);
          const isToday = cell.key === today;

          return (
            <button
              key={cell.key}
              disabled={future}
              onClick={() => onToggleDay?.(cell.key)}
              title={`${formatKey(cell.key, 'EEE d MMM')}${entry ? `: ${entry.status}` : ''}`}
              className="relative grid aspect-square place-items-center rounded-lg text-xs font-bold transition active:scale-90 disabled:opacity-25"
              style={{
                background: cellBackground(entry, scheduled),
                color: entry ? '#04150d' : 'var(--muted)',
                opacity: cell.inMonth ? 1 : 0.3,
                outline: isToday ? '2px solid var(--primary)' : 'none',
                outlineOffset: -2,
              }}
            >
              {cell.dayNumber}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-bold" style={{ color: 'var(--muted)' }}>
        <Legend color="var(--success)" label={quit ? 'Clean' : 'Done'} />
        {quit ? (
          <Legend color="var(--danger)" label="Slip" />
        ) : (
          <Legend color="var(--warning)" label="Rest day" />
        )}
        <Legend color="var(--surface-2)" label="Missed" />
      </div>
    </div>
  );
}

function cellBackground(entry, scheduled) {
  if (!entry) return scheduled ? 'var(--surface-2)' : 'transparent';
  switch (entry.status) {
    case ENTRY_STATUS.DONE:
    case ENTRY_STATUS.CLEAN:
      return 'var(--success)';
    case ENTRY_STATUS.SLIP:
      return 'var(--danger)';
    case ENTRY_STATUS.SKIPPED:
      return 'var(--warning)';
    default:
      return 'var(--surface-2)';
  }
}

const Legend = ({ color, label }) => (
  <span className="flex items-center gap-1.5">
    <span className="h-3 w-3 rounded" style={{ background: color }} />
    {label}
  </span>
);

const startOfMonthKey = (key) => `${key.slice(0, 8)}01`;
const endOfMonthKey = (key) => {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${key.slice(0, 8)}${String(last).padStart(2, '0')}`;
};
