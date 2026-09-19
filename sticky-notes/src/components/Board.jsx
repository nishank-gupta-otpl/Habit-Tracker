import { useCallback } from 'react';
import { useDragSort } from '../hooks/useDragSort.js';
import NoteCard from './NoteCard.jsx';
import { RestoreIcon, TrashIcon } from './icons.jsx';

/**
 * The masonry board. Sorting and filtering happen upstream; this decides only
 * how notes are laid out and which per-view actions hang off each card.
 */
export default function Board({
  notes,
  view,
  onOpen,
  onTogglePin,
  onToggleItem,
  onReorder,
  onRestore,
  onDestroy,
}) {
  const handleMove = useCallback(
    (id, overId) => onReorder(notes, id, overId),
    [notes, onReorder],
  );
  const { draggingId, gripProps } = useDragSort(handleMove);

  return (
    <div className="masonry columns-2 sm:columns-3 lg:columns-4 xl:columns-5">
      {notes.map((note) => (
        <div key={note.id}>
          <NoteCard
            note={note}
            view={view}
            dragging={draggingId === note.id}
            gripProps={gripProps(note.id)}
            onOpen={onOpen}
            onTogglePin={onTogglePin}
            onToggleItem={onToggleItem}
          />
          {view !== 'board' ? (
            <div className="mt-1 flex justify-end gap-1">
              <button
                type="button"
                onClick={() => onRestore(note.id)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--text-soft)] ring-1 ring-[var(--surface-line)]"
              >
                <RestoreIcon width={14} height={14} />
                {view === 'trash' ? 'Restore' : 'Unarchive'}
              </button>
              {view === 'trash' ? (
                <button
                  type="button"
                  onClick={() => onDestroy(note.id)}
                  aria-label="Delete for ever"
                  className="grid h-7 w-7 place-items-center rounded-full text-[#b3261e] ring-1 ring-[var(--surface-line)]"
                >
                  <TrashIcon width={14} height={14} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
