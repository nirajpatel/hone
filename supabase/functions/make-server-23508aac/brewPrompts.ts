/**
 * Brew guidance prompts and context, shared by the edge function (Deno) and
 * the Node eval/regeneration scripts. Keep this file free of runtime imports
 * and non-erasable TypeScript (no enum, namespace or parameter properties):
 * Node loads it with native type stripping.
 */

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

// Guidance and bag scans (docs/ai-analysis/prompt-eval-v2.md). Lookups stay on gpt-5.4 with
// reasoning 'none': same answers, about half the wait. gpt-6.1-sol rejects 'none'.
// Failed calls retry once on the same model.
export const MODEL = 'gpt-6.1-sol';
export const LOOKUP_MODEL = 'gpt-5.4';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface ChatMessage {
  role: 'system' | 'user';
  content: unknown;
}

/** Chat Completions body. Reasoning models reject `temperature`, so it is never sent. */
export function buildChatBody(
  model: string,
  messages: ChatMessage[],
  effort: ReasoningEffort,
  schema?: { name: string; schema: Record<string, unknown> },
): Record<string, unknown> {
  const body: Record<string, unknown> = { model, messages, reasoning_effort: effort };
  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: schema.name, strict: true, schema: schema.schema },
    };
  }
  return body;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Brew {
  id: string;
  coffeeId: string;
  userId?: string;
  brewMethod?: string;
  grindSetting?: string | number;
  dosage?: number;
  brewTime?: number;
  finalWeight?: number;
  waterTemp?: number | string;
  quality?: number;
  tastingNotes?: string;
  personalNotes?: string;
  notes?: string;
  coffeeTemperature?: string;
  brewerId?: string;
  brewerName?: string;
  grinderId?: string;
  grinderName?: string;
  stages?: Array<{ endTime: number; endWeight: number }>;
  createdAt: string;
  timezoneOffset?: number;
  suggestion?: { concise?: { action?: string }; full?: unknown };
  [key: string]: unknown;
}

export interface Coffee {
  id: string;
  roaster: string;
  name: string;
  roastDate?: string;
  region?: string;
  notes?: string;
  roastLevel?: string;
  [key: string]: unknown;
}

export interface Equipment {
  brewerId?: string;
  brewerName?: string;
  grinderId?: string;
  grinderName?: string;
}

export interface CoffeeAliases {
  roasterAliases: Record<string, string>;
  coffeeNameAliases: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export const HISTORY_LIMIT = 15;
const PROFILE_WINDOW = 20;
const MIN_ROAST_BUCKET_N = 5;
const GRINDER_HISTORY_LIMIT = 6;
const ROAST_LEVELS = ['Light', 'Medium-Light', 'Medium', 'Medium-Dark', 'Dark'];

const norm = (s: unknown): string => String(s ?? '').trim().toLowerCase();
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : NaN;
};
const round = (n: number, d = 1): string => (Number.isFinite(n) ? String(+n.toFixed(d)) : 'n/a');
const byNewest = (a: Brew, b: Brew) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
const byOldest = (a: Brew, b: Brew) => -byNewest(a, b);

export function qualityLabel(q: number | undefined): string {
  return q === 1 ? 'Bad' : q === 2 ? 'Decent' : q === 3 ? 'Excellent' : 'Not rated';
}

