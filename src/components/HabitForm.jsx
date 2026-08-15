import { useState } from 'react';
import { FREQUENCY } from '../firebase/schema';
import { CARD_COLORS } from '../lib/themes';
import { todayKey } from '../lib/dates';
import { ColorPicker, EmojiPicker, Modal, SegmentedControl, Toggle } from './ui';
import ReminderFields from './ReminderFields';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HabitForm({ open, onClose, onSave, onDelete, initial, timezone }) {
  const [form, setForm] = useState(() => blank(initial, timezone));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Remount on a different habit resets the form without an effect.
  const key = initial?.id || 'new';

  const submit = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        targetValue: form.measurable ? Number(form.targetValue) || null : null,
        unit: form.measurable ? form.unit.trim() || null : null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      key={key}
      open={open}
      onClose={onClose}
      title={initial ? 'Edit habit' : 'New habit'}
      footer={
        <>
          {initial && (
            <button className="btn btn-danger" onClick={() => onDelete?.(initial)}>
              Delete
            </button>
          )}
          <button className="btn btn-primary flex-1" onClick={submit} disabled={!form.name.trim() || saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create habit'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="habit-name">
            What do you want to do?
          </label>
          <input
            id="habit-name"
            className="input"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Read for 20 minutes"
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
          <span className="label">How often?</span>
          <SegmentedControl
            value={form.frequency}
            onChange={(frequency) => set({ frequency })}
            options={[
              { value: FREQUENCY.DAILY, label: 'Every day' },
              { value: FREQUENCY.CUSTOM, label: 'Certain days' },
              { value: FREQUENCY.WEEKLY, label: 'X per week' },
            ]}
          />
        </div>

        {form.frequency === FREQUENCY.CUSTOM && (
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, index) => {
              const active = form.daysOfWeek.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    set({
                      daysOfWeek: active
                        ? form.daysOfWeek.filter((d) => d !== index)
                        : [...form.daysOfWeek, index],
                    })
                  }
                  className="rounded-xl px-3 py-2 text-sm font-bold transition active:scale-90"
                  style={
                    active
                      ? { background: 'var(--primary)', color: '#0a0a16' }
                      : { background: 'var(--surface-2)', color: 'var(--muted)' }
                  }
                >
                  {name}
                </button>
              );
            })}
          </div>
        )}

        {form.frequency === FREQUENCY.WEEKLY && (
          <div>
            <label className="label" htmlFor="times-per-week">
              Times per week: {form.timesPerWeek}
            </label>
            <input
              id="times-per-week"
              type="range"
              min="1"
              max="7"
              value={form.timesPerWeek}
              onChange={(e) => set({ timesPerWeek: Number(e.target.value) })}
              className="w-full accent-violet-500"
            />
          </div>
        )}

        <div className="card p-3">
          <Toggle
            checked={form.measurable}
            onChange={(measurable) => set({ measurable })}
            label="Track a number"
            description="e.g. 20 push-ups, 30 minutes — instead of a simple yes/no"
          />
          {form.measurable && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="target-value">
                  Daily target
                </label>
                <input
                  id="target-value"
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={form.targetValue}
                  onChange={(e) => set({ targetValue: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="target-unit">
                  Unit
                </label>
                <input
                  id="target-unit"
                  className="input"
                  value={form.unit}
                  onChange={(e) => set({ unit: e.target.value })}
                  placeholder="reps"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="start-date">
            Start date
          </label>
          <input
            id="start-date"
            className="input"
            type="date"
            value={form.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
          />
        </div>

        <ReminderFields value={form.reminder} onChange={(reminder) => set({ reminder })} />

        <div>
          <label className="label" htmlFor="habit-notes">
            Notes (optional)
          </label>
          <textarea
            id="habit-notes"
            className="input"
            rows={2}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Why does this matter to you?"
          />
        </div>
      </div>
    </Modal>
  );
}

function blank(initial, timezone) {
  return {
    name: initial?.name || '',
    emoji: initial?.emoji || '✅',
    color: initial?.color || 'violet',
    frequency: initial?.frequency || FREQUENCY.DAILY,
    daysOfWeek: initial?.daysOfWeek || [1, 2, 3, 4, 5],
    timesPerWeek: initial?.timesPerWeek || 3,
    startDate: initial?.startDate || todayKey(timezone),
    measurable: Boolean(initial?.targetValue),
    targetValue: initial?.targetValue ?? '',
    unit: initial?.unit || '',
    notes: initial?.notes || '',
    reminder: initial?.reminder || null,
  };
}
