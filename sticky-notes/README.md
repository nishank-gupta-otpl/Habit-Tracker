# Sticky Notes

A personal sticky notes board that installs on an Android phone from the
browser, works with no signal, and keeps everything on the device.

Built as a self-contained app inside this repo — it shares nothing with the
Momentum habit tracker at the root and can be installed alongside it.

## What it does

- **A board of notes** in a masonry layout, two columns on a phone, more on a
  tablet. Drag the grip on a card to reorder; pinned notes stay on top.
- **Text notes and checklists**, convertible either way without losing the
  content. Checklist items can be ticked straight from the board.
- **Eight paper colours**, muted automatically in dark mode.
- **Labels** with a filter row, and search that looks inside titles, bodies,
  checklist items and labels. Extra words narrow the search rather than
  widening it.
- **Archive and a bin.** Deleting is always undoable; the bin empties itself
  after 30 days. Emptying it by hand is the only action that asks first.
- **Export and import** a JSON backup. Importing merges rather than replaces,
  so re-importing the same file changes nothing.
- **Light, dark or system theme**, applied before the first paint so the board
  never flashes white at night.

## Android specifics

These are the reasons it feels like an app rather than a web page:

- **Installable.** Chrome offers *Add to home screen* / *Install app*; it then
  launches full-screen with no browser chrome.
- **The back gesture closes the editor** instead of leaving the app. The editor
  pushes a history entry when it opens and pops it when it closes.
- **It's in the share sheet.** Share text from any app and it arrives as a
  pre-filled note (`share_target` in the manifest).
- **Home-screen shortcuts.** Long-press the icon for *New note* and
  *New checklist*.
- **Nothing is lost when Android kills the tab.** The editor saves on every
  keystroke and again when the app is backgrounded — there is no Save button.
- **Safe-area aware**, so the board runs under the gesture bar without hiding
  anything behind it.

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build into dist/
npm run preview   # serve the built app
npm test          # unit tests
npm run lint      # oxlint
npm run icons     # regenerate the app icons (pure Python, no dependencies)
```

### Getting it onto your phone

The app needs HTTPS (or `localhost`) before the service worker and the install
prompt will work. `.github/workflows/sticky-notes-pages.yml` builds it and
publishes it to GitHub Pages on every push to this branch.

**One-time setup, by hand:** repo *Settings → Pages → Build and deployment →
Source: **GitHub Actions***. The workflow cannot do this itself — creating a
Pages site needs repository admin, and the Actions token is refused. Re-run the
workflow afterwards; it then publishes to `https://<owner>.github.io/<repo>/`.
If the deploy step is rejected with a protection-rule error, add this branch
under *Settings → Environments → github-pages → Deployment branches and tags*.

On the phone, open that URL in Chrome and use the ⋮ menu → *Add to home
screen* (Chrome may offer *Install app* by itself). Then add a note, turn on
aeroplane mode and reopen it — everything is still there.

Any other static host works too: the build output in `dist/` is plain files.
Serving from a domain root needs no configuration; serving from a subfolder
needs `APP_BASE` set to that path at build time, because the manifest's scope
has to match the URL it is served from or Android will not offer to install it.

To try it without deploying, `npm run dev -- --host` and open the printed
`http://<your-laptop-ip>:5173` on a phone on the same wifi. Plain HTTP means no
install and no offline, so it is for a look rather than for daily use.

## How it is put together

```
src/
  lib/          pure logic: the note model, sorting, search, reordering, backups
  store/        storage: a small IndexedDB wrapper and the adapters over it
  context/      NotesProvider — holds every note, writes changes straight through
  hooks/        drag-to-reorder, theme
  components/   the board, the cards, the editor, the sheets
```

The rules that decide what you see — what counts as a match, what sorts where,
what an edit is allowed to overwrite — live in `src/lib/notes.js` with no React
or browser APIs anywhere near them, which is why they can be tested directly.

Notes are all held in memory and written through to IndexedDB in the
background. A personal board is a few hundred notes at most, so search,
filtering and reordering are plain array operations with no query layer and no
loading states.

### Storage, and adding sync later

Everything goes through the four-method contract documented in
`src/store/index.js`:

```js
loadAll()        // every note, tombstones included
saveMany(notes)  // insert or replace, by id
hardDelete(ids)  // remove for good
clear()
```

Nothing above that line knows where notes live, so cloud sync can be added
without touching a component. The note model already carries what a merge
needs:

- **`id`** is a UUID generated on the device, so two phones cannot collide.
- **`updatedAt`** is stamped on every edit; `mergeNote()` in `lib/notes.js` is
  the last-write-wins rule a sync adapter should use.
- **`syncedAt`** is set to `null` by every edit, so "what needs pushing" is
  just `syncedAt !== updatedAt`.
- **`deletedAt`** is a tombstone rather than a row disappearing, so a delete
  propagates instead of the note coming back from the other device.
- **`applyContent()`** separates what the editor owns from what the board owns,
  so a save that lands late cannot resurrect an archived or deleted note.

A remote adapter implements the same four methods and is composed with the
local one; local stays the source of truth for reads so the app still opens
instantly offline. This repo's root app already uses Firebase, so that is the
obvious backend — it was deliberately left out rather than designed around.

If IndexedDB is unavailable (private mode, storage blocked), the app falls back
to an in-memory store for the session and says so in Settings, rather than
failing to open or silently losing notes.

## Testing

`npm test` covers the note model, search and sort rules, reordering, backup
round-trips, and both storage adapters — the IndexedDB one against a real
implementation via `fake-indexeddb`, not a stub.

The board itself was verified by driving the built app in Chromium at phone
size: creating notes and checklists, pinning, searching, label filtering,
archive/bin/undo, drag reordering, reload persistence, the back gesture, the
share target and the shortcuts.
