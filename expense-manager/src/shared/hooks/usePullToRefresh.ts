/**
 * Pull-to-refresh hook. Attach the returned ref to the scroll container
 * (or window if omitted) and pass an async `onRefresh` handler. When the
 * user pulls down more than `threshold` pixels at scrollTop=0, the handler
 * fires and a small progress spinner slot renders via the `pullDistance`
 * state.
 *
 * We roll this by hand instead of pulling in react-pull-to-refresh so we
 * can stay dependency-light and pipe haptic feedback through our own
 * service.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { haptic } from '../services/haptics';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  /** Pixels of pull needed to trigger a refresh. Default 70. */
  threshold?: number;
  /** Max pixels the indicator can travel. Default 100. */
  maxPull?: number;
  /** Disable the gesture (e.g., on desktop). Default: only enabled on touch devices. */
  disabled?: boolean;
}

export interface UsePullToRefreshResult {
  /** Attach to the scrollable container. */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Current pull distance in px (0 when idle). Drive the indicator UI with this. */
  pullDistance: number;
  /** True while onRefresh() is awaiting. */
  isRefreshing: boolean;
  /** True once pullDistance crosses threshold — flip your indicator to "release to refresh". */
  isReadyToTrigger: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  maxPull = 100,
  disabled,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const triggeredHapticRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep the latest onRefresh in a ref so we don't re-attach listeners
  // every render when callers pass an inline function.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
  const enabled = !disabled && isTouchDevice;

  const reset = useCallback(() => {
    startY.current = null;
    pulling.current = false;
    triggeredHapticRef.current = false;
    setPullDistance(0);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      // Only arm the gesture when we're already at the top of the scroll container.
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0]?.clientY ?? null;
      pulling.current = true;
      triggeredHapticRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling.current || startY.current === null) return;
      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startY.current;
      if (delta <= 0) {
        // User is scrolling up — abandon the gesture without preventing the scroll.
        setPullDistance(0);
        return;
      }
      // Rubber-band the drag so it feels physical past the threshold.
      const damped = Math.min(maxPull, delta * 0.5);
      setPullDistance(damped);
      if (damped >= threshold && !triggeredHapticRef.current) {
        triggeredHapticRef.current = true;
        haptic.light();
      }
      // Only cancel native scroll once we're genuinely pulling — otherwise
      // horizontal swipes / normal scrolls stay smooth.
      if (delta > 10 && e.cancelable) e.preventDefault();
    };

    const handleTouchEnd = async () => {
      if (!pulling.current) { reset(); return; }
      const distance = pullDistanceRef.current;
      pulling.current = false;
      startY.current = null;
      if (distance >= threshold) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        try {
          await onRefreshRef.current();
          haptic.success();
        } catch {
          haptic.error();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
          triggeredHapticRef.current = false;
        }
      } else {
        reset();
      }
    };

    // Passive:false is required so touchmove can preventDefault.
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', reset);
    };
  }, [enabled, threshold, maxPull, isRefreshing, reset]);

  // Mirror pullDistance into a ref so the async touchend closure sees the
  // latest value without re-attaching listeners on every setState.
  const pullDistanceRef = useRef(pullDistance);
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    isReadyToTrigger: pullDistance >= threshold,
  };
}