/** The brew's local calendar date (timezoneOffset is getTimezoneOffset(): UTC minus local). */
function localDate(brew: Brew): Date {
  const d = new Date(brew.createdAt);
  const offset = typeof brew.timezoneOffset === 'number' ? brew.timezoneOffset : 0;
  return new Date(d.getTime() - offset * 60_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatBrewDate(brew: Brew, withYear = true): string {
  const d = localDate(brew);
  const base = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return withYear ? `${base}, ${d.getUTCFullYear()}` : base;
}

function formatRoastDate(roastDate: string | undefined): string | null {
  if (!roastDate || !/^\d{4}-\d{2}-\d{2}/.test(roastDate)) return null;
  const [, m, d] = roastDate.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

export function daysOffRoast(coffee: Coffee | undefined, brew: Brew): number | null {
  const rd = coffee?.roastDate;
  if (!rd || !/^\d{4}-\d{2}-\d{2}/.test(rd)) return null;
  const roast = Date.UTC(+rd.slice(0, 4), +rd.slice(5, 7) - 1, +rd.slice(8, 10));
  const d = localDate(brew);
  const brewDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((brewDay - roast) / 86_400_000);
  return days >= 0 ? days : null;
}

export const isFrozen = (b: Brew): boolean => b.coffeeTemperature === 'frozen';
export const brewRatio = (b: Brew): number => num(b.finalWeight) / num(b.dosage);
const grindNum = (b: Brew): number => num(b.grindSetting);

function formatTime(seconds: unknown, method: string): string {
  const s = num(seconds);
  if (!Number.isFinite(s)) return 'time n/a';
  if (method === 'espresso') return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}

function formatRatio(r: number): string {
  if (!Number.isFinite(r)) return '1:n/a';
  return `1:${r < 4 ? r.toFixed(2) : r.toFixed(1)}`;
}

export function roastIndex(level: string | undefined): number {
  return ROAST_LEVELS.indexOf(level ?? '');
}

export function roastBucket(level: string | undefined): 'lighter' | 'medium' | 'darker' | null {
  const i = roastIndex(level);
  if (i < 0) return null;
  return i <= 1 ? 'lighter' : i === 2 ? 'medium' : 'darker';
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = NaN;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

function sameUnit(id1?: string, name1?: string, id2?: string, name2?: string): boolean {
  if (id1 && id2) return id1 === id2;
  if (name1 && name2) return norm(name1) === norm(name2);
  return false;
}

export function equipmentOf(brew: Brew): Equipment {
  return {
    brewerId: brew.brewerId,
    brewerName: brew.brewerName,
    grinderId: brew.grinderId,
    grinderName: brew.grinderName,
  };
}

const onSameGrinder = (brew: Brew, eq: Equipment): boolean => sameUnit(brew.grinderId, brew.grinderName, eq.grinderId, eq.grinderName);
const onSameBrewer = (brew: Brew, eq: Equipment): boolean => sameUnit(brew.brewerId, brew.brewerName, eq.brewerId, eq.brewerName);

/** Same brewer and grinder; brews missing both ID and name never match. */
export function onSameEquipment(brew: Brew, eq: Equipment): boolean {
  return onSameGrinder(brew, eq) && onSameBrewer(brew, eq);
}

function setupLabel(eq: Equipment): string {
  const parts = [eq.brewerName, eq.grinderName].filter(Boolean);
  return parts.length ? parts.join(' + ') : 'unknown setup';
}

function resolveCanonical(roaster: string, name: string, aliases: CoffeeAliases): string {
  let r = roaster;
  for (const [variant, canonical] of Object.entries(aliases.roasterAliases)) {
    if (norm(variant) === norm(roaster)) { r = canonical; break; }
  }
  let n = name;
  const key = `${norm(r)}|${norm(name)}`;
  for (const [variantKey, canonicalValue] of Object.entries(aliases.coffeeNameAliases)) {
    const [kr, kn] = variantKey.split('|');
    if (`${norm(kr)}|${norm(kn)}` === key) { n = canonicalValue.split('|')[1] ?? name; break; }
  }
  return `${norm(r)}|${norm(n)}`;
}

/** IDs of every bag of the same bean (same canonical roaster + name). */
export function findSameCoffeeIds(target: Coffee, coffees: Coffee[], aliases: CoffeeAliases): string[] {
  const key = resolveCanonical(target.roaster, target.name, aliases);
  const ids = coffees.filter((c) => c?.roaster && c?.name && resolveCanonical(c.roaster, c.name, aliases) === key).map((c) => c.id);
  return ids.includes(target.id) ? ids : [target.id, ...ids];
}

/** Inputs that feed guidance; a background result is only saved if these are unchanged. */
export function regenInputsKey(brew: Brew | null | undefined): string {
  if (!brew) return '';
  const keys = ['grindSetting', 'dosage', 'waterTemp', 'brewTime', 'finalWeight', 'coffeeTemperature', 'stages', 'brewMethod', 'quality', 'tastingNotes', 'personalNotes', 'notes'];
  return JSON.stringify(keys.map((k) => brew[k] ?? null));
}

// ---------------------------------------------------------------------------
// History rows
// ---------------------------------------------------------------------------

function formatParams(b: Brew, method: string): string {
  const parts = [`grind ${b.grindSetting ?? 'n/a'}`];
  parts.push(`${round(num(b.dosage))}g → ${round(num(b.finalWeight))}g (${formatRatio(brewRatio(b))})`);
  parts.push(formatTime(b.brewTime, method));
  const temp = num(b.waterTemp);
  parts.push(Number.isFinite(temp) ? `${round(temp)}°F` : 'temp n/a');
  if (method === 'pour over' && Array.isArray(b.stages) && b.stages.length) {
    parts.push(`pours ${b.stages.map((s) => `${formatTime(s.endTime, method)}→${s.endWeight}g`).join(', ')}`);
  }
  return parts.join(' | ');
}

interface RowOptions {
  method: string;
  coffeesById: Map<string, Coffee>;
  showBag: boolean;
  userNames?: Record<string, string>;
  showPerson: boolean;
  tags?: string;
  guidanceBefore?: string;
}

function formatBrewRow(b: Brew, o: RowOptions): string {
  const coffee = o.coffeesById.get(b.coffeeId);
  const head = [`${formatBrewDate(b)}${o.tags ? ` ${o.tags}` : ''}`];
  if (o.showPerson && b.userId) head.push(o.userNames?.[b.userId] ?? 'other household member');
  head.push(setupLabel(equipmentOf(b)));
  const bean: string[] = [];
  if (o.showBag) bean.push(`bag roasted ${formatRoastDate(coffee?.roastDate) ?? 'unknown date'}`);
  const age = daysOffRoast(coffee, b);
  if (age !== null) bean.push(`${age}d off roast`);
  bean.push(isFrozen(b) ? 'frozen' : 'room temp');
  const outcome = [qualityLabel(b.quality)];
  if (b.tastingNotes) outcome.push(`notes: ${b.tastingNotes}`);
  const extraction = b.personalNotes || b.notes;
  if (extraction) outcome.push(`extraction notes: ${extraction}`);
  if (o.guidanceBefore) outcome.push(`guidance before this brew: "${o.guidanceBefore}"`);
  return `- ${head.join(' | ')} | ${bean.join(', ')} | ${formatParams(b, o.method)} | ${outcome.join(' | ')}`;
}

// ---------------------------------------------------------------------------
// Brewer profile
// ---------------------------------------------------------------------------

export function buildBrewerProfile(args: {
  householdBrews: Brew[];
  brewerUserId: string;
  method: string;
  equipment: Equipment;
  roastLevel?: string;
  coffeesById: Map<string, Coffee>;
  brewerLabel?: string;
  /** First brew only: improvement history already shows each brew's pours. */
  includePours?: boolean;
}): string[] {
  const { method, equipment, coffeesById } = args;
  // Brewer only: nothing here depends on the grinder, so a new grinder keeps the brewer's habits.
  const rated = args.householdBrews
    .filter((b) => b.userId === args.brewerUserId && b.brewMethod === method && b.quality && onSameBrewer(b, equipment))
    .sort(byNewest);
  const window = rated.slice(0, PROFILE_WINDOW);
  if (window.length < 3) return [];

  const lines: string[] = [];
  const habits: string[] = [];
  const bandOf = (label: string, unit: string, values: number[]) => {
    const v = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (v.length < window.length * 0.8) return;
    const lo = v[0];
    const hi = v[v.length - 1];
    const median = quantile(v, 0.5);
    if (median > 0 && (hi - lo) / median <= 0.02) {
      habits.push(`${label} ${round(lo)}-${round(hi)}${unit} (mode ${round(mode(v))}${unit})`);
    }
  };
  bandOf('dose', 'g', window.map((b) => num(b.dosage)));
  bandOf('water temperature', '°F', window.map((b) => num(b.waterTemp)));
  if (method !== 'espresso') bandOf('final weight', 'g', window.map((b) => num(b.finalWeight)));
  if (habits.length) lines.push(`Your standard (tight band in every recent brew): ${habits.join('; ')}. Keep these inside the band.`);

  const bucket = roastBucket(args.roastLevel);
  const inBucket = bucket ? rated.filter((b) => roastBucket(coffeesById.get(b.coffeeId)?.roastLevel) === bucket).slice(0, PROFILE_WINDOW) : [];
  let pool = window;
  let label = 'all roasts on this brewer';
  let lowSample = true;
  if (bucket && inBucket.length >= MIN_ROAST_BUCKET_N) {
    pool = inBucket;
    label = `${bucket} roasts on this brewer`;
    lowSample = false;
  } else if (!bucket) {
    label = 'all roasts on this brewer (this coffee has no roast level)';
  }
  const good = pool.filter((b) => (b.quality ?? 0) >= 2);
  if (good.length >= 3) {
    const range = (vals: number[], fmt: (n: number) => string) => {
      const v = vals.filter(Number.isFinite).sort((a, b) => a - b);
      if (!v.length) return null;
      return `${fmt(quantile(v, 0.25))}–${fmt(quantile(v, 0.75))} (median ${fmt(quantile(v, 0.5))})`;
    };
    const parts = [
      range(good.map(brewRatio), formatRatio) && `ratio ${range(good.map(brewRatio), formatRatio)}`,
      range(good.map((b) => num(b.brewTime)), (n) => formatTime(n, method)) && `time ${range(good.map((b) => num(b.brewTime)), (n) => formatTime(n, method))}`,
      range(good.map((b) => num(b.waterTemp)), (n) => `${round(n)}°F`) && `temp ${range(good.map((b) => num(b.waterTemp)), (n) => `${round(n)}°F`)}`,
    ].filter(Boolean);
    lines.push(`Typical Decent-or-better brews, ${label} (n=${good.length} of ${pool.length} rated${lowSample ? ', low sample' : ''}): ${parts.join(', ')}.`);
  }

  const complaints = new Map<string, number>();
  for (const b of window) {
    if (b.quality !== 1 || !b.tastingNotes) continue;
    for (const raw of b.tastingNotes.split(',')) {
      const note = norm(raw);
      if (note) complaints.set(note, (complaints.get(note) ?? 0) + 1);
    }
  }
  const top = [...complaints].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (top.length) lines.push(`Recurring complaints on Bad brews: ${top.map(([n, c]) => `"${n}" ×${c}`).join(', ')}.`);

  if (args.includePours && method === 'pour over') {
    const poured = rated.find((b) => (b.quality ?? 0) >= 2 && Array.isArray(b.stages) && b.stages.length);
    if (poured) {
      const pours = poured.stages!.map((s) => `${formatTime(s.endTime, method)}→${s.endWeight}g`).join(', ');
      lines.push(`Pours in the latest Decent-or-better brew (${formatBrewDate(poured)}, ${round(num(poured.dosage))}g → ${round(num(poured.finalWeight))}g): ${pours}.`);
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Tried-settings ledger
// ---------------------------------------------------------------------------

export interface LedgerCluster {
  brews: Brew[];
  qualities: number[];
  consistentlyBad: boolean;
  consistentlyGood: boolean;
  mixed: boolean;
  line: string;
}

export function buildSettingsLedger(args: {
  coffeeBrews: Brew[];
  householdBrews: Brew[];
  method: string;
  equipment: Equipment;
  coffeesById: Map<string, Coffee>;
  doseBand?: number;
}): LedgerCluster[] {
  const { method, equipment, coffeesById } = args;
  const grinderGrinds = args.householdBrews
    .filter((b) => sameUnit(b.grinderId, b.grinderName, equipment.grinderId, equipment.grinderName))
    .map(grindNum)
    .filter(Number.isFinite);
  if (grinderGrinds.length < 2) return [];
  const grindTol = 0.05 * (Math.max(...grinderGrinds) - Math.min(...grinderGrinds));
  const ratioTol = method === 'espresso' ? 0.1 : 0.5;

  const eligible = args.coffeeBrews
    .filter((b) => b.quality && onSameEquipment(b, equipment) && Number.isFinite(grindNum(b)) && Number.isFinite(brewRatio(b)))
    .sort(byOldest);

  const close = (a: Brew, b: Brew) => {
    const doseTol = Math.max(args.doseBand ?? 0, 0.02 * num(a.dosage));
    return (
      Math.abs(grindNum(a) - grindNum(b)) <= grindTol + 1e-9 &&
      Math.abs(num(a.dosage) - num(b.dosage)) <= doseTol + 1e-9 &&
      Math.abs(brewRatio(a) - brewRatio(b)) <= ratioTol + 1e-9 &&
      isFrozen(a) === isFrozen(b)
    );
  };

  const clusters: Brew[][] = [];
  for (const b of eligible) {
    const home = clusters.find((c) => close(c[0], b));
    if (home) home.push(b);
    else clusters.push([b]);
  }

  return clusters
    .filter((c) => c.length >= 2)
    .map((c) => {
      const qualities = c.map((b) => b.quality as number);
      const consistentlyBad = qualities.every((q) => q === 1);
      const consistentlyGood = qualities.every((q) => q >= 2);
      const mixed = !consistentlyBad && !consistentlyGood;
      const anchor = c[0];
      const grinds = c.map(grindNum);
      const ratios = c.map(brewRatio);
      const settings = [
        `grind ${round(Math.min(...grinds), 2)}${Math.max(...grinds) !== Math.min(...grinds) ? `-${round(Math.max(...grinds), 2)}` : ''}`,
        `${round(num(anchor.dosage))}g`,
        `${formatRatio(Math.min(...ratios))}${Math.max(...ratios) - Math.min(...ratios) >= 0.005 ? `-${formatRatio(Math.max(...ratios)).slice(2)}` : ''}`,
        isFrozen(anchor) ? 'frozen' : 'room temp',
      ].join(', ');
      const outcomes = c.map((b) => `${formatBrewDate(b, false)}: ${qualityLabel(b.quality)}`).join('; ');
      const differed: string[] = [];
      const times = c.map((b) => num(b.brewTime)).filter(Number.isFinite);
      const timeSpread = times.length ? Math.max(...times) - Math.min(...times) : 0;
      if (timeSpread >= (method === 'espresso' ? 4 : 20)) {
        differed.push(`time ${formatTime(Math.min(...times), method)}–${formatTime(Math.max(...times), method)}`);
      }
      const ages = c.map((b) => daysOffRoast(coffeesById.get(b.coffeeId), b)).filter((a): a is number => a !== null);
      if (!isFrozen(anchor) && ages.length >= 2 && Math.max(...ages) - Math.min(...ages) >= 7) {
        differed.push(`days off roast ${Math.min(...ages)}–${Math.max(...ages)}`);
      }
      const temps = c.map((b) => num(b.waterTemp)).filter(Number.isFinite);
      if (temps.length >= 2 && Math.max(...temps) - Math.min(...temps) >= 2) {
        differed.push(`water ${round(Math.min(...temps))}–${round(Math.max(...temps))}°F`);
      }
      if (new Set(c.map((b) => b.coffeeId)).size > 1) differed.push('different bags');
      if (new Set(c.map((b) => b.userId)).size > 1) differed.push('different people');
      const verdict = consistentlyBad ? ' (consistently Bad)' : consistentlyGood ? ' (consistently Decent or better)' : ' (mixed)';
      const line = `- ${settings} → ${outcomes}${verdict}. ${differed.length ? `Differed: ${differed.join(', ')}.` : 'No recorded difference.'}`;
      return { brews: c, qualities, consistentlyBad, consistentlyGood, mixed, line };
    });
}

// ---------------------------------------------------------------------------
// Grinder history (first brew)
// ---------------------------------------------------------------------------

/**
 * The middle setting actually used (never an average: stepped dials like 5.1/5.2 have no 5.15).
 * Settings with letters or several parts can't be ordered, so those use the most used one (newest on ties).
 */
function typicalGrind(brews: Brew[]): string {
  if (brews.every((b) => /^\s*\d+(\.\d+)?\s*$/.test(String(b.grindSetting)))) {
    const sorted = [...brews].sort((a, b) => grindNum(a) - grindNum(b));
    return String(sorted[Math.floor((sorted.length - 1) / 2)].grindSetting).trim();
  }
  const counts = new Map<string, number>();
  for (const b of [...brews].sort(byNewest)) {
    const g = String(b.grindSetting ?? '').trim();
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let best = 'n/a';
  let bestN = 0;
  for (const [g, n] of counts) if (n > bestN) { best = g; bestN = n; }
  return best;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * One line per coffee recently brewed on this grinder with this method, newest first, rated or
 * not: its roast, typical setting and time (from its Decent-or-better brews when it has any), and
 * when it was last brewed. Coffee names are left out so they don't end up in the guidance.
 */
export function buildGrinderHistory(args: {
  householdBrews: Brew[];
  coffeesById: Map<string, Coffee>;
  excludeCoffeeIds: string[];
  method: string;
  equipment: Equipment;
}): string[] {
  const { method, equipment, coffeesById } = args;
  const exclude = new Set(args.excludeCoffeeIds);
  const byCoffee = new Map<string, Brew[]>();
  for (const b of [...args.householdBrews].sort(byNewest)) {
    if (b.brewMethod !== method || exclude.has(b.coffeeId) || !coffeesById.has(b.coffeeId) || !onSameGrinder(b, equipment)) continue;
    if (!byCoffee.has(b.coffeeId)) byCoffee.set(b.coffeeId, []);
    byCoffee.get(b.coffeeId)!.push(b);
  }
  return [...byCoffee].slice(0, GRINDER_HISTORY_LIMIT).map(([coffeeId, brews]) => {
    const coffee = coffeesById.get(coffeeId)!;
    const good = brews.filter((b) => (b.quality ?? 0) >= 2);
    const pool = good.length ? good : brews;
    const times = pool.map((b) => num(b.brewTime)).filter(Number.isFinite).sort((a, b) => a - b);
    const typical = [`grind ${typicalGrind(pool)}`, ...(times.length ? [formatTime(quantile(times, 0.5), method)] : [])].join(', ');
    let from = plural(good.length, 'Decent-or-better brew');
    if (!good.length) {
      const bad = brews.filter((b) => b.quality === 1).length;
      const unrated = brews.length - bad;
      from = [bad ? plural(bad, 'Bad brew') : '', unrated ? `${plural(unrated, 'brew')} not rated` : ''].filter(Boolean).join(' and ');
    }
    const desc = [coffee.roastLevel ? `${coffee.roastLevel} roast` : 'roast unknown', coffee.region].filter(Boolean).join(', ');
    return `- ${desc}${coffee.notes ? ` (bag notes: ${coffee.notes})` : ''}: typically ${typical}, from ${from}; last brewed ${formatBrewDate(brews[0])}.`;
  });
}

// ---------------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------------

export interface GuidanceInput {
  coffee: Coffee;
  coffees: Coffee[];
  householdBrews: Brew[];
  brewMethod: string;
  sameCoffeeIds: string[];
  baselineBrewId?: string | null;
  /** Who will brew next; used for the brewer profile when there is no baseline. */
  requesterUserId: string;
  /** Equipment selected for the next brew (first brew only; improvement uses the baseline's). */
  equipment?: Equipment;
  userNames?: Record<string, string>;
  grinderProfiles?: StoredGrinderProfile[];
  historyLimit?: number;
}

export interface GuidanceContext {
  mode: 'improve' | 'first';
  coffee: Coffee;
  brewMethod: string;
  baseline: Brew | null;
  equipment: Equipment;
  historyRows: string[];
  historyBrews: Brew[];
  ledger: LedgerCluster[];
  profileLines: string[];
  profileLabel: string;
  grinderHistory: string[];
  grinderLine: string | null;
}

export function assembleGuidanceContext(input: GuidanceInput): GuidanceContext {
  const { coffee, brewMethod } = input;
  const coffeesById = new Map(input.coffees.map((c) => [c.id, c]));
  coffeesById.set(coffee.id, coffeesById.get(coffee.id) ?? coffee);
  const sameIds = new Set(input.sameCoffeeIds);
  const coffeeBrews = input.householdBrews.filter((b) => sameIds.has(b.coffeeId) && b.brewMethod === brewMethod).sort(byNewest);

  const baseline =
    (input.baselineBrewId && coffeeBrews.find((b) => b.id === input.baselineBrewId)) || coffeeBrews[0] || null;
  const mode: GuidanceContext['mode'] = baseline ? 'improve' : 'first';
  const equipment = baseline ? equipmentOf(baseline) : input.equipment ?? {};
  const brewerUserId = baseline?.userId ?? input.requesterUserId;
  const brewerLabel = input.userNames?.[brewerUserId];

  const profileLines = buildBrewerProfile({
    householdBrews: input.householdBrews,
    brewerUserId,
    method: brewMethod,
    equipment,
    roastLevel: coffee.roastLevel,
    coffeesById,
    includePours: mode === 'first',
  });
  const profileLabel = `${brewerLabel ? `${brewerLabel}, ` : ''}${brewMethod} on ${equipment.brewerName ?? 'this brewer'}, last ${PROFILE_WINDOW} rated brews across all coffees and grinders`;
  const grinderKey = equipment.grinderName ? grinderProfileKey(equipment.grinderName) : null;
  const storedGrinder = grinderKey ? input.grinderProfiles?.find((p) => grinderProfileKey(p.name) === grinderKey) : undefined;
  const grinderLine = equipment.grinderName ? formatGrinderLine(equipment.grinderName, storedGrinder) : null;

  if (mode === 'first') {
    const grinderHistory = buildGrinderHistory({
      householdBrews: input.householdBrews,
      coffeesById,
      excludeCoffeeIds: input.sameCoffeeIds,
      method: brewMethod,
      equipment,
    });
    return { mode, coffee, brewMethod, baseline: null, equipment, historyRows: [], historyBrews: [], ledger: [], profileLines, profileLabel, grinderHistory, grinderLine };
  }

  const limit = input.historyLimit ?? HISTORY_LIMIT;
  const best = coffeeBrews.find((b) => b.quality === 3) ?? null;
  const picked = coffeeBrews.slice(0, limit);
  if (!picked.some((b) => b.id === baseline!.id)) picked.push(baseline!);
  if (best && !picked.some((b) => b.id === best.id)) picked.push(best);
  picked.sort(byNewest);

  const chronological = [...coffeeBrews].sort(byOldest);
  const guidanceBefore = new Map<string, string>();
  chronological.forEach((b, i) => {
    const action = chronological[i - 1]?.suggestion?.concise?.action;
    if (action) guidanceBefore.set(b.id, action);
  });

  const showBag = new Set(picked.map((b) => b.coffeeId)).size > 1;
  const showPerson = new Set(picked.map((b) => b.userId)).size > 1;
  const historyRows = picked.map((b) => {
    const tags = [b.id === baseline!.id ? '⭐ BASELINE' : '', best && b.id === best.id ? '🏆 BEST' : ''].filter(Boolean).join(' ');
    return formatBrewRow(b, {
      method: brewMethod,
      coffeesById,
      showBag,
      showPerson,
      userNames: input.userNames,
      tags,
      guidanceBefore: guidanceBefore.get(b.id),
    });
  });

  const doseBandMatch = profileLines.join(' ').match(/dose (\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)g/);
  const ledger = buildSettingsLedger({
    coffeeBrews,
    householdBrews: input.householdBrews,
    method: brewMethod,
    equipment,
    coffeesById,
    doseBand: doseBandMatch ? +doseBandMatch[2] - +doseBandMatch[1] : undefined,
  });

  return { mode, coffee, brewMethod, baseline, equipment, historyRows, historyBrews: picked, ledger, profileLines, profileLabel, grinderHistory: [], grinderLine };
}

// ---------------------------------------------------------------------------
// Rules and prompts
// ---------------------------------------------------------------------------

export function buildBrewRules(brewMethod: string): string {
  const espressoFlow = brewMethod === 'espresso'
    ? `\n   - Flow behavior / puck preparation (if flow issues indicate channeling, address distribution, tamping, or pre-infusion before changing core parameters)`
    : '';
  const immersionTime = brewMethod === 'immersion' ? `\n   - Steep time` : '';

  return `
IMPORTANT CONSIDERATIONS:
1. Focus on the BASELINE BREW (marked ⭐ BASELINE): Your suggestions should specifically address how to improve THIS brew. Use the brew history to understand what has been tried.
2. Equipment: Consider grinder scale direction (some use lower numbers for finer, others higher), sensitivity (stepless grinders like Niche Zero are highly sensitive ~0.5 adjustments, stepped grinders need 2-3 step adjustments), and brewer characteristics when making suggestions. When a GRINDER line is given, follow its direction and setting format, but write grind settings exactly the way the brew history writes them (same notation and letter case).
3. Hold or move (decide this first; the goal is Excellent, so Decent is not a reason to hold):
   - Hold (repeat the baseline settings) only when the baseline is Excellent, or when it is a single Bad cup at settings that were Decent or better before (similar grind, dose, ratio and time) and its notes name no new defect; then use Medium or Low confidence and don't do it twice in a row. Never hold just to re-taste or collect a rating.
   - Move toward better brews: if an earlier brew of this coffee was rated higher than the baseline, the first suggestion moves toward that brew's settings, starting with the parameter that differs most. Reverting to a proven setting is not repetition. Say which parameters stay unchanged because the best brews share them.
   - Unrated baseline: the cup is gone, so never ask to re-taste or rate it, and don't guess how it tasted. Count every Decent or better brew as rated higher (the most recent one when tied): hold only if the best rated brews used these settings; otherwise move toward the best as above. If the baseline already matches it, or nothing is rated Decent, keep fixing the last recorded defect. You may add one alternative for a different outcome (e.g. "if it turned bitter instead, go back to 5.2").
   - Mixed outcomes at the same settings mean execution or bean variance: name a recipe cause only when it is the single recorded difference, and don't treat the mix as a reason to hold when a better-rated brew used different settings. Never propose settings listed as consistently Bad.
   - No repeated small steps: if the same parameter and direction was suggested in any of the three prior brews without improvement, escalate (~2× the prior step) and say why, or switch to another parameter from the decision hierarchy.
4. NO BREW IDs: Do not reference brew numbers (like "Brew #1" or "#3") in your response. When referring to previous brews, use descriptive terms like "previous attempts", "an earlier excellent brew", etc. The user does not have access to brew numbers.
5. Baseline Brew Terminology: When referring to the baseline brew in your summary or suggestions, always use the term "baseline brew". This brew is the starting point for improvement suggestions.
6. Do not infer causes that are not supported by recorded data.
7. Evidence order when sources disagree: the baseline brew, then this coffee's tried settings and history, then the brewer's preferences. Lines marked "low sample" are hints, not targets.
8. Bean age: days off roast is a freshness signal only for room-temperature beans. For frozen beans, do not attribute taste to age.
9. Keep any parameter listed as the brewer's standard inside its band unless history shows the band causes the problem.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless rule 3 or the history points elsewhere; default to small steps for the first attempt at a parameter, then escalate per rule 3):
   - Grind setting${espressoFlow}
   - Final weight / ratio${immersionTime}
   - Water temperature
   - Dose

B) Require directional reasoning (no vague advice):
   - Each suggestion must specify the exact direction and a small magnitude that fits the grinder/equipment (example: "Grind finer by ~0.3–0.5 on Niche Zero").
   - Each suggestion must include the expected taste/texture impact in the brewer's own tasting-note words where possible (example: "should fix the lack of sweetness").

C) Confidence score:
   - Every suggestion must include a confidence score: High / Medium / Low.
   - Use "High" only when supported by at least two prior brews or a direct comparison.
   - Downgrade confidence to Medium or Low whenever the most recent brew that followed a similar suggestion regressed in quality, or whenever the suggested direction would push past a known-good baseline value (e.g. a previous excellent brew used a coarser grind than what you're proposing).

D) Primary failure mode:
   - Identify exactly ONE primary failure mode for the baseline brew (e.g., "under-extracted due to fast flow" or "over-extracted due to excessive yield"). All suggestions must directly address it.
   - Re-derive this from the baseline brew's recorded outcome alone (for an unrated baseline, from the brews rule 3 points to); do not carry forward the diagnosis from any prior brew. If the same diagnosis recurs across consecutive brews despite parameter changes, treat that as evidence the diagnosis itself is wrong and consider an alternative cause (e.g. dose / ratio rather than grind, or puck preparation).

E) Quality over quantity:
   - If fewer than three high-quality, non-redundant suggestions exist, provide fewer.
   - It is acceptable to provide only 1-2 suggestions if those are the most impactful.
   - Do not suggest adjusting parameters that are already optimal or not contributing to the issue.`;
}

const TONE = `WRITING STYLE:
- Write for a home brewer: plain, everyday words and short sentences.
- Avoid jargon. Use the words the brewer already uses in their notes and recipe.
- Sound like a person talking, not a report. Skip filler and stock phrases.
- Use commas and periods, not dashes.
- Every sentence should say what to do or why.`;

function coffeeBlock(ctx: GuidanceContext): string {
  const c = ctx.coffee;
  return `COFFEE:
- Name: ${c.name}
- Roaster: ${c.roaster}
- Brew Method: ${ctx.brewMethod}${c.region ? `\n- Region: ${c.region}` : ''}${c.roastLevel ? `\n- Roast Level: ${c.roastLevel}` : ''}${c.notes ? `\n- Flavor Notes: ${c.notes}` : ''}`;
}

export const IMPROVEMENT_SYSTEM = 'You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.';
export const FIRST_BREW_SYSTEM = 'You are an expert barista helping set up initial brew parameters for a new coffee. Provide specific, actionable starting parameters grounded in this brewer\'s own past brews on this equipment.';

export function buildImprovementPrompt(ctx: GuidanceContext): { system: string; user: string } {
  const sections = [
    'You are an expert barista analyzing the brew history for a specific coffee to provide improvement suggestions.',
    coffeeBlock(ctx),
    ...(ctx.grinderLine ? [`GRINDER: ${ctx.grinderLine}`] : []),
    'GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.',
    `BREW HISTORY (most recent first; ⭐ BASELINE is the brew to improve, 🏆 BEST is the best recorded brew):\n${ctx.historyRows.join('\n')}`,
  ];
  if (ctx.ledger.length) {
    sections.push(`TRIED SETTINGS (this coffee on this setup, near-identical settings grouped):\n${ctx.ledger.map((c) => c.line).join('\n')}`);
  }
  if (ctx.profileLines.length) {
    sections.push(`BREWER PREFERENCES (${ctx.profileLabel}):\n${ctx.profileLines.map((l) => `- ${l}`).join('\n')}`);
  }
  sections.push(buildBrewRules(ctx.brewMethod).trim(), TONE);
  return { system: IMPROVEMENT_SYSTEM, user: sections.join('\n\n') };
}

export function firstBrewParameterNames(brewMethod: string): string[] {
  const names = ['Grind Setting', 'Dosage', 'Water Temperature', brewMethod === 'immersion' ? 'Steep Time' : 'Brew Time', 'Final Weight/Ratio'];
  if (brewMethod === 'pour over') names.push('Pour Structure');
  return names;
}

export function buildFirstBrewPrompt(ctx: GuidanceContext): { system: string; user: string } {
  const eq = ctx.equipment;
  const sections = [
    'You are helping a barista brew a coffee for the first time. Suggest starting parameters with a high probability of a well-balanced brew (≈3/3 stars) on the first attempt, with room for easy adjustment.',
    `${coffeeBlock(ctx)}${eq.brewerName ? `\n- Brewing Equipment: ${eq.brewerName}` : ''}${eq.grinderName ? `\n- Grinder: ${ctx.grinderLine ?? eq.grinderName}` : ''}`,
  ];
  if (ctx.grinderHistory.length) {
    sections.push(`COFFEES RECENTLY BREWED ON THIS GRINDER (${ctx.brewMethod}, newest first):\n${ctx.grinderHistory.join('\n')}`);
  }
  if (ctx.profileLines.length) {
    sections.push(`BREWER PREFERENCES (${ctx.profileLabel}):\n${ctx.profileLines.map((l) => `- ${l}`).join('\n')}`);
  }
  const grind = ctx.grinderHistory.length
    ? `- Set the grind from the pattern across this grinder's coffees, not from any single one: different coffees land at different settings. Weigh coffees closest in roast to this one, correct for whether their brews ran slower or faster than the time you're targeting, and favor recent coffees, since they show where the dial sits now.
- Take dose, ratio, time, temperature and any pour pattern from the brewer's preferences when given.
- Past brews of other coffees are evidence, not the story. Explain each value in terms of this coffee and the brewer's brews as a whole, without pointing to one particular past coffee.`
    : `- When grinders use numeric dials, assume typical real-world ranges for that grinder and method, then pick the best starting point.
- Assume grinder is calibrated to factory default unless stated otherwise.`;
  sections.push(`GUIDELINES:
- Adapt recommendations to the brew method (espresso, pour-over, immersion, etc.).
- Commit to one primary recommended value per parameter.
- Use narrow ranges only when unavoidable (e.g., brew time).
- Prefer forgiving starting points that avoid stalled flow, over-extraction, or under-extraction.
${grind}
- Keep any parameter listed as the brewer's standard inside its band. Lines marked "low sample" are hints, not targets.
- Days off roast is a freshness signal only for room-temperature beans; frozen beans don't age meaningfully.
- Provide exactly these parameters, in this order: ${firstBrewParameterNames(ctx.brewMethod).join(', ')}.`);
  sections.push(TONE);
  return { system: FIRST_BREW_SYSTEM, user: sections.join('\n\n') };
}

// ---------------------------------------------------------------------------
// Output schemas
// ---------------------------------------------------------------------------

const CONFIDENCE = { type: 'string', enum: ['High', 'Medium', 'Low'] };

const BASIS = {
  type: 'array',
  items: { type: 'string' },
  description: '1-2 short phrases naming the evidence behind the first suggestion, citing dates exactly as written in the prompt (e.g. "tried 18.2g / 1:1.8 on Apr 16: Decent twice", "3 similar lighter-roast beans on the V60"). Empty array if nothing specific.',
};

const FIRST_BREW_BASIS = {
  type: 'array',
  items: { type: 'string' },
  description: "One short, plain phrase saying which of the brewer's past brews the recipe draws on, as a group rather than by coffee. Name the source, not the reasoning. Empty array if there were none.",
};

export const IMPROVEMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'primaryIssue', 'concise', 'suggestions', 'basis'],
  properties: {
    summary: {
      type: 'string',
      description: "1-2 sentences. State the outcome (quality rating and key tasting notes) and what was missing or wrong. No hedging language like 'likely', 'suggests', 'step in the right direction'. Collapse cause and effect into one sentence.",
    },
    primaryIssue: {
      type: 'string',
      description: "The one primary failure mode, e.g. 'under-extracted due to fast flow' or 'over-extracted due to excessive yield'.",
    },
    concise: {
      type: 'object',
      additionalProperties: false,
      required: ['goal', 'action', 'confidence'],
      properties: {
        goal: { type: 'string', description: "Exactly 2-3 words: the goal of the first suggestion, e.g. 'Reduce sourness', 'Increase body', 'Fix channeling'." },
        action: { type: 'string', description: "Exactly 2-4 words: the first suggestion's action without magnitude, e.g. 'Grind finer', 'Increase temperature', 'Reduce final weight'." },
        confidence: { ...CONFIDENCE, description: "Same as the first suggestion's confidence." },
      },
    },
    suggestions: {
      type: 'array',
      description: '1-3 high-quality, non-redundant suggestions ordered by importance; the first is the highest-impact change. Each follows Action → Expected effect → Why it matters (from history).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['parameter', 'action', 'effect', 'reasoning', 'confidence'],
        properties: {
          parameter: { type: 'string', description: 'Parameter name.' },
          action: { type: 'string', description: 'Action with specific magnitude, starting with an imperative verb (no period at end).' },
          effect: { type: 'string', description: "Expected taste/texture effect as a complete sentence starting with 'This will' or 'This should' (no period at end)." },
          reasoning: { type: 'string', description: 'One concise sentence on why this works based on brew history. No brew numbers (no period at end).' },
          confidence: CONFIDENCE,
        },
      },
    },
    basis: BASIS,
  },
};

export function buildFirstBrewSchema(brewMethod: string) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['introduction', 'parameters', 'note', 'basis'],
    properties: {
      introduction: {
        type: 'string',
        description: '1-2 short sentences on what makes this coffee distinctive and what this starting recipe aims for.',
      },
      parameters: {
        type: 'array',
        description: `Exactly these parameters in order: ${firstBrewParameterNames(brewMethod).join(', ')}.`,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'recommendation', 'explanation'],
          properties: {
            name: { type: 'string', enum: firstBrewParameterNames(brewMethod) },
            recommendation: { type: 'string', description: 'One specific value with its unit. Write grind the way this grinder\'s settings are written, and give final weight in grams with the ratio.' },
            explanation: { type: 'string', description: 'One short sentence on why this value suits this coffee.' },
          },
        },
      },
      note: { type: 'string', description: 'One sentence on how to adjust from here (grind first, then ratio or time, based on taste and flow).' },
      basis: FIRST_BREW_BASIS,
    },
  };
}

// ---------------------------------------------------------------------------
// Output normalization
// ---------------------------------------------------------------------------

export interface ImprovementResult {
  concise: { goal: string; action: string; confidence: 'High' | 'Medium' | 'Low' };
  full: { summary: string; primaryIssue: string; suggestions: any[]; basis: string[] };
}

const MONTH_PATTERN = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})\b/g;

