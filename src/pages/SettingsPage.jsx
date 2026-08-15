import { useEffect, useState } from 'react';
import { arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { updateHabit, updateQuitHabit, updateSettings } from '../firebase/services';
import { collectReminders, permission, registerForPush, requestPermission, scheduleAll, triggersSupported } from '../lib/reminders';
import { exportAll, downloadJson } from '../lib/export';
import { Modal, SegmentedControl, Toggle } from '../components/ui';

const CARD_FIELDS = [
  { key: 'currentStreak', label: 'Current streak' },
  { key: 'percentComplete', label: '% achieved' },
  { key: 'points', label: 'Points / totals' },
  { key: 'startDate', label: 'Start date' },
  { key: 'targetDate', label: 'Target date' },
  { key: 'lastCheckIn', label: 'Last check-in' },
];

export default function SettingsPage({ open, onClose }) {
  const { user, signOutUser } = useAuth();
  const { uid, settings, profile, habits, quitHabits, goals, allHabits, allQuitHabits, entries, urges, unlocks, rewards } = useData();
  const [tab, setTab] = useState('dashboard');
  const [notifState, setNotifState] = useState(permission());
  const [scheduleInfo, setScheduleInfo] = useState(null);

  useEffect(() => setNotifState(permission()), [open]);

  if (!settings) return null;

  const toggleIn = (listKey, id) => {
    const list = settings[listKey] || [];
    updateSettings(uid, {
      [listKey]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    });
  };

  const setField = (key, value) =>
    updateSettings(uid, { cardFields: { ...settings.cardFields, [key]: value } });

  const setFeature = (key, value) =>
    updateSettings(uid, { features: { ...settings.features, [key]: value } });

  const enableNotifications = async () => {
    const result = await requestPermission();
    setNotifState(result);
    if (result !== 'granted') return;
    await updateSettings(uid, { notificationsEnabled: true });
    await registerForPush(uid, (token) => updateSettings(uid, { fcmTokens: arrayUnion(token) }));
    const info = await scheduleAll(collectReminders({ habits, quitHabits, goals }));
    setScheduleInfo(info);
  };

  const doExport = () => {
    downloadJson(
      exportAll({ profile, habits: allHabits, quitHabits: allQuitHabits, goals, entries, urges, rewards, unlocks }),
      `momentum-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  return (
    <Modal open={open} onClose={onClose} wide title="Settings">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          {user?.photoURL && (
            <img src={user.photoURL} alt="" className="h-12 w-12 rounded-2xl" referrerPolicy="no-referrer" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{profile?.displayName}</p>
            <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>
              {profile?.email}
            </p>
          </div>
          <button className="btn btn-ghost !px-3 !py-2 text-sm" onClick={signOutUser}>
            Sign out
          </button>
        </div>

        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'dashboard', label: 'Dashboard' },
            { value: 'reminders', label: 'Reminders' },
            { value: 'data', label: 'Data' },
          ]}
        />

        {tab === 'dashboard' && (
          <div className="space-y-5">
            <div>
              <h4 className="mb-1 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                What shows on the home screen
              </h4>
              <p className="mb-3 text-xs" style={{ color: 'var(--muted)' }}>
                Pick nothing and everything shows. Pick specific items to keep the home screen focused.
              </p>

              <Group title="Habits">
                {habits.map((h) => (
                  <Pick
                    key={h.id}
                    active={(settings.dashboardHabits || []).includes(h.id)}
                    onClick={() => toggleIn('dashboardHabits', h.id)}
                    label={`${h.emoji} ${h.name}`}
                  />
                ))}
              </Group>

              <Group title="Quitting">
                {quitHabits.map((h) => (
                  <Pick
                    key={h.id}
                    active={(settings.dashboardQuitHabits || []).includes(h.id)}
                    onClick={() => toggleIn('dashboardQuitHabits', h.id)}
                    label={`${h.emoji} ${h.name}`}
                  />
                ))}
              </Group>

              <Group title="Goals">
                {goals.map((g) => (
                  <Pick
                    key={g.id}
                    active={(settings.dashboardGoals || []).includes(g.id)}
                    onClick={() => toggleIn('dashboardGoals', g.id)}
                    label={`${g.emoji} ${g.title}`}
                  />
                ))}
              </Group>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Fields shown on each card
              </h4>
              <div className="card px-3">
                {CARD_FIELDS.map((field) => (
                  <Toggle
                    key={field.key}
                    checked={settings.cardFields?.[field.key] !== false && Boolean(settings.cardFields?.[field.key])}
                    onChange={(v) => setField(field.key, v)}
                    label={field.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Optional extras
              </h4>
              <div className="card px-3">
                <Toggle
                  checked={settings.features?.weeklyReview !== false}
                  onChange={(v) => setFeature('weeklyReview', v)}
                  label="Review tab"
                  description="Weekly and monthly trends"
                />
                <Toggle
                  checked={settings.features?.trends !== false}
                  onChange={(v) => setFeature('trends', v)}
                  label="Goal progress charts"
                />
                <Toggle
                  checked={settings.features?.urgeLogging !== false}
                  onChange={(v) => setFeature('urgeLogging', v)}
                  label="Urge logging"
                  description="For habits you're quitting"
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'reminders' && (
          <div className="space-y-4">
            {notifState !== 'granted' ? (
              <div className="card p-4">
                <p className="mb-3 text-sm font-semibold">
                  {notifState === 'denied'
                    ? 'Notifications are blocked for this site. Re-enable them in your browser settings for this app, then come back.'
                    : 'Turn on notifications to get reminders at the times you set on each habit and goal.'}
                </p>
                <button className="btn btn-primary w-full" onClick={enableNotifications} disabled={notifState === 'denied'}>
                  Enable notifications
                </button>
              </div>
            ) : (
              <div className="card p-4">
                <p className="text-sm font-bold" style={{ color: 'var(--success)' }}>
                  ✓ Notifications enabled
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                  {triggersSupported()
                    ? 'Your browser supports scheduled notifications, so reminders fire even when the app is closed.'
                    : 'Your browser doesn’t support scheduled notifications. Reminders fire while the app is open, and you’ll get a catch-up note next time you open it.'}
                </p>
                <button
                  className="btn btn-ghost mt-3 w-full"
                  onClick={async () =>
                    setScheduleInfo(await scheduleAll(collectReminders({ habits, quitHabits, goals })))
                  }
                >
                  Re-sync reminders
                </button>
                {scheduleInfo && (
                  <p className="mt-2 text-center text-xs" style={{ color: 'var(--muted)' }}>
                    {scheduleInfo.scheduled} reminder{scheduleInfo.scheduled === 1 ? '' : 's'} scheduled
                  </p>
                )}
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Your reminders
              </h4>
              <div className="space-y-2">
                {collectReminders({ habits, quitHabits, goals }).map((r) => (
                  <div key={r.id} className="card flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0 truncate text-sm font-semibold">{r.title}</span>
                    <span className="chip shrink-0">{r.time}</span>
                  </div>
                ))}
                {!collectReminders({ habits, quitHabits, goals }).length && (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    No reminders set. Turn one on when editing a habit or goal.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'data' && (
          <div className="space-y-4">
            <div className="card p-4">
              <h4 className="font-extrabold">Export your data</h4>
              <p className="mb-3 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                Downloads everything — habits, goals, every check-in, urges, rewards and badges — as a JSON
                file you can keep as a backup.
              </p>
              <button className="btn btn-ghost w-full" onClick={doExport}>
                ⬇ Download backup
              </button>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-black uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Archived
              </h4>
              <div className="space-y-2">
                {allHabits
                  .filter((h) => h.archived)
                  .map((h) => (
                    <ArchiveRow
                      key={h.id}
                      label={`${h.emoji} ${h.name}`}
                      onRestore={() => updateHabit(uid, h.id, { archived: false })}
                    />
                  ))}
                {allQuitHabits
                  .filter((h) => h.archived)
                  .map((h) => (
                    <ArchiveRow
                      key={h.id}
                      label={`${h.emoji} ${h.name}`}
                      onRestore={() => updateQuitHabit(uid, h.id, { archived: false })}
                    />
                  ))}
                {![...allHabits, ...allQuitHabits].some((h) => h.archived) && (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    Nothing archived.
                  </p>
                )}
              </div>
            </div>

            <div className="card p-4">
              <h4 className="font-extrabold">Week starts on</h4>
              <div className="mt-2">
                <SegmentedControl
                  value={settings.weekStartsOn ?? 1}
                  onChange={(v) => updateSettings(uid, { weekStartsOn: v })}
                  options={[
                    { value: 1, label: 'Monday' },
                    { value: 0, label: 'Sunday' },
                  ]}
                />
              </div>
            </div>

            <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
              Timezone: {settings.timezone}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

const Group = ({ title, children }) => {
  const items = Array.isArray(children) ? children.filter(Boolean) : children;
  if (!items || (Array.isArray(items) && !items.length)) return null;
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-bold" style={{ color: 'var(--muted)' }}>
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{items}</div>
    </div>
  );
};

const Pick = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="chip"
    style={active ? { background: 'var(--primary)', color: '#0a0a16' } : undefined}
  >
    {label}
  </button>
);

const ArchiveRow = ({ label, onRestore }) => (
  <div className="card flex items-center justify-between gap-3 p-3">
    <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
    <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={onRestore}>
      Restore
    </button>
  </div>
);
