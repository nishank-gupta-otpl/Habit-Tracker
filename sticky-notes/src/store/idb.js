// A ~70-line promise wrapper over IndexedDB. A library would do this too, but
// the app only ever needs one object store with four operations, and keeping
// the dependency out means nothing to upgrade on a device that may not open
// the app for months.

const DB_NAME = 'sticky-notes';
const DB_VERSION = 1;
export const NOTES_STORE = 'notes';

let dbPromise = null;
let openConnection = null;

export function openDb(indexedDB = globalThis.indexedDB) {
  if (!indexedDB) return Promise.reject(new Error('IndexedDB is unavailable'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        openConnection = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      // Fires when another tab opens a newer schema version. Drop the handle so
      // the next call reopens rather than working against a stale connection.
      request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function run(db, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, mode);
    const store = tx.objectStore(NOTES_STORE);
    let result;
    try {
      result = work(store);
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export async function getAllRecords(db) {
  return run(db, 'readonly', (store) => {
    const request = store.getAll();
    const rows = [];
    request.onsuccess = () => rows.push(...request.result);
    return rows;
  });
}

export async function putRecords(db, records) {
  if (!records.length) return;
  await run(db, 'readwrite', (store) => {
    for (const record of records) store.put(record);
  });
}

export async function deleteRecords(db, ids) {
  if (!ids.length) return;
  await run(db, 'readwrite', (store) => {
    for (const id of ids) store.delete(id);
  });
}

export async function clearRecords(db) {
  await run(db, 'readwrite', (store) => store.clear());
}

/**
 * Closes the connection and forgets it, so the next call reopens.
 *
 * An open handle blocks `deleteDatabase` and any version upgrade indefinitely,
 * which is why this exists at all rather than leaving the connection to be
 * torn down with the page.
 */
export function closeDb() {
  openConnection?.close();
  openConnection = null;
  dbPromise = null;
}
