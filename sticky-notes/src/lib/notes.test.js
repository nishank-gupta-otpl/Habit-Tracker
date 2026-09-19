import { describe, expect, it } from 'vitest';
import {
  TRASH_TTL_MS,
  allLabels,
  applyContent,
  createNote,
  expiredTrash,
  isBlank,
  matchesQuery,
  mergeNote,
  normalizeNote,
  reorder,
  selectNotes,
  sortNotes,
  touchNote,
} from './notes.js';

const at = (id, extra = {}) => createNote({ id, ...extra });

describe('normalizeNote', () => {
  it('fills in everything a half-written record is missing', () => {
    const note = normalizeNote({ id: 'a', title: 'Hi' }, 1000);
    expect(note).toMatchObject({
      id: 'a',
      kind: 'text',
      title: 'Hi',
      body: '',
      items: [],
      pinned: false,
      labels: [],
      createdAt: 1000,
      updatedAt: 1000,
      archivedAt: null,
      deletedAt: null,
      syncedAt: null,
    });
  });

  it('rejects junk rather than letting it reach the board', () => {
    const note = normalizeNote(
      { id: 'a', kind: 'doodle', color: '#ff0000', labels: 'work', items: [null, 3], pinned: 'yes' },
      500,
    );
    expect(note.kind).toBe('text');
    expect(note.color).toBe('butter');
    expect(note.labels).toEqual([]);
    expect(note.items).toEqual([]);
    expect(note.pinned).toBe(true);
  });

  it('dedupes labels case-insensitively and sorts them', () => {
    const note = normalizeNote({ labels: ['Work', 'home', 'work', '  ', 'Home'] });
    expect(note.labels).toEqual(['home', 'Work']);
  });

  it('gives an id to a record that arrived without one', () => {
    expect(normalizeNote({ title: 'x' }).id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('touchNote', () => {
  it('stamps the edit and marks the note unsynced', () => {
    const note = createNote({ syncedAt: 10 }, 10);
    const next = touchNote(note, { title: 'New' }, 99);
    expect(next.title).toBe('New');
    expect(next.updatedAt).toBe(99);
    expect(next.syncedAt).toBeNull();
    expect(next.createdAt).toBe(10);
  });
});

describe('isBlank', () => {
  it('treats whitespace-only notes as empty', () => {
    expect(isBlank(createNote({ title: '  ', body: '\n' }))).toBe(true);
    expect(isBlank(createNote({ body: 'x' }))).toBe(false);
  });

  it('looks at item text for checklists', () => {
    const empty = createNote({ kind: 'list', items: [{ id: '1', text: '', done: false }] });
    expect(isBlank(empty)).toBe(true);
    expect(isBlank(createNote({ kind: 'list', items: [{ id: '1', text: 'Milk' }] }))).toBe(false);
  });
});

describe('matchesQuery', () => {
  const note = createNote({
    title: 'Shopping',
    kind: 'list',
    items: [{ id: '1', text: 'Oat milk', done: false }],
    labels: ['Errands'],
  });

  it('searches title, items and labels', () => {
    expect(matchesQuery(note, 'shopping')).toBe(true);
    expect(matchesQuery(note, 'oat')).toBe(true);
    expect(matchesQuery(note, 'errands')).toBe(true);
    expect(matchesQuery(note, 'bread')).toBe(false);
  });

  it('requires every term, so more words narrow the result', () => {
    expect(matchesQuery(note, 'milk shopping')).toBe(true);
    expect(matchesQuery(note, 'milk bread')).toBe(false);
  });

  it('matches everything when the query is blank', () => {
    expect(matchesQuery(note, '   ')).toBe(true);
  });
});

describe('sortNotes', () => {
  it('puts pinned notes first, then highest order', () => {
    const notes = [
      at('a', { order: 3 }),
      at('b', { order: 1, pinned: true }),
      at('c', { order: 9 }),
    ];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts the bin by when notes were thrown away', () => {
    const notes = [
      at('a', { deletedAt: 100 }),
      at('b', { deletedAt: 300 }),
      at('c', { deletedAt: 200 }),
    ];
    expect(sortNotes(notes, 'trash').map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('is stable for notes that tie', () => {
    const notes = [at('b', { order: 5 }), at('a', { order: 5 })];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('selectNotes', () => {
  const notes = [
    at('live', { title: 'Live', labels: ['work'] }),
    at('archived', { title: 'Archived', archivedAt: 1 }),
    at('deleted', { title: 'Deleted', deletedAt: 1 }),
    at('both', { title: 'Deleted and archived', archivedAt: 1, deletedAt: 2 }),
  ];

  it('shows only live notes on the board', () => {
    expect(selectNotes(notes, { view: 'board' }).map((n) => n.id)).toEqual(['live']);
  });

  it('keeps a deleted note in the bin even when it was archived first', () => {
    expect(selectNotes(notes, { view: 'archive' }).map((n) => n.id)).toEqual(['archived']);
    expect(selectNotes(notes, { view: 'trash' }).map((n) => n.id).sort()).toEqual([
      'both',
      'deleted',
    ]);
  });

  it('filters by label regardless of case', () => {
    expect(selectNotes(notes, { label: 'WORK' }).map((n) => n.id)).toEqual(['live']);
    expect(selectNotes(notes, { label: 'home' })).toEqual([]);
  });

  it('applies the label filter and the query together', () => {
    expect(selectNotes(notes, { label: 'work', query: 'nope' })).toEqual([]);
  });
});

describe('allLabels', () => {
  it('counts labels on live notes and ignores the bin', () => {
    const notes = [
      at('a', { labels: ['work'] }),
      at('b', { labels: ['Work', 'home'] }),
      at('c', { labels: ['gone'], deletedAt: 1 }),
    ];
    expect(allLabels(notes)).toEqual([
      { label: 'home', count: 1 },
      { label: 'work', count: 2 },
    ]);
  });
});

describe('reorder', () => {
  const board = () => [at('a', { order: 30 }), at('b', { order: 20 }), at('c', { order: 10 })];

  it('moves a note down into another note’s slot', () => {
    const notes = board();
    const changed = reorder(notes, 'a', 'c', 1000);
    const byId = new Map(changed.map((n) => [n.id, n]));
    const next = notes.map((n) => byId.get(n.id) ?? n);
    expect(sortNotes(next).map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('moves a note up', () => {
    const notes = board();
    const changed = reorder(notes, 'c', 'a', 1000);
    const byId = new Map(changed.map((n) => [n.id, n]));
    const next = notes.map((n) => byId.get(n.id) ?? n);
    expect(sortNotes(next).map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  it('assigns whole-number gaps so repeated drags cannot exhaust precision', () => {
    let notes = board();
    for (let i = 0; i < 500; i += 1) {
      const changed = reorder(notes, notes[0].id, notes[2].id, 1000 + i);
      const byId = new Map(changed.map((n) => [n.id, n]));
      notes = sortNotes(notes.map((n) => byId.get(n.id) ?? n));
    }
    const orders = notes.map((n) => n.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('does nothing when the note is dropped on itself or on a stranger', () => {
    expect(reorder(board(), 'a', 'a')).toEqual([]);
    expect(reorder(board(), 'a', 'zz')).toEqual([]);
  });

  it('only returns the notes whose order actually moved', () => {
    const changed = reorder(board(), 'a', 'b', 1000);
    expect(changed.every((n) => n.syncedAt === null && n.updatedAt === 1000)).toBe(true);
  });
});

describe('expiredTrash', () => {
  it('collects only notes past the retention window', () => {
    const now = 10_000_000_000;
    const notes = [
      at('old', { deletedAt: now - TRASH_TTL_MS - 1 }),
      at('fresh', { deletedAt: now - 1000 }),
      at('live'),
    ];
    expect(expiredTrash(notes, now)).toEqual(['old']);
  });
});

describe('mergeNote', () => {
  it('keeps the most recently edited copy', () => {
    const local = at('a', { title: 'local', updatedAt: 5 });
    const remote = at('a', { title: 'remote', updatedAt: 9 });
    expect(mergeNote(local, remote).title).toBe('remote');
    expect(mergeNote(remote, local).title).toBe('remote');
  });

  it('handles a note that exists on only one side', () => {
    const note = at('a');
    expect(mergeNote(null, note)).toBe(note);
    expect(mergeNote(note, null)).toBe(note);
  });
});

describe('applyContent', () => {
  const stored = createNote({
    id: 'a',
    title: 'On the board',
    order: 42,
    archivedAt: 777,
    deletedAt: 888,
    createdAt: 1,
  });

  it('copies the content the editor owns', () => {
    const draft = { ...stored, title: 'Edited', body: 'New body', color: 'sky', pinned: true };
    const next = applyContent(stored, draft, 1000);
    expect(next).toMatchObject({ title: 'Edited', body: 'New body', color: 'sky', pinned: true });
  });

  it('leaves where the note lives alone, so a late save cannot un-archive it', () => {
    // The editor's draft still looks like a live, unarchived note, because it
    // was opened before the note was archived and binned.
    const draft = { ...stored, archivedAt: null, deletedAt: null, order: 9 };
    const next = applyContent(stored, draft, 1000);
    expect(next.archivedAt).toBe(777);
    expect(next.deletedAt).toBe(888);
    expect(next.order).toBe(42);
  });

  it('keeps the original creation time and stamps the edit', () => {
    const next = applyContent(stored, { ...stored, title: 'x' }, 1000);
    expect(next.createdAt).toBe(1);
    expect(next.updatedAt).toBe(1000);
    expect(next.syncedAt).toBeNull();
  });
});
