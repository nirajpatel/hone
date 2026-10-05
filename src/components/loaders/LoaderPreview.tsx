import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LoaderVariant } from './AppLoader';
import { LoadingScreen } from './LoadingScreen';
import { LOAD_STEP_DEFAULTS, LoadStep, resetLoadProgress, simulatedLoadStep } from '../../utils/loadProgress';

const { start: startLoadStep, finish: finishLoadStep } = simulatedLoadStep;

const OPTIONS: { id: LoaderVariant; label: string }[] = [
  { id: 'scale', label: 'Scale' },
  { id: 'scale-white', label: 'Scale, white' },
  { id: 'trace', label: 'Mark trace' },
  { id: 'espresso', label: 'Current' },
];

const DATA_STEPS: LoadStep[] = ['brews', 'coffees', 'users', 'equipment'];

const jitter = (ms: number) => ms * (0.65 + Math.random() * 0.75);

/** Replays the real step sequence with typical timings, without touching learned timings. */
function simulateLoad(timers: number[]) {
  resetLoadProgress({ simulate: true });
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  const sessionEnd = jitter(LOAD_STEP_DEFAULTS.session);
  const accountEnd = sessionEnd + jitter(LOAD_STEP_DEFAULTS.account);
  startLoadStep('session');
  at(sessionEnd, () => {
    finishLoadStep('session');
    startLoadStep('account');
  });
  at(accountEnd, () => {
    finishLoadStep('account');
    DATA_STEPS.forEach((step) => {
      startLoadStep(step);
      at(jitter(LOAD_STEP_DEFAULTS[step]), () => finishLoadStep(step));
    });
  });
}

export function LoaderPreview({ initialVariant }: { initialVariant: LoaderVariant }) {
  const [variant, setVariant] = useState<LoaderVariant>(initialVariant);
  const [runId, setRunId] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    simulateLoad(timers.current);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [runId]);

  const pill = (active: boolean): CSSProperties => ({
    border: 0,
    borderRadius: 999,
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
    background: active ? '#030213' : 'transparent',
    color: active ? '#ffffff' : '#717182',
  });

  return (
    <div style={{ position: 'relative' }}>
      <LoadingScreen key={`${variant}-${runId}`} variant={variant} />
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'inline-flex', border: '1px solid #ececf0', borderRadius: 999, padding: 3, background: '#ffffff' }}>
          {OPTIONS.map((o) => (
            <button key={o.id} style={pill(variant === o.id)} onClick={() => { setVariant(o.id); setRunId((r) => r + 1); }}>
              {o.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setRunId((r) => r + 1)}
          style={{ border: '1px solid #ececf0', borderRadius: 999, padding: '6px 16px', fontSize: 13, cursor: 'pointer', background: '#ffffff', color: '#030213' }}
        >
          Replay
        </button>
      </div>
    </div>
  );
}
