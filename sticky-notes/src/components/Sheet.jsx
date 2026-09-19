import { useEffect, useRef } from 'react';

/**
 * A full-screen panel with the two behaviours Android users expect from one:
 * the hardware/gesture back button closes it instead of leaving the app, and
 * focus is trapped inside while it is open.
 *
 * Back is handled by pushing a history entry on open and popping it on close,
 * which is the only hook a PWA gets on the system back gesture.
 */
export default function Sheet({ open, onClose, labelledBy, children }) {
  const ref = useRef(null);
  // Held in a ref so opening the sheet does not re-run (and re-push history)
  // every time the parent hands down a new onClose identity.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const marker = { sheet: true };
    window.history.pushState(marker, '');
    const onPop = () => closeRef.current();
    window.addEventListener('popstate', onPop);

    const previous = document.activeElement;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !ref.current) return;
      const focusable = ref.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = '';
      // Only unwind the entry we added; if the close came from the back button
      // itself the entry is already gone.
      if (window.history.state?.sheet) window.history.back();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)] animate-rise"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {children}
    </div>
  );
}
