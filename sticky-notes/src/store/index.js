import { createLocalAdapter, createMemoryAdapter } from './localAdapter.js';

/**
 * The storage contract the app is written against.
 *
 * Everything above this line works with plain note objects and never knows
 * where they live, which is the seam that lets cloud sync arrive later without
 * touching a single component:
 *
 *   loadAll()            -> Promise<Note[]>   including soft-deleted tombstones
 *   saveMany(notes)      -> Promise<void>     insert or replace, by id
 *   hardDelete(ids)      -> Promise<void>     remove for good (bin purge only)
 *   clear()              -> Promise<void>
 *
 * A future remote adapter implements the same four methods and is composed
 * with the local one — local stays the source of truth for reads so the app
 * opens instantly offline, while the remote adapter pushes notes whose
 * `syncedAt` is behind their `updatedAt` and merges what comes back with
 * `mergeNote` from lib/notes.js. Notes already carry every field that needs:
 * stable device-generated ids, `updatedAt`, `syncedAt` and `deletedAt`
 * tombstones.
 *
 * @typedef {object} NotesStore
 * @property {string} name
 * @property {() => Promise<import('../lib/notes.js').Note[]>} loadAll
 * @property {(notes: import('../lib/notes.js').Note[]) => Promise<void>} saveMany
 * @property {(ids: string[]) => Promise<void>} hardDelete
 * @property {() => Promise<void>} clear
 */

/**
 * Picks the best storage this device actually allows. Probing with a real read
 * is the only reliable test: Android Chrome exposes `window.indexedDB` in
 * private mode and then fails when the database is opened.
 *
 * @returns {Promise<{store: NotesStore, durable: boolean}>}
 */
export async function createNotesStore() {
  const local = createLocalAdapter();
  try {
    await local.loadAll();
    return { store: local, durable: true };
  } catch (error) {
    console.warn('Falling back to in-memory notes: IndexedDB is unavailable.', error);
    return { store: createMemoryAdapter(), durable: false };
  }
}

export { createLocalAdapter, createMemoryAdapter };
