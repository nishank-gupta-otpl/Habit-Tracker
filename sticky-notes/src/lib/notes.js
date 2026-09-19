// Pure note logic. Nothing here touches IndexedDB, React or the DOM, so the
// rules that decide what you see on the board are testable on their own.
import { newId } from './id.js';
import { DEFAULT_COLOR, isColor } from './colors.js';

/**
 * A note as stored. Every field a future sync adapter needs lives here:
 *  - updatedAt   last local edit, used for last-write-wins merges
 *  - syncedAt    updatedAt at the time of the last successful push (null = dirty)
 *  - deletedAt   soft delete. Tombstones stay around so a delete can propagate
 *                to other devices instead of the note reappearing from them.
 *
 * @typedef {object} Note
 * @property {string} id
 * @property {'text'|'list'} kind
 * @property {string} title
 * @property {string} body              plain text, used when kind === 'text'
 * @property {{id: string, text: string, done: boolean}[]} items  used when kind === 'list'
 * @property {string} color
 * @property {boolean} pinned
 * @property {string[]} labels
 * @property {number} order             higher sorts nearer the top of the board
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number|null} archivedAt
 * @property {number|null} deletedAt
 * @property {number|null} syncedAt
 */

/** Notes in the bin are purged this long after being thrown away. */
export const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function createNote(partial = {}, now = Date.now()) {
  return normalizeNote({
    id: newId(),
    kind: 'text',
    title: '',
    body: '',
    items: [],
    color: DEFAULT_COLOR,
    pinned: false,
    labels: [],
    order: now,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
    syncedAt: null,
    ...partial,
  });
}

/**
 * Coerces anything note-shaped into a valid note. Runs over everything read
 * from IndexedDB or an imported backup file, so a hand-edited or
 * half-written record can never crash the board.
 */
export function normalizeNote(raw, now = Date.now()) {
  const kind = raw?.kind === 'list' ? 'list' : 'text';
  const createdAt = num(raw?.createdAt, now);
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : newId(),
    kind,
    title: str(raw?.title),
    body: str(raw?.body),
    items: normalizeItems(raw?.items),
    color: isColor(raw?.color) ? raw.color : DEFAULT_COLOR,
    pinned: Boolean(raw?.pinned),
    labels: normalizeLabels(raw?.labels),
    order: num(raw?.order, createdAt),
    createdAt,
    updatedAt: num(raw?.updatedAt, createdAt),
    archivedAt: nullableNum(raw?.archivedAt),
    deletedAt: nullableNum(raw?.deletedAt),
    syncedAt: nullableNum(raw?.syncedAt),
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : newId(),
      text: str(item.text),
      done: Boolean(item.done),
    }));
}

