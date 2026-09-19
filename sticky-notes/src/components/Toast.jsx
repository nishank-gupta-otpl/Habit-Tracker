import { useEffect } from 'react';

/**
 * The undo bar. Sits above the add button and disappears on its own.
 *
 * Every destructive action in the app routes through this instead of a
 * confirmation dialog — one tap to act, one tap to take it back beats one tap
 * plus a dialog every single time.
 */
export default function Toast({ message, actionLabel, onAction, onDismiss, timeout = 6000 }) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(onDismiss, timeout);
    return () => clearTimeout(timer);
  }, [message, onDismiss, timeout]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-rise fixed inset-x-3 z-40 flex items-center gap-3 rounded-xl bg-[var(--text)] px-4 py-3 text-sm text-[var(--surface)] shadow-lg"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
    >
      <span className="flex-1">{message}</span>
      {onAction ? (
        <button type="button" onClick={onAction} className="font-bold tracking-wide uppercase">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
