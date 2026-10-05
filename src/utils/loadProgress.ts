// Tracks the initial app load (session → account → data) so loaders can show real progress.
// Module-level so progress survives loader remounts between App's loading branches.

export type LoadStep = 'session' | 'account' | 'brews' | 'coffees' | 'users' | 'equipment';

const WEIGHTS: Record<LoadStep, number> = {
  session: 8,
  account: 17,
  brews: 35,
  coffees: 16,
  users: 12,
  equipment: 12,
};

const DEFAULT_EXPECTED_MS: Record<LoadStep, number> = {
  session: 150,
  account: 600,
  brews: 1300,
  coffees: 500,
  users: 350,
  equipment: 450,
};

const TIMINGS_KEY = 'hone-load-timings';
// While a step is in flight it may claim at most this share of its weight.
const IN_FLIGHT_CAP = 0.95;

const steps = new Map<LoadStep, { start: number; end?: number }>();
// In simulated mode (loader preview) real app calls are ignored and nothing is recorded.
let simulated = false;
let expectedMs = loadExpectedTimings();

function loadExpectedTimings(): Record<LoadStep, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(TIMINGS_KEY) || '{}');
    return { ...DEFAULT_EXPECTED_MS, ...saved };
  } catch {
    return { ...DEFAULT_EXPECTED_MS };
  }
}

function saveTiming(step: LoadStep, ms: number) {
  expectedMs = { ...expectedMs, [step]: Math.round(expectedMs[step] * 0.6 + ms * 0.4) };
  try {
    localStorage.setItem(TIMINGS_KEY, JSON.stringify(expectedMs));
  } catch {
    // Storage unavailable (private mode, quota) — fall back to in-memory timings.
  }
}

function start(step: LoadStep) {
  if (!steps.has(step)) steps.set(step, { start: performance.now() });
}

function finish(step: LoadStep) {
  const now = performance.now();
  const entry = steps.get(step) ?? { start: now };
  if (entry.end != null) return;
  entry.end = now;
  steps.set(step, entry);
  if (!simulated) saveTiming(step, now - entry.start);
}

export function startLoadStep(step: LoadStep) {
  if (!simulated) start(step);
}

export function finishLoadStep(step: LoadStep) {
  if (!simulated) finish(step);
}

export function trackLoadStep<T>(step: LoadStep, promise: Promise<T>): Promise<T> {
  startLoadStep(step);
  return promise.finally(() => finishLoadStep(step));
}

export const simulatedLoadStep = { start, finish };

/** Marks every step finished, e.g. when loading ends early or by another path. */
export function completeLoadProgress() {
  if (simulated) return;
  const now = performance.now();
  (Object.keys(WEIGHTS) as LoadStep[]).forEach((step) => {
    const entry = steps.get(step) ?? { start: now };
    if (entry.end == null) entry.end = now;
    steps.set(step, entry);
  });
}

/** Raw progress 0–100: finished steps count fully, in-flight steps creep toward their weight. */
export function getLoadProgress(now = performance.now()): number {
  let total = 0;
  let allDone = true;
  (Object.keys(WEIGHTS) as LoadStep[]).forEach((step) => {
    const entry = steps.get(step);
    if (!entry) {
      allDone = false;
    } else if (entry.end != null) {
      total += WEIGHTS[step];
    } else {
      allDone = false;
      const frac = 1 - Math.exp((-2.3 * (now - entry.start)) / expectedMs[step]);
      total += WEIGHTS[step] * Math.min(IN_FLIGHT_CAP, frac);
    }
  });
  return allDone ? 100 : total;
}

/** Display state shared across loader remounts. */
export const loadDisplay = {
  shown: 0,
  tare: null as null | { at: number; base: number; net: number },
};

/** Clears all progress. Simulated runs ignore real app calls and don't touch learned timings. */
export function resetLoadProgress({ simulate = false }: { simulate?: boolean } = {}) {
  steps.clear();
  simulated = simulate;
  loadDisplay.shown = 0;
  loadDisplay.tare = null;
}

export const LOAD_STEP_DEFAULTS = DEFAULT_EXPECTED_MS;