/** Drop basis strings that cite a date absent from the prompt. */
export function filterBasis(basis: unknown, promptText: string): string[] {
  if (!Array.isArray(basis)) return [];
  return basis
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .filter((s) => {
      for (const m of s.matchAll(MONTH_PATTERN)) {
        if (!promptText.includes(`${m[1].slice(0, 3)} ${+m[2]}`)) return false;
      }
      return true;
    })
    .slice(0, 2);
}

/** Validate and normalize improvement output. Keeps the model's suggestion order. */
export function normalizeImprovement(parsed: any, promptText: string): ImprovementResult | null {
  if (!parsed?.summary || !parsed?.primaryIssue || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
    return null;
  }
  const suggestions = parsed.suggestions.slice(0, 3);
  const first = suggestions[0];
  const concise = parsed.concise?.goal && parsed.concise?.action
    ? { goal: parsed.concise.goal, action: parsed.concise.action, confidence: first.confidence }
    : { goal: 'Improve balance', action: String(first.action ?? '').split(/\s+/).slice(0, 4).join(' '), confidence: first.confidence };
  return {
    concise,
    full: {
      summary: parsed.summary,
      primaryIssue: parsed.primaryIssue,
      suggestions,
      basis: filterBasis(parsed.basis, promptText),
    },
  };
}

