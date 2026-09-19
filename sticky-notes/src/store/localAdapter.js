import { normalizeNote } from '../lib/notes.js';
import {
  clearRecords,
  deleteRecords,
  getAllRecords,
  openDb,
  putRecords,
} from './idb.js';

/**
 * The on-device store. Implements the NotesStore contract in ./index.js
 * against IndexedDB, which is the only storage on Android that survives an app
 * restart, holds more than a few megabytes, and is not cleared by "clear
 * browsing data for the last hour" the way sessionStorage is.
 */
export function createLocalAdapter(indexedDB = globalThis.indexedDB) {
  const db = () => openDb(indexedDB);
  return {
    name: 'local',
    async loadAll() {
      const rows = await getAllRecords(await db());
      return rows.map((row) => normalizeNote(row));
    },
    async saveMany(notes) {
      await putRecords(await db(), notes.map((note) => normalizeNote(note)));
    },
    async hardDelete(ids) {
      await deleteRecords(await db(), ids);
    },
    async clear() {
      await clearRecords(await db());
    },
  };
}

/**
 * Fallback used when IndexedDB throws — Android Chrome in private mode, or a
 * WebView with storage disabled. Notes are kept for the session so the app
 * still works; the UI warns that they will not survive a restart.
 */
export function createMemoryAdapter(seed = []) {
  const rows = new Map(seed.map((note) => [note.id, normalizeNote(note)]));
  return {
    name: 'memory',
    async loadAll() {
      return [...rows.values()];
    },
    async saveMany(notes) {
      for (const note of notes) rows.set(note.id, normalizeNote(note));
    },
    async hardDelete(ids) {
      for (const id of ids) rows.delete(id);
    },
    async clear() {
      rows.clear();
    },
  };
}
