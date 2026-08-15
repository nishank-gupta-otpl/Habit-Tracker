import { useState } from 'react';
import { CARD_COLORS } from '../lib/themes';
import { todayKey } from '../lib/dates';
import { ColorPicker, EmojiPicker, Modal } from './ui';
import ReminderFields from './ReminderFields';

export default function QuitHabitForm({ open, onClose, onSave, onDelete, initial, timezone }) {
  const [form, setForm] = useState(() => blank(initial, timezone));
  const [triggerDraft, setTriggerDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const addTrigger = () => {
    const value = triggerDraft.trim();
    if (!value || form.commonTriggers.includes(value)) return;
    set({ commonTriggers: [...form.commonTriggers, value] });
    setTriggerDraft('');
  };

  const submit = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        costPerSlip: form.costPerSlip === '' ? null : Number(form.costPerSlip),
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
      title={initial ? 'Edit habit to quit' : 'Quit a habit'}
      footer={
        <>
          {initial && (
            <button className="btn btn-danger" onClick={() => onDelete?.(initial)}>
              Delete
            </button>
          )}
          <button className="btn btn-primary flex-1" onClick={submit} disabled={!form.name.trim() || saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : "I'm quitting this"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="quit-name">
            What are you quitting?
          </label>
          <input
            id="quit-name"
            className="input"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Smoking"
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
          <label className="label" htmlFor="quit-date">
            Clean since
          </label>
          <input
            id="quit-date"
            className="input"
            type="date"
            value={form.quitDate}
            onChange={(e) => set({ quitDate: e.target.value })}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            Your "days clean" counter starts here. Backdate it if you already stopped a while ago.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="motivation">
            Why are you quitting?
          </label>
          <textarea
            id="motivation"
            className="input"
            rows={2}
            value={form.motivation}
            onChange={(e) => set({ motivation: e.target.value })}
            placeholder="Shown back to you when you log an urge"
          />
        </div>

        <div>
          <span className="label">Common triggers</span>
          <div className="flex gap-2">
            <input
              className="input"
              value={triggerDraft}
              onChange={(e) => setTriggerDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTrigger())}
              placeholder="Stress, after meals, pub…"
            />
            <button type="button" className="btn btn-ghost" onClick={addTrigger}>
              Add
            </button>
          </div>
          {form.commonTriggers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.commonTriggers.map((trigger) => (
                <button
                  key={trigger}
                  type="button"
                  className="chip"
                  onClick={() => set({ commonTriggers: form.commonTriggers.filter((t) => t !== trigger) })}
                >
                  {trigger} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="cost">
              Cost per slip
            </label>
            <input
              id="cost"
              className="input"
              type="number"
              inputMode="decimal"
              value={form.costPerSlip}
              onChange={(e) => set({ costPerSlip: e.target.value })}
              placeholder="12"
            />
          </div>
          <div>
            <label className="label" htmlFor="cost-unit">
              Unit
            </label>
            <input
              id="cost-unit"
              className="input"
              value={form.unit}
              onChange={(e) => set({ unit: e.target.value })}
              placeholder="£"
            />
          </div>
        </div>
        <p className="-mt-3 text-xs" style={{ color: 'var(--muted)' }}>
          Optional — powers a running "saved so far" figure on the card.
        </p>

        <ReminderFields value={form.reminder} onChange={(reminder) => set({ reminder })} />
      </div>
    </Modal>
  );
}

function blank(initial, timezone) {
  const today = todayKey(timezone);
  return {
    name: initial?.name || '',
    emoji: initial?.emoji || '🚭',
    color: initial?.color || 'rose',
    startDate: initial?.startDate || today,
    quitDate: initial?.quitDate || today,
    motivation: initial?.motivation || '',
    commonTriggers: initial?.commonTriggers || [],
    costPerSlip: initial?.costPerSlip ?? '',
    unit: initial?.unit || '',
    notes: initial?.notes || '',
    reminder: initial?.reminder || null,
  };
}
