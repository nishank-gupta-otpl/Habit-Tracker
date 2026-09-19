import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyContent,
  createNote,
  expiredTrash,
  normalizeNote,
  reorder as reorderNotes,
  touchNote,
} from '../lib/notes.js';
import { createNotesStore } from '../store/index.js';

const NotesContext = createContext(null);

/**
 * Holds every note in memory and writes changes straight through to storage.
 *
 * A personal board is small — a few hundred notes at most — so keeping the lot
 * in state buys instant search, filtering and drag reordering with no query
 * layer. Writes go to IndexedDB in the background; the UI never waits on them,
 * which is what makes the app feel native on a mid-range phone.
 */
export function NotesProvider({ children, storeFactory = createNotesStore }) {
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [durable, setDurable] = useState(true);
  const [undoable, setUndoable] = useState(null);
  const storeRef = useRef(null);
  /**
   * The notes as of the last write, not the last render.
   *
   * Several mutations can run in one tick — saving the open note, then
   * archiving it — and each must see the one before it. React state is a
   * render behind, so reading it there would make the second write silently
   * discard the first.
   */
  const notesRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { store, durable: isDurable } = await storeFactory();
        if (cancelled) return;
        storeRef.current = store;
        const loaded = await store.loadAll();
        if (cancelled) return;

        // Take out the bin on the way in, so an old phone that has not been
        // opened in months does not carry deleted notes around forever.
        const stale = expiredTrash(loaded);
        if (stale.length) await store.hardDelete(stale);
        const staleIds = new Set(stale);

        notesRef.current = loaded.filter((note) => !staleIds.has(note.id));
        setNotes(notesRef.current);
        setDurable(isDurable);
        setStatus('ready');
      } catch (error) {
        console.error('Could not open the notes store.', error);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeFactory]);

  /** Applies changed notes to state and persists them. */
  const persist = useCallback((changed) => {
    if (!changed.length) return;
    const byId = new Map(notesRef.current.map((note) => [note.id, note]));
    for (const note of changed) byId.set(note.id, note);
    notesRef.current = [...byId.values()];
    setNotes(notesRef.current);
    storeRef.current?.saveMany(changed).catch((error) => {
      console.error('Could not save notes.', error);
    });
  }, []);

  const forget = useCallback((ids) => {
    if (!ids.length) return;
    const gone = new Set(ids);
    notesRef.current = notesRef.current.filter((note) => !gone.has(note.id));
    setNotes(notesRef.current);
    storeRef.current?.hardDelete(ids).catch((error) => {
      console.error('Could not delete notes.', error);
    });
  }, []);

  /**
   * Records what a destructive action replaced so the toast can put it back.
   * Undo restores the exact previous note objects rather than reversing the
   * action, which keeps it correct even for edits made in between.
   */
  const remember = useCallback((message, before) => {
    setUndoable({ message, before, at: Date.now() });
  }, []);

  const undo = useCallback(() => {
    setUndoable((current) => {
      if (current) persist(current.before);
      return null;
    });
  }, [persist]);

  const dismissUndo = useCallback(() => setUndoable(null), []);

  const value = useMemo(() => {
    const byId = (id) => notesRef.current.find((note) => note.id === id);

    const patch = (id, changes) => {
      const note = byId(id);
      if (!note) return null;
      const next = touchNote(note, changes);
      persist([next]);
      return next;
    };

    return {
      notes,
      status,
      durable,
      undoable,
      undo,
      dismissUndo,

      /**
       * Saves what the editor owns — the content — onto the note as it stands
       * now. Board state (position in the order, archived, deleted) is left
       * alone, so a save that lands after the note was archived cannot drag it
       * back onto the board.
       */
      saveNote(note) {
        const existing = byId(note.id);
        const base =
          existing ??
          normalizeNote({
            ...note,
            // A new note goes to the top of the board.
            order: Math.max(Date.now(), ...notesRef.current.map((n) => n.order + 1)),
          });
        const next = applyContent(base, note);
        persist([next]);
        return next;
      },

      draft(partial) {
        return createNote(partial);
      },

      update: patch,
      togglePin: (id) => patch(id, { pinned: !byId(id)?.pinned }),
      setColor: (id, color) => patch(id, { color }),

      addLabel(id, label) {
        const note = byId(id);
        if (!note) return;
        patch(id, { labels: [...note.labels, label] });
      },

      removeLabel(id, label) {
        const note = byId(id);
        if (!note) return;
        const key = label.toLowerCase();
        patch(id, { labels: note.labels.filter((l) => l.toLowerCase() !== key) });
      },

      /** Renames a label everywhere it is used. */
      renameLabel(from, to) {
        const key = from.toLowerCase();
        const changed = notesRef.current
          .filter((note) => note.labels.some((l) => l.toLowerCase() === key))
          .map((note) =>
            touchNote(note, { labels: note.labels.map((l) => (l.toLowerCase() === key ? to : l)) }),
          );
        persist(changed);
      },

      archive(id) {
        const note = byId(id);
        if (!note) return;
        remember('Note archived', [note]);
        patch(id, { archivedAt: Date.now(), pinned: false });
      },

      unarchive(id) {
        const note = byId(id);
        if (!note) return;
        remember('Note restored', [note]);
        patch(id, { archivedAt: null });
      },

      /** Soft delete: the note moves to the bin and can be brought back. */
      remove(id) {
        const note = byId(id);
        if (!note) return;
        remember('Note moved to bin', [note]);
        patch(id, { deletedAt: Date.now(), pinned: false });
      },

      restore(id) {
        const note = byId(id);
        if (!note) return;
        remember('Note restored', [note]);
        patch(id, { deletedAt: null, archivedAt: null });
      },

      /** Irreversible, so it is never offered without a confirmation. */
      destroy(id) {
        forget([id]);
      },

      emptyTrash() {
        forget(notesRef.current.filter((note) => note.deletedAt).map((note) => note.id));
      },

      /** Moves the dragged note into the slot held by `overId`. */
      reorder(ordered, id, overId) {
        persist(reorderNotes(ordered, id, overId));
      },

      /** Merges imported notes in. Returns the import summary for the toast. */
      importNotes(incoming) {
        persist(incoming);
      },
    };
  }, [notes, status, durable, undoable, undo, dismissUndo, persist, forget, remember]);

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const value = useContext(NotesContext);
  if (!value) throw new Error('useNotes must be used inside <NotesProvider>');
  return value;
}
