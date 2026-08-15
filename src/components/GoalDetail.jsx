import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../firebase/config';
import { COLLECTIONS, GOAL_TYPE } from '../firebase/schema';
import { useData } from '../context/DataContext';
import { useRewards } from '../context/RewardContext';
import { goalPace, goalPercent, progressSeries, requiredDailyRate } from '../lib/progress';
import { formatKey } from '../lib/dates';
import { Modal, ProgressBar, RingProgress, Stat } from './ui';

export default function GoalDetail({ goal, open, onClose, onEdit }) {
  const { uid, timezone, settings } = useData();
  const { updateGoalValue, toggleMilestone, completeGoal } = useRewards();
  const [progress, setProgress] = useState([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // The progress log is only needed when a goal is actually open, so it gets
  // its own listener rather than sitting in the global DataContext.
  useEffect(() => {
    if (!open || !goal?.id || !uid) return undefined;
    setDraft(String(goal.currentValue ?? ''));
    return onSnapshot(
      query(collection(db, 'users', uid, COLLECTIONS.GOALS, goal.id, COLLECTIONS.GOAL_PROGRESS)),
      (snap) => setProgress(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
  }, [open, goal?.id, uid, goal?.currentValue]);

  if (!goal) return null;

  const percent = goalPercent(goal);
  const pace = goalPace(goal, timezone);
  const rate = requiredDailyRate(goal, timezone);
  const series = progressSeries(progress);
  const complete = goal.status === 'completed';

  const save = async () => {
    if (draft === '' || saving) return;
    setSaving(true);
    try {
      await updateGoalValue(goal, Number(draft));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`${goal.emoji} ${goal.title}`}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => onEdit(goal)}>
            Edit
          </button>
          {!complete && percent >= 100 && (
            <button className="btn btn-primary flex-1" onClick={() => completeGoal(goal)}>
              🎉 Mark complete
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <RingProgress percent={percent} size={92} stroke={10} color={complete ? 'var(--success)' : 'var(--primary)'} />
          <div className="min-w-0 flex-1 space-y-1">
            {goal.type === GOAL_TYPE.NUMERIC && (
              <p className="text-2xl font-black">
                {Number(goal.currentValue).toLocaleString()}{' '}
                <span className="text-base font-bold" style={{ color: 'var(--muted)' }}>
                  / {Number(goal.targetValue).toLocaleString()} {goal.unit}
                </span>
              </p>
            )}
            {pace && !complete && (
              <p className="text-sm font-bold" style={{ color: pace.onTrack ? 'var(--success)' : 'var(--warning)' }}>
                {pace.overdue
                  ? `${Math.abs(pace.daysLeft)} days overdue`
                  : pace.onTrack
                    ? `${pace.delta}% ahead of pace · ${pace.daysLeft} days left`
                    : `${Math.abs(pace.delta)}% behind pace · ${pace.daysLeft} days left`}
              </p>
            )}
            {rate > 0 && !complete && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Need ~{rate.toFixed(rate < 10 ? 2 : 0)} {goal.unit}/day to finish on time
              </p>
            )}
          </div>
        </div>

        {goal.type === GOAL_TYPE.NUMERIC ? (
          <div>
            <label className="label" htmlFor="progress-value">
              Update progress
            </label>
            <div className="flex gap-2">
              <input
                id="progress-value"
                className="input"
                type="number"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Current ${goal.unit || 'value'}`}
              />
              <button className="btn btn-primary" onClick={save} disabled={saving || draft === ''}>
                {saving ? '…' : 'Log'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h4 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Milestones
            </h4>
            <div className="space-y-2">
              {(goal.milestones || []).map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleMilestone(goal, m.id)}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition active:scale-[0.98]"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-black"
                    style={
                      m.done
                        ? { background: 'var(--success)', color: '#04150d' }
                        : { border: '2px solid var(--border)' }
                    }
                  >
                    {m.done ? '✓' : ''}
                  </span>
                  <span
                    className="min-w-0 flex-1 text-sm font-semibold"
                    style={{
                      textDecoration: m.done ? 'line-through' : 'none',
                      opacity: m.done ? 0.6 : 1,
                    }}
                  >
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {settings?.features?.trends !== false && series.length > 1 && (
          <div>
            <h4 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Progress over time
            </h4>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--muted)', fontSize: 10 }}
                    tickFormatter={(d) => formatKey(d, 'd MMM')}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      color: 'var(--text)',
                    }}
                    labelFormatter={(d) => formatKey(d, 'd MMM yyyy')}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#goalFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {goal.startDate && <Stat label="Started" value={formatKey(goal.startDate, 'd MMM yyyy')} />}
          {goal.targetDate && <Stat label="Target" value={formatKey(goal.targetDate, 'd MMM yyyy')} />}
          <Stat label="Updates logged" value={progress.length} />
        </div>

        {pace && !complete && (
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold" style={{ color: 'var(--muted)' }}>
              <span>You: {percent}%</span>
              <span>On-pace: {pace.expectedPercent}%</span>
            </div>
            <ProgressBar percent={percent} height={10} />
          </div>
        )}
      </div>
    </Modal>
  );
}
