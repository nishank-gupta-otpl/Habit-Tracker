import { useRef } from 'react';
import { THEMES } from '../hooks/useTheme.js';
import Sheet from './Sheet.jsx';
import { CloseIcon, DownloadIcon, MoonIcon, SunIcon, TrashIcon, UploadIcon } from './icons.jsx';

const THEME_META = {
  system: { label: 'System', Icon: SunIcon },
  light: { label: 'Light', Icon: SunIcon },
  dark: { label: 'Dark', Icon: MoonIcon },
};

/** Settings, backup and the bin controls. */
export default function MenuSheet({
  open,
  onClose,
  theme,
  onThemeChange,
  onExport,
  onImport,
  onEmptyTrash,
  counts,
  durable,
}) {
  const fileRef = useRef(null);

  if (!open) return null;

  return (
    <Sheet open onClose={onClose} labelledBy="menu-title">
      <header className="flex items-center gap-2 px-1.5 py-1.5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="grid h-11 w-11 place-items-center rounded-full active:bg-black/8 dark:active:bg-white/10"
        >
          <CloseIcon />
        </button>
        <h2 id="menu-title" className="text-base font-bold">
          Settings
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {!durable ? (
          <p className="mb-4 rounded-xl bg-[#b3261e]/12 p-3 text-sm text-[#b3261e]">
            This browser will not let the app store anything, so notes will be lost when you close
            it. Private/incognito mode is the usual cause. Export a backup before you leave.
          </p>
        ) : null}

        <section>
          <h3 className="text-xs font-bold tracking-wide uppercase opacity-55">Appearance</h3>
          <div className="mt-2 flex gap-1.5">
            {THEMES.map((key) => {
              const { label, Icon } = THEME_META[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onThemeChange(key)}
                  aria-pressed={theme === key}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold ${
                    theme === key
                      ? 'bg-[var(--text)] text-[var(--surface)]'
                      : 'ring-1 ring-[var(--surface-line)]'
                  }`}
                >
                  <Icon width={16} height={16} />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-7">
          <h3 className="text-xs font-bold tracking-wide uppercase opacity-55">Your notes</h3>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            {counts.board} on the board · {counts.archive} archived · {counts.trash} in the bin
          </p>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            Everything is stored on this phone only. Nothing is uploaded anywhere, and the app works
            with no signal.
          </p>
        </section>

        <section className="mt-7">
          <h3 className="text-xs font-bold tracking-wide uppercase opacity-55">Backup</h3>
          <div className="mt-2 space-y-1.5">
            <button
              type="button"
              onClick={onExport}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ring-1 ring-[var(--surface-line)]"
            >
              <DownloadIcon width={20} height={20} />
              <span>
                <span className="font-semibold">Export notes</span>
                <span className="block text-xs text-[var(--text-soft)]">
                  Saves a JSON file to your downloads
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ring-1 ring-[var(--surface-line)]"
            >
              <UploadIcon width={20} height={20} />
              <span>
                <span className="font-semibold">Import notes</span>
                <span className="block text-xs text-[var(--text-soft)]">
                  Merges a backup in — existing notes are kept
                </span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) onImport(file);
              }}
            />
          </div>
        </section>

        {counts.trash ? (
          <section className="mt-7">
            <h3 className="text-xs font-bold tracking-wide uppercase opacity-55">Bin</h3>
            <button
              type="button"
              onClick={onEmptyTrash}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#b3261e] ring-1 ring-[var(--surface-line)]"
            >
              <TrashIcon width={20} height={20} />
              <span className="font-semibold">Empty the bin ({counts.trash})</span>
            </button>
          </section>
        ) : null}
      </div>
    </Sheet>
  );
}
