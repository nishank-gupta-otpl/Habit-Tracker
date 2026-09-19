import { describe, expect, it } from 'vitest';
import { BACKUP_VERSION, backupFilename, fromBackup, toBackup } from './backup.js';
import { createNote } from './notes.js';

describe('toBackup', () => {
  it('wraps the notes with enough metadata to identify the file later', () => {
    const backup = toBackup([createNote({ id: 'a' })], Date.UTC(2026, 0, 2, 3, 4));
    expect(backup.app).toBe('sticky-notes');
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe('2026-01-02T03:04:00.000Z');
    expect(backup.notes).toHaveLength(1);
  });

  it('clears syncedAt so an imported note is treated as needing a push', () => {
    const backup = toBackup([createNote({ id: 'a', syncedAt: 500 })]);
    expect(backup.notes[0].syncedAt).toBeNull();
  });
});

describe('backupFilename', () => {
  it('is dated, so successive exports do not overwrite each other', () => {
    expect(backupFilename(new Date(2026, 8, 5).getTime())).toBe('sticky-notes-2026-09-05.json');
  });
});

describe('fromBackup', () => {
  const existing = [createNote({ id: 'a', title: 'Local', updatedAt: 100 })];

  it('reads a backup written by toBackup', () => {
    const json = JSON.stringify(toBackup([createNote({ id: 'b', title: 'From phone' })]));
    const result = fromBackup(json, existing);
    expect(result.added).toBe(1);
    expect(result.notes[0].title).toBe('From phone');
  });

  it('is a no-op when the same file is imported twice', () => {
    const json = JSON.stringify(toBackup(existing));
    const result = fromBackup(json, existing);
    expect(result).toMatchObject({ added: 0, updated: 0, skipped: 1 });
    expect(result.notes).toEqual([]);
  });

  it('keeps whichever copy of a note was edited last', () => {
    const newer = JSON.stringify(toBackup([createNote({ id: 'a', title: 'Newer', updatedAt: 900 })]));
    expect(fromBackup(newer, existing).notes[0].title).toBe('Newer');

    const older = JSON.stringify(toBackup([createNote({ id: 'a', title: 'Older', updatedAt: 5 })]));
    expect(fromBackup(older, existing)).toMatchObject({ updated: 0, skipped: 1 });
  });

  it('accepts a parsed object as well as a string', () => {
    expect(fromBackup(toBackup([createNote({ id: 'c' })]), []).added).toBe(1);
  });

  it('refuses a file that is not a backup', () => {
    expect(() => fromBackup('{"hello":true}', [])).toThrow(/does not look like/);
    expect(() => fromBackup('not json', [])).toThrow();
  });

  it('repairs damaged notes instead of rejecting the whole file', () => {
    const result = fromBackup({ notes: [{ id: 'x', title: 'Ok', color: 'nope' }] }, []);
    expect(result.notes[0].color).toBe('butter');
  });
});
