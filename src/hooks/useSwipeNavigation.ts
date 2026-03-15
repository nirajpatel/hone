import { useEffect, useRef } from 'react';

const MIN_SWIPE_DISTANCE = 50;

/**
 * Triggers callbacks on horizontal swipe gestures.
 * Ignores swipes that are more vertical than horizontal (i.e. scrolling).
 */
export function useSwipeNavigation(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;

      touchStartX.current = null;
      touchStartY.current = null;

      if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE || Math.abs(deltaY) > Math.abs(deltaX)) return;

      if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight]);
}
