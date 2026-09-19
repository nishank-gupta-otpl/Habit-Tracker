import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotes } from './context/NotesContext.jsx';
import { useTheme } from './hooks/useTheme.js';
import { allLabels, createNote, isBlank, selectNotes } from './lib/notes.js';
import { backupFilename, fromBackup, toBackup } from './lib/backup.js';
import Board from './components/Board.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import EmptyState from './components/EmptyState.jsx';
import LabelBar from './components/LabelBar.jsx';
import MenuSheet from './components/MenuSheet.jsx';
import NoteEditor from './components/NoteEditor.jsx';
import Toast from './components/Toast.jsx';
import TopBar from './components/TopBar.jsx';
import { ListIcon, PlusIcon } from './components/icons.jsx';

/**
 * Reads the launch URL once.
 *
 * Android can open the app three ways beyond a plain tap: a manifest shortcut
 * from the long-press menu (?new=note|list), and the system share sheet, which
 * posts the shared text to ?share_text=… via the manifest's share_target. Both
 * land as a pre-filled editor.
 */
function launchIntent() {
  const params = new URLSearchParams(window.location.search);
  const shared = ['share_text', 'share_title', 'share_url']
    .map((key) => params.get(key))
    .filter(Boolean);
  if (shared.length) {
    return {
      kind: 'text',
      title: params.get('share_title') ?? '',
      body: [params.get('share_text'), params.get('share_url')].filter(Boolean).join('\n'),
    };
  }
  const create = params.get('new');
  if (create === 'note') return { kind: 'text' };
  if (create === 'list') return { kind: 'list' };
  return null;
}

