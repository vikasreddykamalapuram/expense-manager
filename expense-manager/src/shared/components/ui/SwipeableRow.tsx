/**
 * Swipe-to-delete list row. Wrap any list item and get a red "Delete"
 * revealed on horizontal left-swipe (touch devices only). On desktop the
 * children render normally with no gesture overhead.
 *
 * Usage:
 *   <SwipeableRow onDelete={() => remove(tx.id)}>
 *     <TransactionRow tx={tx} />
 *   </SwipeableRow>
 *
 * Design notes:
 *  - We track horizontal delta; anything <10px is ignored so vertical scroll
 *    isn't hijacked.
 *  - Once the drag exceeds `revealThreshold`, the row snaps open (like iOS
 *    Mail). Tap outside or swipe right to snap closed.
 *  - Delete taps trigger a warning haptic; the actual deletion is up to the
 *    parent (do it after your own confirm modal if desired).
 */
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { haptic } from '../../services/haptics';
import { classNames } from '../../utils/helpers';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  /** Pixel offset that reveals the delete button. Default 80. */
  revealThreshold?: number;
  /** Localized label for the delete action. */
  deleteLabel?: string;
}

const isTouchDevice = () =>
  typeof window !== 'undefined' && 'ontouchstart' in window;

export function SwipeableRow({
  children,
  onDelete,
  revealThreshold = 80,
  deleteLabel = 'Delete',
}: Props) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef<'unknown' | 'horizontal' | 'vertical'>('unknown');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const enabled = isTouchDevice();

  // Close when the user taps anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setOffset(0);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
    };
  }, [open]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = 'unknown';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enabled || startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (dragging.current === 'unknown') {
      // Decide once whether this is a horizontal swipe or a vertical scroll.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      dragging.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    if (dragging.current !== 'horizontal') return;

    // Only left-swipe reveals; right-swipe past 0 just closes the row.
    const base = open ? -revealThreshold : 0;
    const next = Math.min(0, Math.max(-revealThreshold * 1.4, base + dx));
    setOffset(next);
  };

  const handleTouchEnd = () => {
    if (!enabled) return;
    if (dragging.current === 'horizontal') {
      if (offset <= -revealThreshold * 0.6) {
        setOpen(true);
        setOffset(-revealThreshold);
      } else {
        setOpen(false);
        setOffset(0);
      }
    }
    startX.current = null;
    startY.current = null;
    dragging.current = 'unknown';
  };

  const handleDelete = () => {
    haptic.warning();
    setOpen(false);
    setOffset(0);
    onDelete();
  };

  return (
    <div ref={wrapperRef} className="relative overflow-hidden">
      {/* Action layer sits behind the row. */}
      <button
        type="button"
        onClick={handleDelete}
        aria-label={deleteLabel}
        className={classNames(
          'absolute inset-y-0 right-0 flex items-center justify-center gap-1.5 bg-red-500 px-4 text-sm font-medium text-white',
          'transition-opacity',
          offset < -8 ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        style={{ width: revealThreshold }}
      >
        <Trash2 size={16} />
        <span>{deleteLabel}</span>
      </button>

      {/* Row content — slides horizontally with the drag. */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging.current === 'horizontal' ? 'none' : 'transform 200ms ease',
        }}
        className="relative bg-white dark:bg-gray-800"
      >
        {children}
      </div>
    </div>
  );
}
