import { useEffect, useState } from 'react';

const REVEAL_MS = 600;

/**
 * True for a moment after `showingPlaceholder` turns off, so the content replacing a skeleton can fade in once
 * without replaying every time it remounts (tab switches, view toggles).
 */
export function useRevealAfterPlaceholder(showingPlaceholder: boolean) {
  const [previous, setPrevious] = useState(showingPlaceholder);
  const [revealing, setRevealing] = useState(false);

  // Updated during render so the first frame of the real content already carries the fade.
  if (previous !== showingPlaceholder) {
    setPrevious(showingPlaceholder);
    setRevealing(previous && !showingPlaceholder);
  }

  useEffect(() => {
    if (!revealing) return;
    const timeout = setTimeout(() => setRevealing(false), REVEAL_MS);
    return () => clearTimeout(timeout);
  }, [revealing]);

  return revealing;
}
