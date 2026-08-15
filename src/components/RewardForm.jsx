import { useState } from 'react';
import { useData } from '../context/DataContext';
import { EmojiPicker, Modal, SegmentedControl } from './ui';

/** User-defined rewards: "treat myself to X when I hit Y". */
export default function RewardForm({ open, onClose, onSave }) {
  const { habits, quitHabits, goals } = useData();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim(),
        emoji: form.emoji,
        description: form.description.trim(),
        trigger: buildTrigger(form),
      });
      setForm(blank());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const allHabits = [...habits, ...quitHabits];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a reward"
      footer={
        <button className="btn btn-primary flex-1" onClick={submit} disabled={!form.title.trim() || saving}>
          {saving ? 'Saving…' : 'Create reward'}
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="reward-title">
            What's the treat?
          </label>
          <input
            id="reward-title"
            className="input"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="New running shoes"
            autoFocus
          />
        </div>

        <div>
          <span className="label">Icon</span>
          <EmojiPicker value={form.emoji} onChange={(emoji) => set({ emoji })} />
        </div>

        <div>
          <span className="label">When do you earn it?</span>
          <SegmentedControl
            value={form.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'streak', label: 'Streak' },
              { value: 'level', label: 'Level' },
              { value: 'goal', label: 'Goal' },
              { value: 'manual', label: 'Manual' },
            ]}
          />
        </div>

        {form.kind === 'streak' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="reward-habit">
                Habit
              </label>
              <select
                id="reward-habit"
                className="input"
                value={form.habitId}
                onChange={(e) => set({ habitId: e.target.value })}
              >
                <option value="">Choose…</option>
                {allHabits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.emoji} {h.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="reward-days">
                Days
              </label>
              <input
                id="reward-days"
                className="input"
                type="number"
                inputMode="numeric"
                value={form.threshold}
                onChange={(e) => set({ threshold: e.target.value })}
              />
            </div>
          </div>
        )}

        {form.kind === 'level' && (
          <div>
            <label className="label" htmlFor="reward-level">
              Level
            </label>
            <input
              id="reward-level"
              className="input"
              type="number"
              inputMode="numeric"
              value={form.threshold}
              onChange={(e) => set({ threshold: e.target.value })}
            />
          </div>
        )}

        {form.kind === 'goal' && (
          <div>
            <label className="label" htmlFor="reward-goal">
              Goal
            </label>
            <select
              id="reward-goal"
              className="input"
              value={form.goalId}
              onChange={(e) => set({ goalId: e.target.value })}
            >
              <option value="">Choose…</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.kind === 'manual' && (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            No automatic trigger — you decide when you've earned this one.
          </p>
        )}

        <div>
          <label className="label" htmlFor="reward-desc">
            Notes (optional)
          </label>
          <textarea
            id="reward-desc"
            className="input"
            rows={2}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}

function blank() {
  return { title: '', emoji: '🎁', description: '', kind: 'streak', habitId: '', goalId: '', threshold: 30 };
}

function buildTrigger(form) {
  switch (form.kind) {
    case 'streak':
      return { kind: 'streak', habitId: form.habitId, threshold: Number(form.threshold) || 0 };
    case 'level':
      return { kind: 'level', threshold: Number(form.threshold) || 0 };
    case 'goal':
      return { kind: 'goal', goalId: form.goalId };
    default:
      return { kind: 'manual' };
  }
}
