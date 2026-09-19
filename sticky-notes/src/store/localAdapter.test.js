import { beforeEach, describe, expect, it } from 'vitest';
import { createNote } from '../lib/notes.js';
import { createLocalAdapter, createMemoryAdapter } from './localAdapter.js';
import { closeDb } from './idb.js';

// Every case gets its own database, otherwise the module-level connection
// cache would carry notes between tests.
async function freshAdapter() {
  closeDb();
  const adapter = createLocalAdapter();
  await adapter.clear();
  return adapter;
}

describe.each([
  ['local (IndexedDB)', freshAdapter],
  ['memory fallback', async () => createMemoryAdapter()],
])('%s adapter', (_name, make) => {
  let store;

  beforeEach(async () => {
    store = await make();
  });

  it('starts empty', async () => {
    expect(await store.loadAll()).toEqual([]);
  });

  it('round-trips notes', async () => {
    const note = createNote({ title: 'Buy milk', labels: ['errands'] });
    await store.saveMany([note]);
    const [loaded] = await store.loadAll();
    expect(loaded).toEqual(note);
  });

  it('replaces a note with the same id rather than duplicating it', async () => {
    const note = createNote({ id: 'fixed', title: 'One' });
    await store.saveMany([note]);
    await store.saveMany([{ ...note, title: 'Two' }]);
    const all = await store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('Two');
  });

  it('normalizes on the way in, so a bad write cannot poison the board', async () => {
    await store.saveMany([{ id: 'x', title: 'Hi', color: 'neon', labels: null }]);
    const [loaded] = await store.loadAll();
    expect(loaded.color).toBe('butter');
    expect(loaded.labels).toEqual([]);
  });

  it('keeps soft-deleted notes, which is what makes the bin work', async () => {
    await store.saveMany([createNote({ id: 'gone', deletedAt: 123 })]);
    expect((await store.loadAll())[0].deletedAt).toBe(123);
  });

  it('hard-deletes only the ids it is given', async () => {
    await store.saveMany([createNote({ id: 'a' }), createNote({ id: 'b' })]);
    await store.hardDelete(['a']);
    expect((await store.loadAll()).map((n) => n.id)).toEqual(['b']);
  });

  it('treats empty batches as no-ops', async () => {
    await store.saveMany([]);
    await store.hardDelete([]);
    expect(await store.loadAll()).toEqual([]);
  });

  it('clears everything', async () => {
    await store.saveMany([createNote(), createNote()]);
    await store.clear();
    expect(await store.loadAll()).toEqual([]);
  });
});

describe('local adapter persistence', () => {
  it('survives the connection being dropped, as it is on a reload', async () => {
    const store = await freshAdapter();
    await store.saveMany([createNote({ id: 'kept', title: 'Still here' })]);

    closeDb();
    const reopened = createLocalAdapter();
    const all = await reopened.loadAll();
    expect(all.map((n) => n.title)).toEqual(['Still here']);
  });
});