export function normalizeFirstBrew(parsed: any, promptText: string): any | null {
  if (!parsed?.introduction || !Array.isArray(parsed.parameters) || parsed.parameters.length === 0) return null;
  return { ...parsed, basis: filterBasis(parsed.basis, promptText) };
}

// ---------------------------------------------------------------------------
// Bag extraction
// ---------------------------------------------------------------------------

export interface KnownCoffee {
  roaster: string;
  name: string;
}

const KNOWN_LIST_LIMIT = 300;
const clip = (s: unknown) => String(s ?? '').trim().slice(0, 120);

/** Drops blanks, duplicates and oversized lists from client-supplied known names. */
export function sanitizeKnownNames(knownRoasters: unknown, knownCoffees: unknown): { roasters: string[]; coffees: KnownCoffee[] } {
  const roasters = Array.isArray(knownRoasters)
    ? [...new Map(knownRoasters.map(clip).filter(Boolean).map((r) => [norm(r), r])).values()]
    : [];
  const coffees = Array.isArray(knownCoffees)
    ? [
        ...new Map(
          knownCoffees
            .map((c: any) => ({ roaster: clip(c?.roaster), name: clip(c?.name) }))
            .filter((c) => c.roaster && c.name)
            .map((c) => [`${norm(c.roaster)}|${norm(c.name)}`, c]),
        ).values(),
      ]
    : [];
  return { roasters: roasters.slice(0, KNOWN_LIST_LIMIT), coffees: coffees.slice(0, KNOWN_LIST_LIMIT) };
}

