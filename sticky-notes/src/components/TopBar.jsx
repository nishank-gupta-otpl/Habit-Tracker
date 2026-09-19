import { useEffect, useRef } from 'react';
import { ArchiveIcon, CloseIcon, MoreIcon, NoteIcon, SearchIcon, TrashIcon } from './icons.jsx';

const VIEW_META = {
  board: { label: 'Notes', Icon: NoteIcon },
  archive: { label: 'Archive', Icon: ArchiveIcon },
  trash: { label: 'Bin', Icon: TrashIcon },
};

/**
 * Search, the view switcher and the menu button, pinned to the top of the
 * screen. Sticky rather than fixed so it scrolls with the safe-area padding
 * intact on phones with a notch.
 */
export default function TopBar({ view, onViewChange, query, onQueryChange, onOpenMenu, count }) {
  const inputRef = useRef(null);
  const meta = VIEW_META[view];

  // Keyboard shortcut for the desktop/tablet case; harmless on a phone.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 bg-[var(--surface)]/92 px-3 pb-2 backdrop-blur"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-[var(--surface-raised)] px-3 py-2 ring-1 ring-[var(--surface-line)]">
          <SearchIcon width={20} height={20} className="shrink-0 opacity-45" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={`Search ${meta.label.toLowerCase()}`}
            aria-label={`Search ${meta.label.toLowerCase()}`}
            className="min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="grid h-7 w-7 place-items-center rounded-full opacity-55"
            >
              <CloseIcon width={16} height={16} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Menu"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 ring-[var(--surface-line)]"
        >
          <MoreIcon />
        </button>
      </div>

      <nav aria-label="Views" className="mt-2 flex items-center gap-1.5">
        {Object.entries(VIEW_META).map(([key, { label, Icon }]) => (
          <button
            key={key}
            type="button"
            onClick={() => onViewChange(key)}
            aria-current={view === key ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
              view === key
                ? 'bg-[var(--text)] text-[var(--surface)]'
                : 'text-[var(--text-soft)] ring-1 ring-[var(--surface-line)]'
            }`}
          >
            <Icon width={16} height={16} />
            {label}
            {view === key && count ? <span className="opacity-70">{count}</span> : null}
          </button>
        ))}
      </nav>
    </header>
  );
}
