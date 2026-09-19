// Export/import. The file is the user's escape hatch: it is what moves a board
// to a new phone today, and what recovers one if storage is ever cleared.
import { normalizeNote } from './notes.js';

export const BACKUP_VERSION = 1;

export function toBackup(notes, now = Date.now()) {
  return {
    app: 'sticky-notes',
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    notes: notes.map((note) => ({ ...note, syncedAt: null })),
  };
}

export function backupFilename(now = Date.now()) {
  const d = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `sticky-notes-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/**
 * Reads a backup file. Merges rather than replaces — importing the same file
 * twice is a no-op instead of a duplicated board — and keeps whichever copy of
 * a note was edited last.
 *
 * @returns {{notes: Note[], added: number, updated: number, skipped: number}}
 */
export function fromBackup(raw, existing = []) {
  const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const incoming = payload?.notes;
  if (!Array.isArray(incoming)) throw new Error('That file does not look like a notes backup.');

  const byId = new Map(existing.map((note) => [note.id, note]));
  const notes = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of incoming) {
    const note = normalizeNote(row);
    const current = byId.get(note.id);
    if (!current) {
      notes.push(note);
      added += 1;
    } else if (note.updatedAt > current.updatedAt) {
      notes.push(note);
      updated += 1;
    } else {
      skipped += 1;
    }
  }
  return { notes, added, updated, skipped };
}