function normalizeLabels(labels) {
  if (!Array.isArray(labels)) return [];
  const seen = new Set();
  const out = [];
  for (const label of labels) {
    const clean = str(label).trim().slice(0, 40);
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function str(value) {
  return typeof value === 'string' ? value : '';
}

function num(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function nullableNum(value) {
  return Number.isFinite(value) ? value : null;
}

/**
 * The fields the editor owns. Everything else — where the note sits on the
 * board, whether it is archived or binned — belongs to the board.
 */
export const CONTENT_FIELDS = ['kind', 'title', 'body', 'items', 'color', 'labels', 'pinned'];

/**
 * Writes a draft's content onto the note as it currently stands.
 *
 * This is what keeps a late save honest. The editor saves continuously and
 * once more on the way out, so a save can land after the note was archived or
 * binned; copying the whole draft over would quietly put it back on the board.
 */
export function applyContent(base, draft, now = Date.now()) {
  const content = {};
  for (const field of CONTENT_FIELDS) content[field] = draft[field];
  return touchNote(base, content, now);
}

/** Applies an edit and stamps it, which is also what marks the note dirty. */
export function touchNote(note, patch, now = Date.now()) {
  return normalizeNote({ ...note, ...patch, updatedAt: now, syncedAt: null }, now);
}

/** True when a note holds nothing worth keeping — used to discard empty drafts. */
export function isBlank(note) {
  if (note.title.trim()) return false;
  if (note.kind === 'list') return !note.items.some((item) => item.text.trim());
  return !note.body.trim();
}

/** The text a note is searched by, including its checklist items and labels. */
export function noteText(note) {
  const parts = [note.title, ...note.labels];
  if (note.kind === 'list') parts.push(...note.items.map((item) => item.text));
  else parts.push(note.body);
  return parts.join('\n').toLowerCase();
}

export function matchesQuery(note, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = noteText(note);
  // Every whitespace-separated term must appear, so "milk shop" narrows rather
  // than widens the way a single-substring match would.
  return needle.split(/\s+/).every((term) => haystack.includes(term));
}

export const VIEWS = ['board', 'archive', 'trash'];

function inView(note, view) {
  if (note.deletedAt) return view === 'trash';
  if (note.archivedAt) return view === 'archive';
  return view === 'board';
}

/**
 * Board order: pinned notes first, then by the drag-assigned order (highest
 * first), with id as a tiebreak so the sort is stable across reloads.
 * The bin and the archive ignore pins and show the most recent change first.
 */
export function sortNotes(notes, view = 'board') {
  const sorted = [...notes];
  if (view === 'board') {
    sorted.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.order - a.order || a.id.localeCompare(b.id),
    );
  } else {
    const stamp = (n) => n.deletedAt ?? n.archivedAt ?? n.updatedAt;
    sorted.sort((a, b) => stamp(b) - stamp(a) || a.id.localeCompare(b.id));
  }
  return sorted;
}

/** The one call the board makes: pick the view, apply the filters, sort. */
export function selectNotes(notes, { view = 'board', query = '', label = null } = {}) {
  const visible = notes.filter(
    (note) =>
      inView(note, view) &&
      (!label || note.labels.some((l) => l.toLowerCase() === label.toLowerCase())) &&
      matchesQuery(note, query),
  );
  return sortNotes(visible, view);
}

/** Every label in use on live (non-deleted) notes, for the filter chips. */
export function allLabels(notes) {
  const byKey = new Map();
  for (const note of notes) {
    if (note.deletedAt) continue;
    for (const label of note.labels) {
      const key = label.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, { label, count: 0 });
      byKey.get(key).count += 1;
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Moves `id` to the slot currently held by `overId` within `ordered`, and
 * returns only the notes whose order actually changed.
 *
 * Orders are spaced by whole numbers on every move rather than bisected,
 * because bisecting repeatedly runs out of float precision after a few hundred
 * drags — cheap to renumber a personal board, impossible to debug when it
 * silently collapses.
 */
export function reorder(ordered, id, overId, now = Date.now()) {
  const from = ordered.findIndex((n) => n.id === id);
  const to = ordered.findIndex((n) => n.id === overId);
  if (from === -1 || to === -1 || from === to) return [];

  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  // Highest order sorts first, so walk the list backwards handing out
  // increasing values based on a shared, monotonic starting point.
  const base = Math.max(now, ...ordered.map((n) => n.order));
  const changed = [];
  next.forEach((note, index) => {
    const order = base + (next.length - index);
    if (order !== note.order) changed.push({ ...note, order, updatedAt: now, syncedAt: null });
  });
  return changed;
}

/** Ids of notes that have sat in the bin past the retention window. */
export function expiredTrash(notes, now = Date.now()) {
  return notes.filter((n) => n.deletedAt && now - n.deletedAt > TRASH_TTL_MS).map((n) => n.id);
}

/** Merges a remote note with the local one. Kept here so a sync adapter
 *  inherits the rule rather than inventing its own: newest edit wins, and a
 *  delete only loses to a strictly newer edit. */
export function mergeNote(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  return remote.updatedAt > local.updatedAt ? remote : local;
}
