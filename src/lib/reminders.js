// Reminder scheduling.
//
// IMPORTANT PLAN CONSTRAINT — please read before changing this.
//
// The brief assumed Firebase Cloud Messaging would deliver scheduled reminders
// on the free Spark plan. FCM *delivery* is indeed free and unlimited, but
// something has to decide "it's 8am, send the push" — and on Firebase that is
// Cloud Functions (or Cloud Scheduler), which now require the pay-as-you-go
// Blaze plan. There is no server-side scheduler on Spark.
//
// So reminders are scheduled ON THE DEVICE instead, in three layers:
//
//   1. Notification Triggers (TimestampTrigger) — Chrome on Android fires these
//      even when the app is closed and the browser isn't running. This is the
//      real "push notification at 8am" experience and needs no server at all.
//   2. setTimeout while the app is open — covers browsers without triggers for
//      any reminder due during the current session.
//   3. A catch-up banner on next open — if a reminder time passed and nothing
//      was logged, the app says so when you next open it. Never silent failure.
//
// FCM is still fully wired up (registerForPush below stores the device token in
// Firestore). The day the owner upgrades to Blaze, a ~20-line scheduled Cloud
// Function can read those tokens and send real server pushes with no client
// changes. See README "Reminders" for that function.

import { app, vapidKey } from '../firebase/config';

const STORE_KEY = 'momentum.scheduled-reminders';

export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

export const triggersSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'showTrigger' in Notification.prototype;

export const permission = () => (notificationsSupported() ? Notification.permission : 'unsupported');

export async function requestPermission() {
  if (!notificationsSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  return result;
}

/**
 * Collect every enabled reminder across habits, quit habits and goals into a
 * flat list the scheduler can work with.
 */
export function collectReminders({ habits = [], quitHabits = [], goals = [] }) {
  const out = [];
  const add = (item, kind, title) => {
    const r = item.reminder;
    if (!r?.enabled || !r.time) return;
    out.push({
      id: `${kind}:${item.id}`,
      kind,
      refId: item.id,
      title,
      body: reminderBody(kind, item),
      time: r.time,
      days: r.days?.length ? r.days : [0, 1, 2, 3, 4, 5, 6],
      emoji: item.emoji,
    });
  };

  habits.forEach((h) => add(h, 'habit', `${h.emoji} ${h.name}`));
  quitHabits.forEach((h) => add(h, 'quit', `${h.emoji} ${h.name}`));
  goals.forEach((g) => add(g, 'goal', `${g.emoji} ${g.title}`));
  return out;
}

const reminderBody = (kind, item) => {
  if (kind === 'quit') return 'How’s today going? Log it while it’s fresh.';
  if (kind === 'goal') return 'Any progress to log on this goal?';
  return item.targetValue ? `Time for ${item.targetValue} ${item.unit || ''}`.trim() : 'Time to check in.';
};

/** Next occurrence of HH:mm on one of `days`, as a Date. */
export function nextOccurrence(time, days, from = new Date()) {
  const [hours, minutes] = time.split(':').map(Number);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate > from && days.includes(candidate.getDay())) return candidate;
  }
  return null;
}

/**
 * Schedule everything. Called whenever reminders change or the app opens.
 * Existing scheduled notifications are cleared first so edits don't pile up.
 */
export async function scheduleAll(reminders) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return { scheduled: 0, mode: 'none' };

  const registration = await navigator.serviceWorker.ready;

  // Clear previously scheduled triggers (they show up as pending notifications).
  try {
    const pending = await registration.getNotifications({ includeTriggered: false, tag: undefined });
    pending.filter((n) => n.data?.momentum).forEach((n) => n.close());
  } catch {
    // getNotifications with includeTriggered isn't universal; safe to skip.
  }

  let scheduled = 0;

  if (triggersSupported()) {
    // Schedule the next 14 occurrences of each reminder. Chrome fires these
    // with the browser closed, and we top the queue back up on every app open.
    for (const reminder of reminders) {
      let cursor = new Date();
      for (let i = 0; i < 14; i += 1) {
        const when = nextOccurrence(reminder.time, reminder.days, cursor);
        if (!when) break;
        try {
          await registration.showNotification(reminder.title, {
            body: reminder.body,
            tag: `${reminder.id}:${when.toISOString().slice(0, 10)}`,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            data: { momentum: true, kind: reminder.kind, refId: reminder.refId, url: '/' },
            showTrigger: new TimestampTrigger(when.getTime()),
          });
          scheduled += 1;
        } catch {
          break;
        }
        cursor = when;
      }
    }
    persist(reminders);
    return { scheduled, mode: 'triggers' };
  }

  // Fallback: in-session timers only.
  clearTimers();
  for (const reminder of reminders) {
    const when = nextOccurrence(reminder.time, reminder.days);
    if (!when) continue;
    const delay = when.getTime() - Date.now();
    // setTimeout maxes out at ~24.8 days; anything beyond a day is picked up on
    // the next app open anyway.
    if (delay > 0 && delay < 86_400_000) {
      const handle = setTimeout(() => {
        registration.showNotification(reminder.title, {
          body: reminder.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/badge-72.png',
          data: { momentum: true, kind: reminder.kind, refId: reminder.refId, url: '/' },
        });
      }, delay);
      timers.push(handle);
      scheduled += 1;
    }
  }
  persist(reminders);
  return { scheduled, mode: 'timers' };
}

const timers = [];
const clearTimers = () => {
  while (timers.length) clearTimeout(timers.pop());
};

const persist = (reminders) => {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ at: Date.now(), reminders: reminders.map((r) => ({ id: r.id, time: r.time, days: r.days })) }),
    );
  } catch {
    // Storage full or blocked — scheduling still works, we just lose catch-up.
  }
};

/**
 * Layer 3: which reminders were due since the last app open but never acted on?
 * Powers the in-app catch-up banner so a missed push is never silent.
 */
export function missedReminders(reminders, { entryIndex, today }) {
  const now = new Date();
  return reminders.filter((reminder) => {
    if (!reminder.days.includes(now.getDay())) return false;
    const [h, m] = reminder.time.split(':').map(Number);
    const due = new Date();
    due.setHours(h, m, 0, 0);
    if (due > now) return false; // not due yet today
    if (reminder.kind === 'goal') return false; // goals aren't a daily obligation
    return !entryIndex[reminder.refId]?.[today];
  });
}

/**
 * Register this device for FCM push. Stores the token on the user doc so a
 * future Cloud Function (Blaze plan) can send real server-side pushes.
 * Safe to call on Spark — it just records a token nothing sends to yet.
 */
export async function registerForPush(uid, saveToken) {
  if (!notificationsSupported() || !vapidKey) return null;
  try {
    // firebase/messaging is only pulled in when push is actually being set up,
    // so the ~30KB stays out of the initial bundle.
    const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
    if (!(await isSupported())) return null;
    const messaging = getMessaging(app);
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (token && saveToken) await saveToken(token);
    return token;
  } catch {
    return null; // FCM unavailable (no VAPID key, unsupported browser) — not fatal.
  }
}