export default function App() {
  const notes = useNotes();
  const [theme, setTheme] = useTheme();
  const [view, setView] = useState('board');
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState(null);
  // A share or shortcut launch opens its note on the very first render, so
  // the board never flashes up behind it.
  const [editing, setEditing] = useState(() => {
    const intent = launchIntent();
    return intent ? createNote(intent) : null;
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [notice, setNotice] = useState(null);

  const labels = useMemo(() => allLabels(notes.notes), [notes.notes]);
  // A filter on a label whose last note was just deleted would leave the board
  // empty with no chip left to switch it off, so it lapses on its own.
  const activeLabel = useMemo(
    () => (labels.some((l) => l.label.toLowerCase() === label?.toLowerCase()) ? label : null),
    [label, labels],
  );
  const visible = useMemo(
    () => selectNotes(notes.notes, { view, query, label: activeLabel }),
    [notes.notes, view, query, activeLabel],
  );
  const counts = useMemo(
    () => ({
      board: notes.notes.filter((n) => !n.deletedAt && !n.archivedAt).length,
      archive: notes.notes.filter((n) => !n.deletedAt && n.archivedAt).length,
      trash: notes.notes.filter((n) => n.deletedAt).length,
    }),
    [notes.notes],
  );

  const compose = useCallback(
    (partial) => setEditing(notes.draft(partial)),
    [notes],
  );

  // Drop the share/shortcut parameters once they have been consumed, so a
  // reload does not open a second empty note.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Nothing empty is ever written, so an untouched new note leaves no trace.
  const saveDraft = useCallback(
    (draft) => {
      if (!isBlank(draft)) notes.saveNote(draft);
    },
    [notes],
  );

  /**
   * Closing decides what happens to a note the user emptied out.
   *
   * A note that was already on the board goes to the bin, so an accidental
   * select-all-delete is one Undo away. A note that started empty — a new one
   * the user thought better of — is dropped for good, because putting blank
   * notes in the bin is just moving the litter.
   */
  const closeEditor = useCallback(
    (draft) => {
      if (isBlank(draft) && notes.notes.some((n) => n.id === draft.id)) {
        if (isBlank(editing)) notes.destroy(draft.id);
        else notes.remove(draft.id);
      }
      setEditing(null);
    },
    [notes, editing],
  );

  const toggleItem = useCallback(
    (note, itemId) => {
      notes.update(note.id, {
        items: note.items.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item,
        ),
      });
    },
    [notes],
  );

  const exportNotes = useCallback(() => {
    const payload = JSON.stringify(toBackup(notes.notes), null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFilename();
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${notes.notes.length} notes`);
  }, [notes.notes]);

  const importNotes = useCallback(
    async (file) => {
      try {
        const { notes: incoming, added, updated, skipped } = fromBackup(
          await file.text(),
          notes.notes,
        );
        notes.importNotes(incoming);
        setMenuOpen(false);
        setNotice(
          `Imported ${added} new, updated ${updated}${skipped ? `, ${skipped} already up to date` : ''}`,
        );
      } catch (error) {
        console.error('Import failed.', error);
        setNotice(error instanceof Error ? error.message : 'That file could not be read.');
      }
    },
    [notes],
  );

  if (notes.status === 'loading') {
    return <div className="grid h-full place-items-center text-sm opacity-60">Opening your notes…</div>;
  }

  if (notes.status === 'error') {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div>
          <h1 className="text-base font-bold">Storage is unavailable</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            The app could not open its database. This usually means the browser is blocking storage
            for this site — check your site settings and reload.
          </p>
        </div>
      </div>
    );
  }

  const searching = Boolean(query.trim() || activeLabel);

  return (
    <div className="min-h-full">
      <TopBar
        view={view}
        onViewChange={(next) => {
          setView(next);
          setQuery('');
        }}
        query={query}
        onQueryChange={setQuery}
        onOpenMenu={() => setMenuOpen(true)}
        count={counts[view]}
      />

      <main className="px-3 pb-28">
        {view === 'board' ? (
          <LabelBar labels={labels} active={activeLabel} onChange={setLabel} />
        ) : null}

        {visible.length ? (
          <Board
            notes={visible}
            view={view}
            onOpen={setEditing}
            onTogglePin={notes.togglePin}
            onToggleItem={toggleItem}
            onReorder={notes.reorder}
            onRestore={view === 'trash' ? notes.restore : notes.unarchive}
            onDestroy={notes.destroy}
          />
        ) : (
          <EmptyState kind={searching ? 'search' : view} />
        )}
      </main>

      {view === 'board' ? (
        <div
          className="fixed right-4 bottom-0 z-30 flex flex-col items-end gap-2.5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
          <button
            type="button"
            onClick={() => compose({ kind: 'list' })}
            aria-label="New checklist"
            className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-raised)] shadow-md ring-1 ring-[var(--surface-line)]"
          >
            <ListIcon width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={() => compose({ kind: 'text' })}
            aria-label="New note"
            className="note-paper note-butter grid h-16 w-16 place-items-center rounded-2xl shadow-lg ring-1 ring-black/10"
          >
            <PlusIcon width={28} height={28} strokeWidth={2.2} />
          </button>
        </div>
      ) : null}

      {editing ? (
        <NoteEditor
          key={editing.id}
          note={editing}
          labels={labels}
          onSave={saveDraft}
          onClose={closeEditor}
          onArchive={(draft) => {
            saveDraft(draft);
            notes.archive(draft.id);
            setEditing(null);
          }}
          onDelete={(draft) => {
            saveDraft(draft);
            notes.remove(draft.id);
            setEditing(null);
          }}
        />
      ) : null}

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        onExport={exportNotes}
        onImport={importNotes}
        onEmptyTrash={() => setConfirmEmpty(true)}
        counts={counts}
        durable={notes.durable}
      />

      <ConfirmDialog
        open={confirmEmpty}
        title="Empty the bin?"
        body={`${counts.trash} ${counts.trash === 1 ? 'note' : 'notes'} will be deleted for good. This cannot be undone.`}
        confirmLabel="Delete for ever"
        onCancel={() => setConfirmEmpty(false)}
        onConfirm={() => {
          notes.emptyTrash();
          setConfirmEmpty(false);
          setMenuOpen(false);
        }}
      />

      {/* Undo takes priority over plain notices — it is the one that expires. */}
      {notes.undoable ? (
        <Toast
          message={notes.undoable.message}
          actionLabel="Undo"
          onAction={notes.undo}
          onDismiss={notes.dismissUndo}
        />
      ) : (
        <Toast message={notice} onDismiss={() => setNotice(null)} timeout={4000} />
      )}
    </div>
  );
}
