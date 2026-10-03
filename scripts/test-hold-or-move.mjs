#!/usr/bin/env node
/**
 * Hold-or-move eval: replay every brew in the household with later brews hidden, generate
 * guidance with the current prompt, apply the first suggestion (shared applier), and score:
 *   bad holds      held although an earlier, better-rated brew used different settings
 *   toward earlier whether the move went toward that better brew
 *   toward later   whether it went toward the next better brew you actually found (noisy:
 *                  later best brews often came from unrelated recipe changes)
 *   Excellent held, and unrated baselines answered with "rate it" instead of a next step
 *
 * Usage:
 *   node scripts/test-hold-or-move.mjs --label after [--only newest|unrated] [--coffee Arboretum]
 * Writes tmp/hold-loop/<label>.json and a per-brew .txt for reading the cases.
 */
import fs from "node:fs/promises";
import * as P from "../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { loadHousehold } from "./lib/household.mjs";
import { applyFirstSuggestion, argValue, generateGuidance, mapLimit } from "./lib/guidanceArms.mjs";

const LABEL = argValue("--label", "run");
const ONLY = argValue("--only");
const CONCURRENCY = parseInt(argValue("--concurrency", "8"), 10);
const COFFEE = argValue("--coffee");
const arm = { version: "new", model: P.MODEL, label: `new:${P.MODEL}` };

const hh = await loadHousehold();
const coffeesById = new Map(hh.coffees.map((c) => [c.id, c]));
const num = (v) => (typeof v === "number" ? v : parseFloat(String(v ?? "")));
const byOldest = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
const q = (b) => b.quality ?? 0;
const settings = (b) => ({ grindSetting: num(b.grindSetting), dosage: num(b.dosage), finalWeight: num(b.finalWeight), waterTemp: num(b.waterTemp) });
const label = (b) => P.qualityLabel(b.quality);

const grinderRange = new Map();
for (const b of hh.householdBrews) {
  const g = num(b.grindSetting);
  if (!Number.isFinite(g)) continue;
  const k = b.grinderId || b.grinderName;
  const r = grinderRange.get(k) ?? [g, g];
  grinderRange.set(k, [Math.min(r[0], g), Math.max(r[1], g)]);
}
const tolerances = (b) => {
  const r = grinderRange.get(b.grinderId || b.grinderName) ?? [0, 10];
  return { grind: Math.max(0.05 * (r[1] - r[0]), 0.05), ratio: b.brewMethod === "espresso" ? 0.1 : 0.5 };
};
const distance = (s, t, tol) => {
  let d = Math.abs(s.grindSetting - t.grindSetting) / tol.grind;
  d += Math.abs(s.dosage - t.dosage) / (0.02 * t.dosage);
  d += Math.abs(s.finalWeight / s.dosage - t.finalWeight / t.dosage) / tol.ratio;
  if (Number.isFinite(s.waterTemp) && Number.isFinite(t.waterTemp)) d += Math.abs(s.waterTemp - t.waterTemp) / 2;
  return d;
};
const towards = (cur, next, target, tol) => {
  const before = distance(cur, target, tol), after = distance(next, target, tol);
  return after < before - 0.5 ? "closer" : after > before + 0.5 ? "farther" : "same";
};
const differs = (a, b, tol) => distance(settings(a), settings(b), tol) > 1.5;
const asksToRate = (full) => /\b(re-?taste|record (a|the|its) (star )?rating|rate the|taste and rate)\b/i.test(full.suggestions?.[0]?.action ?? "");

// Build cases: every complete brew, grouped by bean + method.
const groups = new Map();
for (const b of hh.householdBrews) {
  if (![b.grindSetting, b.dosage, b.finalWeight].every((v) => Number.isFinite(num(v)))) continue;
  const coffee = coffeesById.get(b.coffeeId);
  if (!coffee) continue;
  const ids = P.findSameCoffeeIds(coffee, hh.coffees, hh.aliases).sort();
  const key = `${ids[0]}|${b.brewMethod}`;
  if (!groups.has(key)) groups.set(key, { coffee, ids, brews: [] });
  groups.get(key).brews.push(b);
}
const cases = [];
for (const g of groups.values()) {
  g.brews.sort(byOldest);
  if (COFFEE && !`${g.coffee.roaster} ${g.coffee.name}`.toLowerCase().includes(COFFEE.toLowerCase())) continue;
  g.brews.forEach((b, i) => {
    if (ONLY === "newest" && i !== g.brews.length - 1) return;
    if (ONLY === "unrated" && b.quality) return;
    const earlier = g.brews.slice(0, i);
    const later = g.brews.slice(i + 1);
    const tol = tolerances(b);
    const earlierBetter = earlier.filter((x) => q(x) > q(b) && q(x) >= 2 && differs(x, b, tol)).sort((x, y) => q(y) - q(x) || byOldest(y, x))[0];
    const laterBetter = later.filter((x) => q(x) > q(b) && q(x) >= 2).sort((x, y) => q(y) - q(x) || byOldest(x, y))[0];
    cases.push({ group: g, brew: b, index: i, count: g.brews.length, tol, earlierBetter, laterBetter, newest: i === g.brews.length - 1 });
  });
}
console.log(`[${LABEL}] ${cases.length} cases across ${groups.size} bean/method groups`);

