import { useCallback, useEffect, useRef, useState } from 'react';

const EDGE = 72; // px from the viewport edge where auto-scroll kicks in
const SPEED = 12; // px per frame at the very edge

/**
 * Drag-to-reorder for the board, built on pointer events so one code path
 * covers touch, mouse and stylus.
 *
 * Dragging starts from a dedicated grip rather than from the note body, and
 * only the grip carries `touch-action: none`. That is what lets a finger
 * scroll the board normally everywhere else: once Chrome on Android decides a
 * gesture is a scroll it sends pointercancel and the drag is lost, so the
 * handle has to opt out of scrolling up front rather than after a delay.
 *
 * @param {(id: string, overId: string) => void} onMove called as the dragged
 *   note passes over another one, so the board reflows live under the finger.
 */
export function useDragSort(onMove) {
  const [draggingId, setDraggingId] = useState(null);
  const state = useRef({ id: null, pointerId: null, y: 0, raf: 0 });

  const stop = useCallback(() => {
    cancelAnimationFrame(state.current.raf);
    state.current = { id: null, pointerId: null, y: 0, raf: 0 };
    setDraggingId(null);
  }, []);

  // Scrolls the board when the note is dragged towards the top or bottom of
  // the screen — without it a phone-sized viewport can only reorder what is
  // already visible. Named so the frame loop can schedule itself.
  const autoScroll = useCallback(function step() {
    const { id, y } = state.current;
    if (!id) return;
    const top = y - EDGE;
    const bottom = window.innerHeight - EDGE - y;
    if (top < 0) window.scrollBy(0, Math.max(-SPEED, (top / EDGE) * SPEED));
    else if (bottom < 0) window.scrollBy(0, Math.min(SPEED, (-bottom / EDGE) * SPEED));
    state.current.raf = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    if (!draggingId) return undefined;

    const move = (event) => {
      if (event.pointerId !== state.current.pointerId) return;
      event.preventDefault();
      state.current.y = event.clientY;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-note-id]');
      const overId = target?.getAttribute('data-note-id');
      if (overId && overId !== state.current.id) onMove(state.current.id, overId);
    };

    const end = (event) => {
      if (event.pointerId === state.current.pointerId) stop();
    };

    // Passive would let Chrome scroll the page mid-drag, so these have to opt in.
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
    };
  }, [draggingId, onMove, stop]);

  const gripProps = useCallback(
    (id) => ({
      onPointerDown: (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        // Capture keeps the events coming to this element even once the finger
        // has travelled well past it.
        event.currentTarget.setPointerCapture?.(event.pointerId);
        state.current = { id, pointerId: event.pointerId, y: event.clientY, raf: 0 };
        state.current.raf = requestAnimationFrame(autoScroll);
        setDraggingId(id);
      },
      style: { touchAction: 'none' },
    }),
    [autoScroll],
  );

  return { draggingId, gripProps };
}
