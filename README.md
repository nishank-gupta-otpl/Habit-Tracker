# ⚡ Momentum — Habit & Goal Dashboard

A personal productivity dashboard for building habits, breaking bad ones, tracking goals and
earning rewards along the way. Built as a responsive web app that installs on Android as a PWA —
one codebase, no separate native app.

Single-user by design. This is not a multi-tenant SaaS; it's built for one person's daily use.

---

## What it does

| | |
|---|---|
| **🔥 Build habits** | Daily, specific-days, or "N times per week" cadences. Streak counting, a month calendar you can backfill, and consistency stats. |
| **🛡️ Break bad habits** | Days-since-last-slip counter, clean/slip logging, urge tracking with triggers and intensity, and a "what sets you off" breakdown. |
| **🎯 Goals** | Numeric (including targets that count *down*, like weight) or milestone checklists. Auto-calculated % complete plus a pace marker showing whether you're ahead or behind for the target date. |
| **🏆 Rewards** | XP for every action, 28 badges, 7 unlockable themes, and custom "treat myself to X" rewards tied to a milestone you choose. |
| **🏠 Custom dashboard** | Choose which habits/goals appear on the home screen and which fields each card shows. |
| **⏰ Reminders** | Per-habit and per-goal reminder times with notifications. See [Reminders](#reminders) for an important note about the free plan. |
| **📊 Extras** | Weekly/monthly review with trend charts, and JSON data export. Both toggleable in Settings. |

---

## Setup

### 1. Create the Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com) → **Add project**.
   Google Analytics is not needed.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Set a support email
   and save.
3. **Build → Firestore Database → Create database.** Start in **production mode** and pick a region
   near you. The rules in this repo will replace the defaults on first deploy.
4. **Project settings (gear icon) → Your apps → Web (`</>`)**. Register the app, then copy the
   `firebaseConfig` values from the snippet it shows you.

### 2. Configure the app

```bash
cp .env.example .env.local
```

Fill in `.env.local` with the values from step 4 above.

> These keys are **not secrets** — they identify your project and are visible in any web app's
> bundle. Access is controlled by `firestore.rules`, which only ever lets a signed-in user read and
> write their own data.

Then point the deploy config at your project — edit `.firebaserc` and replace
`REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` with your real project ID.

### 3. Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with Google.

### 4. Deploy

```bash
npx firebase login
npm run deploy
```

That builds the app and pushes hosting, Firestore rules and indexes together. Your app lands at
`https://<project-id>.web.app`.

To deploy only part of it: `npm run deploy:hosting` or `npm run deploy:rules`.

### 5. Install on Android

Open the deployed URL in Chrome on your phone → menu (⋮) → **Add to Home screen** / **Install app**.
It then runs full-screen with its own icon, works offline, and syncs when the connection returns.

Installability requires HTTPS, which Firebase Hosting provides automatically.

---

## Reminders

**Please read this — it's the one place the original plan needed adjusting.**

The brief assumed Firebase Cloud Messaging would deliver scheduled reminders on the free **Spark**
plan. FCM *delivery* is indeed free and unlimited, but something has to decide *"it's 8am, send the
push"* — and on Firebase that scheduler is **Cloud Functions**, which requires the pay-as-you-go
**Blaze** plan. There is no server-side scheduler on Spark.

So reminders are scheduled **on the device**, in three layers, and cost nothing:

1. **Scheduled notifications** (`TimestampTrigger`). Chrome on Android fires these even when the app
   is closed and the browser isn't running. This is the real "notification at 8am" experience with
   no server at all. The app tops the queue back up every time you open it.
2. **In-session timers** for browsers without trigger support — any reminder due while the app is
   open still fires.
3. **A catch-up banner** on next open, listing anything that was due today and hasn't been logged.
   A missed reminder is never silent.

FCM is still fully wired up: `registerForPush()` stores your device token on your user document. If
you ever upgrade to Blaze, add a scheduled Cloud Function that reads `settings.fcmTokens` and sends
to them — no client changes needed. The service worker already handles incoming pushes
(`public/sw-custom.js`).

Enable notifications from **Settings → Reminders**.

---

## Data model

Designed up front, before any UI, because it's the expensive thing to change later. Everything lives
under `users/{uid}` — that costs nothing and makes the security rules a one-liner.

```
users/{uid}                             profile, settings, lifetime stats
├── habits/{habitId}                    habits to BUILD
├── quitHabits/{habitId}                habits to QUIT
├── entries/{habitId}_{YYYY-MM-DD}      one check-in per habit per day
├── urges/{urgeId}                      urge/trigger log (many per day)
├── goals/{goalId}                      goals with measurable progress
│   └── progress/{id}                   progress-update log
├── rewards/{rewardId}                  user-defined custom rewards
└── unlocks/{key}                       earned badges + cosmetic unlocks
```

`src/firebase/schema.js` is the single source of truth — every field, with the reasoning, and a
factory function per document type so no write can silently miss a field.

### The five decisions worth knowing

1. **Check-ins live in one flat `entries` collection**, not nested under each habit. The document ID
   is `{habitId}_{YYYY-MM-DD}`, which makes check-ins **idempotent** — checking in twice on the same
   day overwrites rather than duplicating — and lets a single date-range listener feed the
   dashboard, calendar and charts at once.

2. **`habits` and `quitHabits` are separate collections.** The streak maths is shared in
   `src/lib/streaks.js` so the two can't drift, but the stored shapes stay independent: quit habits
   carry slip and urge fields that would be dead weight on a build habit.

3. **Goals store both a current value and a progress log.** `currentValue` gives instant % complete;
   the `progress` subcollection is the audit trail that powers the trend chart and pace tracking.

4. **Urges are their own collection**, because there can be many in a day whereas an entry is
   strictly one per habit per day. This keeps the day's entry document from growing without bound.

5. **Dates are local `YYYY-MM-DD` strings, not timestamps.** A streak is a human concept anchored to
   *your* midnight, so day keys are computed in your timezone and compared as strings — which
   sidesteps every DST and UTC-offset trap. *Assumption: you don't frequently cross timezones. If
   you do, historical day keys stay as they were recorded rather than shifting retroactively, which
   is the behaviour you want for a habit tracker.*

### Streak rules

- `done` extends a streak.
- `skipped` is a **planned rest day**: it neither extends nor breaks a streak. Deliberately taking
  Sunday off doesn't wipe out three weeks of work.
- A scheduled day with no entry breaks the streak — but only once it's in the past. Today being
  blank is *"not yet"*, not a failure.
- `slip` resets a quit habit's clean streak to zero. **Slips never cost XP** — a tracker you're
  afraid to be honest with is useless.

---

## The reward economy

Defined in `src/lib/xp.js`.

| Action | XP |
|---|---|
| Habit check-in | 10 + 2/day of streak (bonus caps at 30) |
| Clean day on a quit habit | 12 + streak bonus |
| Resisting a logged urge | 5 |
| Logging goal progress | 8 |
| Completing a milestone | 25 |
| Completing a goal | 150 |

Level *N* requires `50 × N × (N−1)` total XP — level 2 at 100 XP (about four days of check-ins),
stretching out steadily after that. Themes unlock at levels 1, 3, 6, 10, 15, 22 and 30.

Undoing a check-in refunds exactly the XP that entry granted — the amount is stored on the entry
itself (`xpAwarded`), so the refund is always exact even if the rates change later.

---

## Development

```bash
npm run dev        # dev server
npm test           # unit tests for streaks, goal maths and XP
npm run build      # production build
npm run lint       # oxlint
npm run emulators  # Firebase Auth + Firestore emulators for offline development
```

To work against the emulators, add `VITE_USE_EMULATOR=true` to `.env.local` and run
`npm run emulators` in a second terminal. Nothing touches your real data.

The test suite covers the parts most likely to be subtly wrong: streak counting across rest days,
non-scheduled days and gaps; days-since-slip; goals that count down; pace calculation; and the XP
curve.

### Project layout

```
src/
├── firebase/
│   ├── config.js      SDK init, offline persistence, emulator wiring
│   ├── schema.js      ← the data model, documented
│   └── services.js    every Firestore write in the app
├── context/
│   ├── AuthContext    Google sign-in
│   ├── DataContext    real-time listeners + all derived state
│   └── RewardContext  every action that earns points, plus the celebration queue
├── lib/               dates, streaks, progress, xp, badges, themes, reminders, export
├── components/        cards, forms, detail sheets, UI primitives
└── pages/             dashboard, habits, goals, rewards, review, settings
```

---

## Notes and assumptions

- **Offline-first.** Firestore persistence is enabled, so check-ins queue up with no signal and sync
  when you're back. The app is fully usable on the tube.
- **History window.** The app keeps 400 days of entries live in memory — enough for a full year of
  streaks plus the calendar. Older data stays in Firestore and is included in exports.
- **Cached streak numbers self-heal.** Each habit document caches its streak for fast card renders,
  but the values are recomputed from entries on load, so a stale cache corrects itself rather than
  corrupting history.
- **Free-tier headroom.** At one person's volume this sits far inside Spark limits: Google sign-in
  is free to 50k MAU, and daily Firestore reads/writes are orders of magnitude below the free quota.
  The only thing Spark can't do is server-scheduled push — see [Reminders](#reminders).
- **Bundle size.** Charts are lazy-loaded, so the initial download is ~273 KB gzipped and the
  ~99 KB charting library only arrives if you open the Review tab or a goal.