export function buildBagExtractionPrompt(opts: { today: string; knownRoasters?: string[]; knownCoffees?: KnownCoffee[] }): string {
  const roasters = opts.knownRoasters ?? [];
  const coffees = opts.knownCoffees ?? [];
  let text = `Analyze the coffee bag image(s) and extract:
1. Roaster: the company that roasted the coffee.
2. Name: the specific coffee offering.
3. Roast date in YYYY-MM-DD. If the year is missing, assume the most recent past occurrence of that date (this year if it hasn't passed yet, otherwise last year). Today is ${opts.today}.
4. Region: format each origin as "Country (Sub-region)" using the single most specific named area on the bag, e.g. "Colombia (Nariño)" or "Ethiopia (Guji)". Use just "Country" when no sub-region is printed. Separate multiple origins with commas, e.g. "Brazil (Cerrado), Ethiopia (Sidama)". No commas inside the parentheses.
5. Tasting notes: the flavor descriptors printed on the bag, comma-separated.
6. Roast level: one of Light, Medium-Light, Medium, Medium-Dark, Dark, only if printed or clearly indicated on the bag.

Use an empty string for any field you cannot find.`;

  if (roasters.length || coffees.length) {
    text += `

NAMING (keep names consistent with coffees this household already has):
- Roaster: if the bag's roaster matches a known roaster ignoring case and suffixes like "Coffee", "Roasters", "Roastery", "Co." or "Coffee Co.", return the known spelling exactly. Otherwise transcribe it as printed.
- Name: return a known coffee's exact name only when the roaster matches and the bag shows the same offering, ignoring case and punctuation. A different lot, process, farm or variety word (for example "Guji" vs "Guji Natural") means a different coffee: transcribe the bag's name as printed.`;
    if (roasters.length) text += `\n\nKNOWN ROASTERS:\n${roasters.map((r) => `- ${r}`).join('\n')}`;
    if (coffees.length) text += `\n\nKNOWN COFFEES (roaster — name):\n${coffees.map((c) => `- ${c.roaster} — ${c.name}`).join('\n')}`;
  }
  return text;
}

