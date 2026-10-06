import { useEffect, useState } from 'react';
import { getLoadProgress, loadDisplay } from '../../utils/loadProgress';

const INK = '#030213';
const MUTED = 'var(--color-gray-500)';
const TRACK = 'var(--color-gray-200)';
const TARE_BLANK_MS = 250;

// Hover is limited to real pointers so iOS doesn't leave the label dark after a tap.
const STYLES = `
.hone-scale-tare { color: ${MUTED}; transition: color 150ms; }
.hone-scale:active .hone-scale-tare,
.hone-scale:focus-visible .hone-scale-tare { color: var(--color-gray-900); }
@media (hover: hover) {
  .hone-scale:hover .hone-scale-tare { color: var(--color-gray-900); }
}
`;

function tare() {
  loadDisplay.tare = { at: performance.now(), base: loadDisplay.shown, net: 0 };
}

export function ScaleLoading() {
  const [, setFrame] = useState(0);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const raw = getLoadProgress(now);
      const k = 1 - Math.exp(-dt / (raw >= 100 ? 90 : 160));
      let shown = Math.max(loadDisplay.shown, loadDisplay.shown + (raw - loadDisplay.shown) * k);
      if (raw >= 100 && 100 - shown < 0.05) shown = 100;
      loadDisplay.shown = shown;

      const t = loadDisplay.tare;
      if (t && now - t.at >= TARE_BLANK_MS) {
        const target = Math.max(0, shown - t.base);
        t.net += (target - t.net) * (1 - Math.exp(-dt / 140));
        if (shown === 100 && target - t.net < 0.05) t.net = target;
      }

      setFrame((f) => f + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { shown, tare: t } = loadDisplay;
  const blank = t != null && performance.now() - t.at < TARE_BLANK_MS;
  const value = blank ? '----' : (t ? t.net : shown).toFixed(1);

  return (
    <div
      className="hone-scale"
      role="button"
      tabIndex={0}
      aria-label="Loading. Tap to tare the scale."
      onClick={tare}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tare();
        }
      }}
      style={{
        width: 170,
        color: INK,
        cursor: 'pointer',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
    >
      <style>{STYLES}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 30, lineHeight: 1, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
          {value}
          <small style={{ fontSize: 'var(--text-xs)', color: MUTED, marginLeft: 4, letterSpacing: 0 }}>g</small>
        </span>
        <span className="hone-scale-tare font-medium uppercase tracking-wide" style={{ fontSize: 'var(--text-xxs)' }}>Tare</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown)}
        style={{ marginTop: 14, height: 3, background: TRACK, borderRadius: 2, overflow: 'hidden' }}
      >
        <div style={{ height: '100%', width: `${shown}%`, background: INK }} />
      </div>
    </div>
  );
}
