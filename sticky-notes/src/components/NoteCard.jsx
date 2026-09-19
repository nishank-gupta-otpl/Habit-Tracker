import { memo } from 'react';
import { CheckIcon, GripIcon, PinIcon } from './icons.jsx';

const PREVIEW_ITEMS = 8;

function relative(ts) {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * One note on the board.
 *
 * The whole card is a button so a tap anywhere opens the editor — the most
 * common action should not require aiming. The pin, the grip and the checklist
 * boxes stop their events so they stay usable inside it.
 */
function NoteCard({ note, onOpen, onTogglePin, onToggleItem, gripProps, dragging, view }) {
  const items = note.items.slice(0, PREVIEW_ITEMS);
  const remaining = note.items.length - items.length;
  const done = note.items.filter((item) => item.done).length;

  return (
    <div
      data-note-id={note.id}
      className={`note-paper note-${note.color} relative w-full rounded-2xl text-left shadow-sm ring-1 ring-black/5 transition-shadow dark:ring-white/5 ${
        dragging ? 'dragging' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(note)}
        className="block w-full cursor-pointer px-3.5 pt-4 pb-3 text-left"
      >
        {note.title ? (
          <h3 className="pr-12 text-[15px] leading-snug font-bold break-words">{note.title}</h3>
        ) : null}

        {note.kind === 'text' && note.body ? (
          <p
            className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap"
            style={{ display: '-webkit-box', WebkitLineClamp: 12, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {note.body}
          </p>
        ) : null}

        {note.kind === 'list' ? (
          <ul className="mt-1.5 space-y-1.5">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <span
                  role="checkbox"
                  aria-checked={item.done}
                  aria-label={item.text || 'List item'}
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleItem(note, item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === ' ' || event.key === 'Enter') {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleItem(note, item.id);
                    }
                  }}
                  className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] border-current/40 ${
                    item.done ? 'bg-current/15' : ''
                  }`}
                >
                  {item.done ? <CheckIcon width={13} height={13} strokeWidth={3} /> : null}
                </span>
                <span className={`break-words ${item.done ? 'line-through opacity-55' : ''}`}>
                  {item.text}
                </span>
              </li>
            ))}
            {remaining > 0 ? (
              <li className="pl-[26px] text-xs opacity-65">+{remaining} more</li>
            ) : null}
          </ul>
        ) : null}

        {!note.title && !note.body && note.kind === 'text' ? (
          <p className="text-sm italic opacity-55">Empty note</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] opacity-70">
          {note.labels.map((label) => (
            <span key={label} className="rounded-full bg-black/8 px-2 py-0.5 dark:bg-white/10">
              {label}
            </span>
          ))}
          {note.kind === 'list' && note.items.length ? (
            <span>
              {done}/{note.items.length}
            </span>
          ) : null}
          <span className="ml-auto">{relative(note.updatedAt)}</span>
        </div>
      </button>

      {/* Controls sit above the card button rather than inside it, so a tap on
          one never also opens the editor. */}
      <div className="absolute top-2.5 right-1.5 flex items-center">
        {view === 'board' ? (
          <>
            <button
              type="button"
              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
              aria-pressed={note.pinned}
              onClick={() => onTogglePin(note.id)}
              className={`grid h-9 w-9 place-items-center rounded-full active:bg-black/10 dark:active:bg-white/10 ${
                note.pinned ? 'opacity-100' : 'opacity-45'
              }`}
            >
              <PinIcon width={18} height={18} filled={note.pinned} />
            </button>
            <span
              {...gripProps}
              role="button"
              tabIndex={-1}
              aria-label="Drag to reorder"
              className="grid h-9 w-6 cursor-grab place-items-center opacity-35 active:cursor-grabbing"
            >
              <GripIcon width={16} height={16} />
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default memo(NoteCard);