export const BAG_EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['roaster', 'name', 'roastDate', 'region', 'notes', 'roastLevel'],
  properties: {
    roaster: { type: 'string' },
    name: { type: 'string' },
    roastDate: { type: 'string', description: 'YYYY-MM-DD, or empty string.' },
    region: { type: 'string', description: 'Country (Sub-region), comma-separated for multiple origins, or empty string.' },
    notes: { type: 'string', description: 'Comma-separated tasting notes, or empty string.' },
    roastLevel: { type: 'string', enum: [...ROAST_LEVELS, ''] },
  },
};

// ---------------------------------------------------------------------------
// Grinder profiles
// ---------------------------------------------------------------------------

// Typical grind ranges and step sizes are left out on purpose: calibration shifts ranges
// (docs/ai-analysis/grinder-knowledge-eval.md), and the example setting shows the increments.
// Bump GRINDER_PROFILE_VERSION when the prompt or schema changes; older profiles are regenerated.
export const GRINDER_PROFILE_VERSION = 2;

export type GrinderDirection = 'higher-is-coarser' | 'higher-is-finer' | 'unknown';

export interface GrinderProfile {
  recognized: boolean;
  direction: GrinderDirection;
  settingFormat: string;
}

export interface StoredGrinderProfile {
  name: string;
  version: number;
  profile: GrinderProfile;
  model: string;
  searches: number;
  /** Pages web search cited; kept out of `settingFormat` so prompts only see prose. */
  sources: string[];
  generatedAt: string;
}

