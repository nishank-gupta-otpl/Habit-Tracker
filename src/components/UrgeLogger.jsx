import { useState } from 'react';
import { Modal, SegmentedControl } from './ui';
import { useRewards } from '../context/RewardContext';

const INTENSITY_LABELS = ['Barely there', 'Mild', 'Noticeable', 'Strong', 'Overwhelming'];

/**
 * Logging an urge should take five seconds, so this is deliberately one screen:
 * pick a trigger, drag the intensity, say whether you got through it.
 */
export default function UrgeLogger({ open, onClose, quitHabit }) {
  const { recordUrge } = useRewards();
  const [trigger, setTrigger] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [resisted, setResisted] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!quitHabit) return null;

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await recordUrge(quitHabit, { trigger: trigger.trim(), intensity, resisted, note: note.trim() });
      setTrigger('');
      setIntensity(3);
      setResisted(true);
      setNote('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Urge — ${quitHabit.name}`}
      footer={
        <button className="btn btn-primary flex-1" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : resisted ? 'I got through it 💪' : 'Log the slip'}
        </button>
      }
    >
      <div className="space-y-5">
        {quitHabit.motivation && (
          <div className="card p-3" style={{ background: 'var(--surface-2)' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Remember why
            </p>
            <p className="mt-1 text-sm font-semibold">{quitHabit.motivation}</p>
          </div>
        )}

        <div>
          <span className="label">What set it off?</span>
          {quitHabit.commonTriggers?.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quitHabit.commonTriggers.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrigger(t)}
                  className="chip"
                  style={trigger === t ? { background: 'var(--primary)', color: '#0a0a16' } : undefined}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <input
            className="input"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="Something else…"
          />
        </div>

        <div>
          <label className="label" htmlFor="intensity">
            How strong? — {INTENSITY_LABELS[intensity - 1]}
          </label>
          <input
            id="intensity"
            type="range"
            min="1"
            max="5"
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="w-full accent-violet-500"
          />
        </div>

        <div>
          <span className="label">How did it go?</span>
          <SegmentedControl
            value={resisted ? 'resisted' : 'gave-in'}
            onChange={(v) => setResisted(v === 'resisted')}
            options={[
              { value: 'resisted', label: '💪 Resisted' },
              { value: 'gave-in', label: '😔 Gave in' },
            ]}
          />
          <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            {resisted
              ? 'Resisting an urge is worth 5 XP — the whole point is to notice you did it.'
              : 'No points lost. Logging it honestly is what makes the trigger data useful.'}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="urge-note">
            Note (optional)
          </label>
          <textarea
            id="urge-note"
            className="input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