const results = await mapLimit(cases, CONCURRENCY, async (c) => {
  const b = c.brew;
  const cutoff = new Date(b.createdAt);
  const householdBrews = hh.householdBrews.filter((x) => new Date(x.createdAt) <= cutoff);
  try {
    const g = await generateGuidance(arm, {
      coffee: coffeesById.get(b.coffeeId),
      coffees: hh.coffees,
      householdBrews,
      brewMethod: b.brewMethod,
      sameCoffeeIds: c.group.ids,
      baselineId: b.id,
      requesterUserId: b.userId,
      userNames: hh.userNames,
      grinderProfiles: hh.grinderProfiles,
      effort: "medium",
      now: cutoff,
    });
    const first = g.full.suggestions[0];
    const applied = await applyFirstSuggestion({ method: b.brewMethod, grinderName: b.grinderName, settings: settings(b), suggestion: first });
    const next = { grindSetting: applied.grindSetting, dosage: applied.dosage, finalWeight: applied.finalWeight, waterTemp: applied.waterTemp };
    return {
      id: b.id,
      coffee: `${c.group.coffee.roaster} — ${c.group.coffee.name} (${b.brewMethod})`,
      index: c.index,
      count: c.count,
      newest: c.newest,
      quality: b.quality ?? null,
      notes: b.tastingNotes ?? "",
      current: settings(b),
      kind: applied.kind,
      next,
      action: first.action,
      concise: g.concise,
      asksToRate: asksToRate(g.full),
      earlierBetter: c.earlierBetter ? { quality: c.earlierBetter.quality, settings: settings(c.earlierBetter), towards: towards(settings(b), next, settings(c.earlierBetter), c.tol) } : null,
      laterBetter: c.laterBetter ? { quality: c.laterBetter.quality, settings: settings(c.laterBetter), towards: towards(settings(b), next, settings(c.laterBetter), c.tol) } : null,
    };
  } catch (e) {
    return { id: b.id, error: e.message };
  }
});

const ok = results.filter((r) => !r.error);
const pct = (a, n) => (n ? `${Math.round((100 * a) / n)}%` : "–");
const holdish = (r) => r.kind !== "change";
const excellent = ok.filter((r) => r.quality === 3);
const unrated = ok.filter((r) => !r.quality);
const withEarlier = ok.filter((r) => r.earlierBetter);
const withLater = ok.filter((r) => r.laterBetter);
const summary = {
  label: LABEL,
  n: ok.length,
  errors: results.length - ok.length,
  holds: ok.filter(holdish).length,
  badHolds: withEarlier.filter(holdish).length,
  withEarlier: withEarlier.length,
  earlierCloser: withEarlier.filter((r) => r.earlierBetter.towards === "closer").length,
  earlierFarther: withEarlier.filter((r) => r.earlierBetter.towards === "farther").length,
  withLater: withLater.length,
  laterCloser: withLater.filter((r) => r.laterBetter.towards === "closer").length,
  laterFarther: withLater.filter((r) => r.laterBetter.towards === "farther").length,
  excellent: excellent.length,
  excellentHolds: excellent.filter(holdish).length,
  unrated: unrated.length,
  unratedAsksToRate: unrated.filter((r) => r.asksToRate).length,
  unratedHolds: unrated.filter(holdish).length,
};
const ratedLater = withLater.filter((r) => r.quality);
console.log(`
- Holds: ${summary.holds}/${summary.n}
- Rated baselines toward the next better brew: closer ${pct(ratedLater.filter((r) => r.laterBetter.towards === "closer").length, ratedLater.length)}, farther ${pct(ratedLater.filter((r) => r.laterBetter.towards === "farther").length, ratedLater.length)} (n=${ratedLater.length})
- Bad holds (an earlier, better-rated brew used different settings): ${summary.badHolds}/${summary.withEarlier}
- Toward that earlier better brew: closer ${pct(summary.earlierCloser, summary.withEarlier)}, farther ${pct(summary.earlierFarther, summary.withEarlier)}
- Toward the next better brew found later: closer ${pct(summary.laterCloser, summary.withLater)}, farther ${pct(summary.laterFarther, summary.withLater)} (n=${summary.withLater})
- Excellent baselines held: ${summary.excellentHolds}/${summary.excellent}
- Unrated baselines: ${summary.unratedHolds}/${summary.unrated} held, ${summary.unratedAsksToRate} only ask to rate/re-taste
- Errors: ${summary.errors}`);

const fmtS = (s) => `${s.grindSetting} · ${s.dosage}g→${s.finalWeight}g${Number.isFinite(s.waterTemp) ? ` · ${s.waterTemp}°F` : ""}`;
const lines = ok.map((r) => {
  const flags = [
    holdish(r) && r.earlierBetter ? "BAD-HOLD" : "",
    !r.quality && r.asksToRate ? "ASKS-RATE" : "",
    r.quality === 3 && !holdish(r) ? "FIDDLE" : "",
    r.earlierBetter?.towards === "farther" ? "AWAY-FROM-EARLIER-BEST" : "",
  ].filter(Boolean);
  return `${flags.length ? "⚠ " + flags.join(",") : "  ok"} | ${r.coffee} #${r.index + 1}/${r.count} | ${P.qualityLabel(r.quality)}${r.notes ? ` (${r.notes})` : ""} @ ${fmtS(r.current)}
     ${r.kind}: ${r.action}${r.earlierBetter ? `\n     earlier ${P.qualityLabel(r.earlierBetter.quality)} @ ${fmtS(r.earlierBetter.settings)} → ${r.earlierBetter.towards}` : ""}${r.laterBetter ? `\n     later ${P.qualityLabel(r.laterBetter.quality)} @ ${fmtS(r.laterBetter.settings)} → ${r.laterBetter.towards}` : ""}`;
});
await fs.mkdir("tmp/hold-loop", { recursive: true });
await fs.writeFile(`tmp/hold-loop/${LABEL}.json`, JSON.stringify({ summary, results }, null, 1));
await fs.writeFile(`tmp/hold-loop/${LABEL}.txt`, lines.join("\n"));
console.log(`\nwrote tmp/hold-loop/${LABEL}.{json,txt}`);
