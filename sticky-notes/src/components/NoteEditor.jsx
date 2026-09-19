import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { newId } from '../lib/id.js';
import { isBlank } from '../lib/notes.js';
import ColorPicker from './ColorPicker.jsx';
import Sheet from './Sheet.jsx';
import {
  ArchiveIcon,
  CheckIcon,
  CloseIcon,
  ListIcon,
  NoteIcon,
  PaletteIcon,
  PinIcon,
  TagIcon,
  TrashIcon,
} from './icons.jsx';

/**
 * The editor. Opens over the board, saves continuously, and closes on back.
 *
 * There is no Save button on purpose: on a phone the note is the thing being
 * held, and an unsaved draft lost to a notification or a swipe-away is the one
 * failure a notes app cannot afford. The draft is committed on every change
 * and again when the app is backgrounded.
 */
export default function NoteEditor({ note, onSave, onClose, onDelete, onArchive, labels }) {
  const [draft, setDraft] = useState(note);
  const [panel, setPanel] = useState(null); // 'color' | 'labels'
  const [labelText, setLabelText] = useState('');
  const bodyRef = useRef(null);

  /**
   * The draft is mirrored in a ref because it is edited faster than it is
   * rendered. Reading `draft` from a handler gives whatever the last render
   * saw, which on a phone keyboard is one or two keystrokes behind — enough to
   * drop and reorder characters. The ref is always current.
   */
  const draftRef = useRef(note);

  // Same reason, other direction: the save callback changes identity on every
  // keystroke (it closes over the note list), so holding it in a ref keeps
  // `commit` and the flush listener below stable.
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  // Set when the editor closes because the note was archived or binned. Those
  // paths save first and then change where the note lives, so the flush below
  // would only write the content back over that.
  const handedOff = useRef(false);

  /** Applies an edit to the draft and saves it. */
  const commit = useCallback((changes) => {
    const next = { ...draftRef.current, ...changes };
    draftRef.current = next;
    setDraft(next);
    // Deliberately outside the state updater: React may run an updater twice,
    // and a save is a side effect that must happen exactly once.
    saveRef.current(next);
  }, []);

  /** Same, for edits that need to read the current draft first. */
  const commitFrom = useCallback((fn) => commit(fn(draftRef.current)), [commit]);

  // Android kills backgrounded tabs freely; flush before that can happen, and
  // once more when the editor closes.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') saveRef.current(draftRef.current);
    };
    document.addEventListener('visibilitychange', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      if (!handedOff.current) saveRef.current(draftRef.current);
    };
  }, []);

  // A new, empty note should land with the cursor already in the body.
  useEffect(() => {
    if (isBlank(note) && note.kind === 'text') bodyRef.current?.focus();
  }, [note]);

  const close = () => onClose(draftRef.current);

  const setItem = (id, changes) =>
    commitFrom((current) => ({
      items: current.items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));

  const addItem = (afterId = null) => {
    const item = { id: newId(), text: '', done: false };
    // flushSync, because the new row has to be in the DOM before it can take
    // focus and every keystroke until then lands in the row above. Waiting a
    // frame instead loses the first characters of a fast-typed item.
    flushSync(() =>
      commitFrom((current) => {
        const items = [...current.items];
        const at = afterId ? items.findIndex((i) => i.id === afterId) + 1 : items.length;
        items.splice(at, 0, item);
        return { items };
      }),
    );
    document.getElementById(`item-${item.id}`)?.focus();
  };

  const removeItem = (id) =>
    commitFrom((current) => ({ items: current.items.filter((item) => item.id !== id) }));

  /** Switching kind carries the content across rather than discarding it. */
  const toKind = (kind) => {
    const current = draftRef.current;
    if (kind === current.kind) return;
    if (kind === 'list') {
      const items = current.body
        .split('\n')
        .map((line) => line.replace(/^\s*[-*[\]x ]+/i, '').trim())
        .filter(Boolean)
        .map((text) => ({ id: newId(), text, done: false }));
      commit({ kind: 'list', items, body: '' });
    } else {
      commit({ kind: 'text', body: current.items.map((item) => item.text).join('\n'), items: [] });
    }
  };

  const addLabel = (event) => {
    event.preventDefault();
    const label = labelText.trim();
    if (!label) return;
    commitFrom((current) => ({ labels: [...current.labels, label] }));
    setLabelText('');
  };

  const suggestions = labels
    .map((l) => l.label)
    .filter((label) => !draft.labels.some((l) => l.toLowerCase() === label.toLowerCase()))
    .slice(0, 8);

  return (
    <Sheet open onClose={close} labelledBy="editor-title">
      <header className="flex items-center gap-1 px-1.5 py-1.5">
        <button
          type="button"
          onClick={close}
          aria-label="Close note"
          className="grid h-11 w-11 place-items-center rounded-full active:bg-black/8 dark:active:bg-white/10"
        >
          <CloseIcon />
        </button>
        <span id="editor-title" className="sr-only">
          Edit note
        </span>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => toKind(draft.kind === 'list' ? 'text' : 'list')}
            aria-label={draft.kind === 'list' ? 'Convert to text note' : 'Convert to checklist'}
            className="grid h-11 w-11 place-items-center rounded-full active:bg-black/8 dark:active:bg-white/10"
          >
            {draft.kind === 'list' ? <NoteIcon /> : <ListIcon />}
          </button>
          <button
            type="button"
            onClick={() => commit({ pinned: !draft.pinned })}
            aria-label={draft.pinned ? 'Unpin note' : 'Pin note'}
            aria-pressed={draft.pinned}
            className={`grid h-11 w-11 place-items-center rounded-full active:bg-black/8 dark:active:bg-white/10 ${
              draft.pinned ? '' : 'opacity-55'
            }`}
          >
            <PinIcon filled={draft.pinned} />
          </button>
        </div>
      </header>

      <div className={`note-paper note-${draft.color} mx-3 flex-1 overflow-y-auto rounded-2xl px-4 pt-4 pb-24`}>
        <input
          value={draft.title}
          onChange={(event) => commit({ title: event.target.value })}
          placeholder="Title"
          aria-label="Note title"
          className="w-full bg-transparent text-lg font-bold placeholder:opacity-45 focus:outline-none"
        />

        {draft.kind === 'text' ? (
          <textarea
            ref={bodyRef}
            value={draft.body}
            onChange={(event) => commit({ body: event.target.value })}
            placeholder="Write something…"
            aria-label="Note text"
            rows={8}
            className="autogrow mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed placeholder:opacity-45 focus:outline-none"
          />
        ) : (
          <ul className="mt-3 space-y-1">
            {draft.items.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  aria-label={item.text || 'List item'}
                  onClick={() => setItem(item.id, { done: !item.done })}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-[1.5px] border-current/40 ${
                    item.done ? 'bg-current/15' : ''
                  }`}
                >
                  {item.done ? <CheckIcon width={15} height={15} strokeWidth={3} /> : null}
                </button>
                <input
                  id={`item-${item.id}`}
                  value={item.text}
                  onChange={(event) => setItem(item.id, { text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addItem(item.id);
                    }
                    // Backspace on an empty row deletes it, the way every
                    // list editor on a phone behaves.
                    if (event.key === 'Backspace' && !item.text) {
                      event.preventDefault();
                      removeItem(item.id);
                    }
                  }}
                  className={`min-w-0 flex-1 bg-transparent py-1.5 text-[15px] focus:outline-none ${
                    item.done ? 'line-through opacity-55' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remove item"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full opacity-45"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => addItem()}
                className="flex items-center gap-2 py-2 text-[15px] opacity-60"
              >
                <span className="grid h-6 w-6 place-items-center">+</span> Add item
              </button>
            </li>
          </ul>
        )}

        {draft.labels.length ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {draft.labels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  commitFrom((current) => ({
                    labels: current.labels.filter((l) => l.toLowerCase() !== label.toLowerCase()),
                  }))
                }
                className="flex items-center gap-1 rounded-full bg-black/8 px-2.5 py-1 text-xs dark:bg-white/10"
              >
                {label}
                <CloseIcon width={12} height={12} />
                <span className="sr-only">Remove label</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {panel === 'color' ? (
        <div className="mx-3 mt-2 rounded-2xl bg-[var(--surface-raised)] p-3 ring-1 ring-[var(--surface-line)]">
          <ColorPicker value={draft.color} onChange={(color) => commit({ color })} />
        </div>
      ) : null}

      {panel === 'labels' ? (
        <div className="mx-3 mt-2 rounded-2xl bg-[var(--surface-raised)] p-3 ring-1 ring-[var(--surface-line)]">
          <form onSubmit={addLabel} className="flex gap-2">
            <input
              value={labelText}
              onChange={(event) => setLabelText(event.target.value)}
              placeholder="Add a label"
              aria-label="Add a label"
              maxLength={40}
              className="min-w-0 flex-1 rounded-xl bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none"
            />
            <button type="submit" className="rounded-xl bg-[var(--text)] px-3 py-2 text-sm font-semibold text-[var(--surface)]">
              Add
            </button>
          </form>
          {suggestions.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => commitFrom((current) => ({ labels: [...current.labels, label] }))}
                  className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="flex items-center gap-1 px-2 py-2">
        <button
          type="button"
          onClick={() => setPanel(panel === 'color' ? null : 'color')}
          aria-label="Change colour"
          aria-pressed={panel === 'color'}
          className="grid h-11 w-11 place-items-center rounded-full active:bg-black/8 dark:active:bg-white/10"
        >
          <PaletteIcon />
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === 'labels' ? null : 'labels')}
          aria-label="Labels"
          aria-pressed={panel === 'labels'}
          className="grid h-11 w-11 place-items-center rounded-full active:bg-black/8 dark:active:bg-white/10"
        >
          <TagIcon />
        </button>
        <button
          type="button"
          onClick={() => {
            handedOff.current = true;
            onArchive(draftRef.current);
          }}
          aria-label="Archive note"
          className="grid h-11 w-11 place-items-center rounded-full active:bg-black/8 dark:active:bg-white/10"
        >
          <ArchiveIcon />
        </button>
        <button
          type="button"
          onClick={() => {
            handedOff.current = true;
            onDelete(draftRef.current);
          }}
          aria-label="Move note to bin"
          className="grid h-11 w-11 place-items-center rounded-full active:bg-black/8 dark:active:bg-white/10"
        >
          <TrashIcon />
        </button>
        <span className="ml-auto pr-2 text-xs opacity-55">Saved</span>
      </footer>
    </Sheet>
  );
}