export const isCurrentGrinderProfile = (stored: StoredGrinderProfile | null | undefined): boolean =>
  stored?.version === GRINDER_PROFILE_VERSION;

const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g;

const cleanUrl = (url: string): string => url.replace(/[?&]utm_source=openai$/, '').replace(/\?utm_source=openai&/, '?');

/** Splits web-search citations out of model prose: "(see [site](url))" becomes plain text plus a URL list. */
export function stripCitations(text: string): { text: string; urls: string[] } {
  const urls = [...text.matchAll(MARKDOWN_LINK)].map((m) => cleanUrl(m[2]));
  const cleaned = text
    .replace(/\s*\(\[[^\]]*\]\([^)\s]+\)\)/g, '')
    .replace(MARKDOWN_LINK, '$1')
    .replace(/\s+([.,;])(?=\s|$)/g, '$1')
    .replace(/\.{2,}/g, '.')
    .trim();
  return { text: cleaned, urls };
}

/** Display name the app stores on equipment and brews (company + model, or the legacy name). */
export function grinderLabel(e: { company?: string; model?: string; name?: string }): string {
  return (e.company && e.model ? `${e.company} ${e.model}` : e.name ?? '').trim();
}

/** Shared across households: the profile describes the grinder model, not anyone's settings. */
export function grinderProfileKey(name: string): string | null {
  const key = norm(name).replace(/[^a-z0-9]/g, '');
  return key ? `grinder-profile:${key}` : null;
}

