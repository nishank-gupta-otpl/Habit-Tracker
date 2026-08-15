import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../context/DataContext';
import { ENTRY_STATUS } from '../firebase/schema';
import { formatKey, isScheduledOn, lastNDays } from '../lib/dates';
import { goalPercent } from '../lib/progress';
import { SegmentedControl } from '../components/ui';

/**
 * Weekly/monthly review — one of the optional extras from the brief. Turned on
 * by default but hideable from Settings, since not everyone wants it.
 */
export default function ReviewPage() {
  const { habits, quitHabits, goals, entryIndex, urges, timezone, level } = useData();
  const [range, setRange] = useState(7);

  const days = useMemo(() => lastNDays(range, timezone), [range, timezone]);

  // A habit only counts as "due" on days at or after it was created — otherwise
  // adding a habit today would retroactively show a week of missed days.
  const isDue = (habit, key) => isScheduledOn(habit, key) && key >= (habit.startDate || key);

  const chartData = useMemo(
    () =>
      days.map((key) => {
        const due = habits.filter((h) => isDue(h, key));
        const done = due.filter((h) => entryIndex[h.id]?.[key]?.status === ENTRY_STATUS.DONE).length;
        const slips = quitHabits.filter((h) => entryIndex[h.id]?.[key]?.status === ENTRY_STATUS.SLIP).length;
        return {
          date: key,
          done,
          due: due.length,
          slips,
          percent: due.length ? Math.round((done / due.length) * 100) : 0,
        };
      }),
    [days, habits, quitHabits, entryIndex],
  );

  const summary = useMemo(() => {
    const totalDone = chartData.reduce((sum, d) => sum + d.done, 0);
    const totalDue = chartData.reduce((sum, d) => sum + d.due, 0);
    const perfectDays = chartData.filter((d) => d.due > 0 && d.done === d.due).length;
    const slips = chartData.reduce((sum, d) => sum + d.slips, 0);
    const rangeUrges = urges.filter((u) => days.includes(u.dayKey));
    return {
      totalDone,
      totalDue,
      rate: totalDue ? Math.round((totalDone / totalDue) * 100) : 0,
      perfectDays,
      slips,
      urgesResisted: rangeUrges.filter((u) => u.resisted).length,
      urgesTotal: rangeUrges.length,
    };
  }, [chartData, urges, days]);

  // Per-habit consistency over the window — shows what's working and what isn't.
  const habitBreakdown = useMemo(
    () =>
      habits
        .map((habit) => {
          const due = days.filter((k) => isDue(habit, k));
          const done = due.filter((k) => entryIndex[habit.id]?.[k]?.status === ENTRY_STATUS.DONE).length;
          return { habit, done, due: due.length, rate: due.length ? done / due.length : 0 };
        })
        .sort((a, b) => b.rate - a.rate),
    [habits, days, entryIndex],
  );

  return (
    <div className="space-y-5">
      <SegmentedControl
        value={range}
        onChange={setRange}
        options={[
          { value: 7, label: 'Last 7 days' },
          { value: 30, label: 'Last 30 days' },
          { value: 90, label: 'Last 90 days' },
        ]}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Completion" value={`${summary.rate}%`} accent="var(--primary-soft)" />
        <Tile label="Check-ins" value={summary.totalDone} />
        <Tile label="Perfect days" value={summary.perfectDays} accent="var(--success)" />
        <Tile label="Slips" value={summary.slips} accent={summary.slips ? 'var(--danger)' : undefined} />
      </div>

      <section className="card p-4">
        <h3 className="mb-3 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Daily completion
        </h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                tickFormatter={(d) => formatKey(d, range > 30 ? 'd MMM' : 'EEE')}
                interval={range > 30 ? Math.floor(range / 8) : range > 7 ? 3 : 0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--text)',
                }}
                labelFormatter={(d) => formatKey(d, 'EEEE d MMM')}
                formatter={(value, name, entry) => [
                  `${value}% (${entry.payload.done}/${entry.payload.due})`,
                  'Completion',
                ]}
              />
              <Bar dataKey="percent" radius={[5, 5, 0, 0]}>
                {chartData.map((d) => (
                  <Cell
                    key={d.date}
                    fill={
                      d.due === 0
                        ? 'var(--surface-2)'
                        : d.percent === 100
                          ? 'var(--success)'
                          : d.percent >= 50
                            ? 'var(--primary)'
                            : 'var(--warning)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {habitBreakdown.length > 0 && (
        <section className="card p-4">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Habit by habit
          </h3>
          <div className="space-y-3">
            {habitBreakdown.map(({ habit, done, due, rate }) => (
              <div key={habit.id}>
                <div className="mb-1 flex items-center justify-between text-xs font-bold">
                  <span className="truncate">
                    {habit.emoji} {habit.name}
                  </span>
                  <span style={{ color: 'var(--muted)' }}>
                    {done}/{due}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.round(rate * 100)}%`,
                      background: rate >= 0.8 ? 'var(--success)' : rate >= 0.5 ? 'var(--primary)' : 'var(--warning)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {summary.urgesTotal > 0 && (
        <section className="card p-4">
          <h3 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            Urges
          </h3>
          <p className="text-sm">
            You logged <strong>{summary.urgesTotal}</strong> urge{summary.urgesTotal === 1 ? '' : 's'} and got
            through <strong style={{ color: 'var(--success)' }}>{summary.urgesResisted}</strong> of them —{' '}
            {Math.round((summary.urgesResisted / summary.urgesTotal) * 100)}% resisted.
          </p>
        </section>
      )}

      <section className="card p-4">
        <h3 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          Goals
        </h3>
        {goals.filter((g) => g.status !== 'completed').length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No active goals.
          </p>
        ) : (
          <div className="space-y-2">
            {goals
              .filter((g) => g.status !== 'completed')
              .map((goal) => (
                <div key={goal.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold">
                    {goal.emoji} {goal.title}
                  </span>
                  <span className="shrink-0 font-black" style={{ color: 'var(--primary-soft)' }}>
                    {goalPercent(goal)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      <p className="pb-2 text-center text-xs" style={{ color: 'var(--muted)' }}>
        Level {level.level} · {level.xp.toLocaleString()} XP earned all-time
      </p>
    </div>
  );
}

const Tile = ({ label, value, accent }) => (
  <div className="card p-3 text-center">
    <div className="text-2xl font-black" style={{ color: accent }}>
      {value}
    </div>
    <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
      {label}
    </div>
  </div>
);
