import { useEffect, useRef } from 'react';

/**
 * Prevents the screen from dimming or locking while the given condition is true.
 * Uses the Screen Wake Lock API (https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).
 * Safe to call when the API is not supported (e.g. older browsers, non-secure context).
 */
export function useWakeLock(enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const requestLock = async () => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // NotAllowedError, or unsupported - ignore
    }
  };

  const releaseLock = async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch {
        // ignore
      }
      sentinelRef.current = null;
    }
  };

  useEffect(() => {
    requestLock();
    return () => {
      releaseLock();
    };
  }, [enabled]);

  // Re-request when the tab becomes visible again (browser releases the lock when hidden)
  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled]);
}