export function buildGrinderProfilePrompt(name: string): string {
  return `Grinder: "${name}" (as typed by a home coffee app user; it may be a machine with a built-in grinder).

A dial-in assistant will write grind targets as settings on this grinder. It needs two facts: whether a higher setting means coarser or finer, and how a setting is written.

Search the web even if you know this model: details differ between versions (a "+", "Gen 2" or "Pro" can change the scale). Check the manufacturer's product page, FAQ or manual first, then retailer listings, reviews, forums (Home-Barista, Reddit) and video descriptions. Manuals are often unreadable PDFs, so don't stop there. Accept a fact when the manufacturer states it or two independent sources agree. Answer "unknown" only if sources are missing or conflict; do not guess.

Do not describe which way to turn the knob or collar; the brewer knows how to operate their grinder.`;
}

export const GRINDER_PROFILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recognized', 'direction', 'settingFormat'],
  properties: {
    recognized: { type: 'boolean', description: 'True only if the name identifies a specific grinder model.' },
    direction: {
      type: 'string',
      enum: ['higher-is-coarser', 'higher-is-finer', 'unknown'],
      description: 'What a higher setting means; a later letter or extra revolution counts as higher. For unnumbered dials, the direction of the count users usually record (e.g. dots from burr zero); unknown if there is no common convention.',
    },
    settingFormat: {
      type: 'string',
      description: "One or two sentences: the printed scale, what lies between the marks (stepless, or N clicks), anything else needed to write a setting (letters, revolutions), and one example setting taken from this grinder's own range. If settings include letters, say which letter is finest. Do not describe which way to turn, no links. E.g. 'Stepless dial printed 0–50; fractional settings are fine, e.g. 15.5.'",
    },
  },
};

/** Responses API body: web search is available, the prompt tells the model to use it only when unsure. */
export function buildGrinderProfileRequest(name: string, model: string = MODEL): Record<string, unknown> {
  return {
    model,
    input: [{ role: 'user', content: buildGrinderProfilePrompt(name) }],
    reasoning: { effort: 'low' },
    tools: [{ type: 'web_search' }],
    text: { format: { type: 'json_schema', name: 'grinder_profile', schema: GRINDER_PROFILE_SCHEMA, strict: true } },
  };
}

export function parseGrinderProfileResponse(name: string, model: string, data: any, now: Date = new Date()): StoredGrinderProfile {
  const output = Array.isArray(data?.output) ? data.output : [];
  const content = output.find((i: any) => i.type === 'message')?.content?.find((c: any) => c.type === 'output_text');
  if (!content?.text) throw new Error(`No grinder profile in response for "${name}"`);
  const profile: GrinderProfile = JSON.parse(content.text);
  const { text, urls } = stripCitations(profile.settingFormat);
  const cited = (content.annotations ?? []).filter((a: any) => a.type === 'url_citation' && a.url).map((a: any) => cleanUrl(String(a.url)));
  return {
    name,
    version: GRINDER_PROFILE_VERSION,
    profile: { ...profile, settingFormat: text },
    model,
    searches: output.filter((i: any) => i.type === 'web_search_call').length,
    sources: [...new Set([...urls, ...cited])],
    generatedAt: now.toISOString(),
  };
}

/** One prompt line for the grinder, or null when there is no current, recognized profile. */
export function formatGrinderLine(name: string, stored: StoredGrinderProfile | null | undefined): string | null {
  if (!isCurrentGrinderProfile(stored) || !stored!.profile.recognized) return null;
  const { direction, settingFormat } = stored!.profile;
  const directionText =
    direction === 'higher-is-coarser' ? 'higher numbers are coarser'
    : direction === 'higher-is-finer' ? 'higher numbers are FINER'
    : "dial direction unknown: say 'grind finer' or 'grind coarser' without a target number";
  return `${name}: ${directionText}. ${settingFormat.trim().replace(/\.?$/, '.')}`;
}
