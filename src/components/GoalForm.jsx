import { useState } from 'react';
import { GOAL_DIRECTION, GOAL_TYPE } from '../firebase/schema';
import { CARD_COLORS } from '../lib/themes';
import { shiftKey, todayKey } from '../lib/dates';
import { ColorPicker, EmojiPicker, Modal, SegmentedControl } from './ui';
import ReminderFields from './ReminderFields';

export default function GoalForm({ open, onClose, onSave, onDelete, initial, timezone, habits = [] }) {
  const [form, setForm] = useState(() => blank(initial, timezone));
  const [milestoneDraft, setMilestoneDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addMilestone = () => {
    const label = milestoneDraft.trim();
    if (!label) return;
    set({
      milestones: [
        ...form.milestones,
        { id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label, done: false, doneAt: null },
      ],
    });
    setMilestoneDraft('');
  };

  const submit = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        startValue: Number(form.startValue) || 0,
        currentValue: Number(form.currentValue) || 0,
        targetValue: Number(form.targetValue) || 0,
        direction:
          Number(form.targetValue) < Number(form.startValue) ? GOAL_DIRECTION.DECREASE : GOAL_DIRECTION.INCREASE,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      key={initial?.id || 'new'}
      open={open}
      onClose={onClose}
      title={initial ? 'Edit goal' : 'New goal'}
      footer={
        <>
          {initial && (
            <button className="btn btn-danger" onClick={() => onDelete?.(initial)}>
              Delete
            </button>
          )}
          <button className="btn btn-primary flex-1" onClick={submit} disabled={!form.title.trim() || saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create goal'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="goal-title">
            What are you aiming for?
          </label>
          <input
            id="goal-title"
            className="input"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Run a half marathon"
            autoFocus
          />
        </div>

        <div>
          <span className="label">Icon</span>
          <EmojiPicker value={form.emoji} onChange={(emoji) => set({ emoji })} />
        </div>

        <div>
          <span className="label">Colour</span>
          <ColorPicker value={form.color} onChange={(color) => set({ color })} colors={CARD_COLORS} />
        </div>

        <div>
          <span className="label">How do you measure it?</span>
          <SegmentedControl
            value={form.type}
            onChange={(type) => set({ type })}
            options={[
              { value: GOAL_TYPE.NUMERIC, label: 'A number' },
              { value: GOAL_TYPE.MILESTONE, label: 'Milestones' },
            ]}
          />
        </div>

        {form.type === GOAL_TYPE.NUMERIC ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="start-value">
                  Starting at
                </label>
                <input
                  id="start-value"
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={form.startValue}
                  onChange={(e) => set({ startValue: e.target.value, currentValue: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="current-value">
                  Now
                </label>
                <input
                  id="current-value"
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={form.currentValue}
                  onChange={(e) => set({ currentValue: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="goal-target-value">
                  Target
                </label>
                <input
                  id="goal-target-value"
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={form.targetValue}
                  onChange={(e) => set({ targetValue: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="goal-unit">
                Unit
              </label>
              <input
                id="goal-unit"
                className="input"
                value={form.unit}
                onChange={(e) => set({ unit: e.target.value })}
                placeholder="km, kg, £, pages…"
              />
            </div>
            <p className="-mt-3 text-xs" style={{ color: 'var(--muted)' }}>
              Progress is measured from your starting value, so a target lower than the start (90kg → 75kg)
              works exactly the same way.
            </p>
          </>
        ) : (
          <div>
            <span className="label">Milestones</span>
            <div className="flex gap-2">
              <input
                className="input"
                value={milestoneDraft}
                onChange={(e) => setMilestoneDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMilestone())}
                placeholder="Run 5k without stopping"
              />
              <button type="button" className="btn btn-ghost" onClick={addMilestone}>
                Add
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {form.milestones.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.label}</span>
                  <button
                    type="button"
                    onClick={() => set({ milestones: form.milestones.filter((x) => x.id !== m.id) })}
                    className="text-sm"
                    style={{ color: 'var(--danger)' }}
                    aria-label={`Remove ${m.label}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="goal-start">
              Start date
            </label>
            <input
              id="goal-start"
              className="input"
              type="date"
              value={form.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="goal-target-date">
              Target date
            </label>
            <input
              id="goal-target-date"
              className="input"
              type="date"
              value={form.targetDate}
              onChange={(e) => set({ targetDate: e.target.value })}
            />
          </div>
        </div>

        {habits.length > 0 && (
          <div>
            <span className="label">Habits that feed this goal (optional)</span>
            <div className="flex flex-wrap gap-1.5">
              {habits.map((habit) => {
                const active = form.linkedHabitIds.includes(habit.id);
                return (
                  <button
                    key={habit.id}
                    type="button"
                    onClick={() =>
                      set({
                        linkedHabitIds: active
                          ? form.linkedHabitIds.filter((id) => id !== habit.id)
                          : [...form.linkedHabitIds, habit.id],
                      })
                    }
                    className="chip"
                    style={active ? { background: 'var(--primary)', color: '#0a0a16' } : undefined}
                  >
                    {habit.emoji} {habit.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ReminderFields value={form.reminder} onChange={(reminder) => set({ reminder })} />
      </div>
    </Modal>
  );
}

function blank(initial, timezone) {
  const today = todayKey(timezone);
  return {
    title: initial?.title || '',
    emoji: initial?.emoji || '🎯',
    color: initial?.color || 'amber',
    type: initial?.type || GOAL_TYPE.NUMERIC,
    startDate: initial?.startDate || today,
    targetDate: initial?.targetDate || shiftKey(today, 90),
    startValue: initial?.startValue ?? 0,
    currentValue: initial?.currentValue ?? 0,
    targetValue: initial?.targetValue ?? 100,
    unit: initial?.unit || '',
    milestones: initial?.milestones || [],
    linkedHabitIds: initial?.linkedHabitIds || [],
    notes: initial?.notes || '',
    reminder: initial?.reminder || null,
  };
}
