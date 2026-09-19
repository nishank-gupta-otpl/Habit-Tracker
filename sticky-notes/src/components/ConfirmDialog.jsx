import { useEffect } from 'react';

/** Used only where there is genuinely no undo — emptying the bin. */
export default function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-60 grid place-items-center px-6">
      {/* Tapping outside dismisses, but the backdrop is hidden from assistive
          tech and out of the tab order: it would otherwise be a second control
          with the same name as Cancel. Escape and Cancel are the real paths. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onCancel}
        className="absolute inset-0 h-full w-full cursor-default bg-black/45"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise relative w-full max-w-sm rounded-2xl bg-[var(--surface-raised)] p-5"
      >
        <h2 className="text-base font-bold">{title}</h2>
        <p className="mt-2 text-sm text-[var(--text-soft)]">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[#b3261e] px-4 py-2 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
