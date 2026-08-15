import { Toggle } from './ui';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Shared reminder editor used by habit, quit-habit and goal forms. */
export default function ReminderFields({ value, onChange }) {
  const reminder = value || { enabled: false, time: '08:00', days: [0, 1, 2, 3, 4, 5, 6] };

  const set = (patch) => onChange({ ...reminder, ...patch });

  return (
    <div className="card p-3">
      <Toggle
        checked={reminder.enabled}
        onChange={(enabled) => set({ enabled })}
        label="Remind me"
        description="A notification at the time you choose"
      />

      {reminder.enabled && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="label" htmlFor="reminder-time">
              Time
            </label>
            <input
              id="reminder-time"
              className="input"
              type="time"
              value={reminder.time}
              onChange={(e) => set({ time: e.target.value })}
            />
          </div>
          <div>
            <span className="label">Days</span>
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES.map((name, index) => {
                const active = (reminder.days || []).includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() =>
                      set({
                        days: active
                          ? (reminder.days || []).filter((d) => d !== index)
                          : [...(reminder.days || []), index],
                      })
                    }
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold transition active:scale-90"
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
          </div>
        </div>
      )}
    </div>
  );
}
