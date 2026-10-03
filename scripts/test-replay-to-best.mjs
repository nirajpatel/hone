#!/usr/bin/env node
/**
 * Replay eval: would the guidance have reached each coffee's best brew in fewer attempts?
 *
 * For every coffee dialed in on one setup, start from its real first brew and loop:
 *   1. Ask an arm (old/new prompt × model) for guidance on the latest brew.
 *   2. Apply only the first suggestion to get the next settings (shared applier model).
 *   3. Look up the outcome from the nearest REAL brew of this coffee at those settings
 *      (tried-settings tolerances: grind 5% of the grinder's range, dose 2%, ratio ±0.1
 *      espresso / ±0.5 otherwise, water ±2°F). Repeat visits to the same settings
 *      replay that cluster's real outcomes in order, so variance is preserved.
 *   4. Stop when it lands on settings that produced a brew as good as the best (reached),
 *      proposes settings far from anything you brewed (off-map), or hits the cap
 *      (actual attempts + --extra-steps).
 *
 * Outcomes only exist where you actually brewed, so the closed loop measures how
 * efficiently guidance navigates your real history, not what an unbrewed recipe would
 * taste like. Within 2× tolerance the nearest brew's outcome is used ("approx", never
 * counts as reached); beyond that the outcome is unknown, so the run stops as off-map and
 * counts as not reaching the best. Inventing outcomes there would mislead later steps.
 *
 * Open-loop check (no outcome assumptions): at every real brew before the best one, give
 * the arm your actual history up to that brew and score whether its first suggestion
 * moves the settings closer to the best brew, and whether it lands on it.
 *
 * Usage:
 *   node scripts/test-replay-to-best.mjs --dry-run                 # list eligible coffees
 *   node scripts/test-replay-to-best.mjs                           # old:gpt-5.4 vs new:gpt-5.4
 *   node scripts/test-replay-to-best.mjs --arms old:gpt-5.4,new:gpt-5.4,new:gpt-6.1-sol --runs 2
 *   node scripts/test-replay-to-best.mjs --coffee Mazateca --verbose
 *
 * Writes docs/ai-analysis/replay-to-best.md and .json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as P from "../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { REPO_ROOT, loadHousehold, requireEnv, ANALYZE_USER_ID } from "./lib/household.mjs";
import {
  applyFirstSuggestion,
  argValue,
  fmt,
  generateGuidance,
  loadTuningCoffeeIds,
  mapLimit,
  mean,
  median,
  parseArms,
} from "./lib/guidanceArms.mjs";

requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANALYZE_USER_ID", ...(process.argv.includes("--dry-run") ? [] : ["OPENAI_API_KEY"]));

const DRY = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
const ARMS = parseArms(argValue("--arms", "old:gpt-5.4,new:gpt-5.4"));
const RUNS = parseInt(argValue("--runs", "1"), 10);
const CONCURRENCY = parseInt(argValue("--concurrency", "4"), 10);
const EFFORT = argValue("--effort", "medium");
const ONLY = argValue("--coffee");
const EXTRA_STEPS = parseInt(argValue("--extra-steps", "4"), 10);
const OUT_BASE = argValue("--out", "docs/ai-analysis/replay-to-best");

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : NaN;
};
const byOldest = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
const settingsOf = (b) => ({
  grindSetting: num(b.grindSetting),
  dosage: num(b.dosage),
  finalWeight: num(b.finalWeight),
  waterTemp: num(b.waterTemp),
});
const settingsFor = (c, b) => {
  const s = settingsOf(b);
  return Number.isFinite(s.waterTemp) ? s : { ...s, waterTemp: c.defaultTemp };
};
const complete = (b) => [b.grindSetting, b.dosage, b.finalWeight].every((v) => Number.isFinite(num(v)));

// ---------------------------------------------------------------------------
// Build replay cases: one per bean + method + setup that ended on a better brew
// than it started with.
// ---------------------------------------------------------------------------

const hh = await loadHousehold(ANALYZE_USER_ID);
const coffeesById = new Map(hh.coffees.map((c) => [c.id, c]));
const tuningIds = await loadTuningCoffeeIds();

function buildCases() {
  const seen = new Set();
  const cases = [];
  for (const coffee of hh.coffees) {
    const sameIds = P.findSameCoffeeIds(coffee, hh.coffees, hh.aliases);
    const groupKey = [...sameIds].sort().join(",");
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);
    const beanBrews = hh.householdBrews.filter((b) => sameIds.includes(b.coffeeId) && complete(b));
    const methods = [...new Set(beanBrews.map((b) => b.brewMethod))];
    for (const method of methods) {
      const methodBrews = beanBrews.filter((b) => b.brewMethod === method);
      const bestQ = Math.max(0, ...methodBrews.map((b) => b.quality || 0));
      if (bestQ < 2) continue;
      const firstBest = methodBrews.filter((b) => b.quality === bestQ).sort(byOldest)[0];
      const equipment = P.equipmentOf(firstBest);
      const brews = methodBrews.filter((b) => P.onSameEquipment(b, equipment)).sort(byOldest);
      const actualAttempts = brews.findIndex((b) => b.quality === bestQ) + 1;
      if (brews.length < 3 || actualAttempts < 2) continue;
      const first = brews[0];
      const startCoffee = coffeesById.get(first.coffeeId) ?? coffee;
      if (ONLY && !`${startCoffee.roaster} ${startCoffee.name}`.toLowerCase().includes(ONLY.toLowerCase())) continue;

      const grinderGrinds = hh.householdBrews
        .filter((b) => P.onSameEquipment(b, { grinderId: equipment.grinderId, grinderName: equipment.grinderName, brewerId: b.brewerId, brewerName: b.brewerName }))
        .map((b) => num(b.grindSetting))
        .filter(Number.isFinite);
      const grindTol = Math.max(0.05 * (Math.max(...grinderGrinds) - Math.min(...grinderGrinds)), 0.05);

      cases.push({
        id: `${startCoffee.id}:${method}`,
        label: `${startCoffee.roaster.trim()} — ${startCoffee.name}`,
        method,
        coffee: startCoffee,
        sameIds,
        equipment,
        brews,
        rated: brews.filter((b) => b.quality),
        bestQ,
        actualAttempts,
        cap: actualAttempts + EXTRA_STEPS,
        grindTol,
        defaultTemp: median(brews.map((b) => num(b.waterTemp)).filter(Number.isFinite)),
        ratioTol: method === "espresso" ? 0.1 : 0.5,
        set: sameIds.some((id) => tuningIds.has(id)) ? "tuning" : "hold-out",
      });
    }
  }
  return cases;
}

const cases = buildCases();
console.log(`[replay] ${cases.length} eligible coffees · arms ${ARMS.map((a) => a.label).join(", ")} · runs ${RUNS} · effort ${EFFORT}\n`);

if (DRY) {
  for (const c of cases) {
    console.log(
      `${c.set.padEnd(8)} ${c.label} [${c.method}] brews=${c.brews.length} best=${P.qualityLabel(c.bestQ)} at attempt ${c.actualAttempts} · grind tol ±${fmt(c.grindTol, 2)}`,
    );
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Outcome lookup against the real history
// ---------------------------------------------------------------------------

function distance(c, s, b) {
  const t = settingsOf(b);
  const doseTol = Math.max(0.02 * t.dosage, 0.2);
  return Math.max(
    Math.abs(s.grindSetting - t.grindSetting) / c.grindTol,
    Math.abs(s.dosage - t.dosage) / doseTol,
    Math.abs(s.finalWeight / s.dosage - t.finalWeight / t.dosage) / c.ratioTol,
    Number.isFinite(s.waterTemp) && Number.isFinite(t.waterTemp) ? Math.abs(s.waterTemp - t.waterTemp) / 2 : 0,
  );
}

function lookupOutcome(c, settings, visits) {
  const scored = c.rated.map((b) => ({ b, d: distance(c, settings, b) })).sort((x, y) => x.d - y.d);
  const exact = scored.filter((x) => x.d <= 1).map((x) => x.b).sort(byOldest);
  if (exact.length) {
    const key = exact.map((b) => b.id).join(",");
    const n = visits.get(key) ?? 0;
    visits.set(key, n + 1);
    return { brew: exact[n % exact.length], match: "exact", d: scored[0].d };
  }
  if (scored[0] && scored[0].d <= 2) return { brew: scored[0].b, match: "approx", d: scored[0].d };
  return { brew: null, match: "off-map", d: scored[0]?.d ?? Infinity };
}

// ---------------------------------------------------------------------------
// One trajectory
// ---------------------------------------------------------------------------

async function replay(c, arm) {
  const otherBrews = hh.householdBrews.filter((b) => !c.sameIds.includes(b.coffeeId));
  const visits = new Map();
  const first = { ...c.brews[0], id: "sim-1", suggestion: undefined };
  const sim = [first];
  const steps = [];
  let cost = 0;
  let latency = 0;
  let outcome = "cap";
  let attempts = c.cap + 1;

  for (let step = 2; step <= c.cap; step++) {
    const baseline = sim[sim.length - 1];
    const simDate = c.brews[step - 1]?.createdAt ?? new Date(new Date(c.brews.at(-1).createdAt).getTime() + (step - c.brews.length) * 86_400_000).toISOString();
    const householdBrews = [...otherBrews.filter((b) => b.createdAt < simDate), ...sim];

    const g = await generateGuidance(arm, {
      coffee: c.coffee,
      coffees: hh.coffees,
      householdBrews,
      coffeeBrews: sim,
      sameCoffeeIds: c.sameIds,
      baselineId: baseline.id,
      brewMethod: c.method,
      requesterUserId: baseline.userId,
      userNames: hh.userNames,
      grinderProfiles: hh.grinderProfiles,
      effort: EFFORT,
      now: new Date(simDate),
    });
    cost += g.costUsd;
    latency += g.elapsedMs;
    const top = g.full.suggestions[0];
    baseline.suggestion = { concise: { action: g.concise?.action ?? top.action }, full: g.full };

    const current = settingsFor(c, baseline);
    const applied = await applyFirstSuggestion({ method: c.method, grinderName: c.equipment.grinderName, settings: current, suggestion: top });
    cost += applied.costUsd;
    const next = { grindSetting: applied.grindSetting, dosage: applied.dosage, finalWeight: applied.finalWeight, waterTemp: applied.waterTemp };
    const found = lookupOutcome(c, next, visits);
    const before = Math.min(...c.rated.filter((b) => b.quality === c.bestQ).map((b) => distance(c, current, b)));
    const after = Math.min(...c.rated.filter((b) => b.quality === c.bestQ).map((b) => distance(c, next, b)));

    steps.push({
      step,
      suggestion: `[${top.parameter}] ${top.action} (${top.confidence})`,
      kind: applied.kind,
      next,
      match: found.match,
      matchedQuality: found.brew?.quality ?? null,
      matchedId: found.brew?.id ?? null,
      towardBest: after < before - 1e-9 ? "closer" : after > before + 1e-9 ? "farther" : "same",
    });
    if (VERBOSE) {
      console.log(
        `  ${arm.label} ${c.label} #${step}: ${steps.at(-1).suggestion} → ${applied.kind} g${next.grindSetting} ${next.dosage}g→${next.finalWeight}g ${next.waterTemp}°F · ${found.match} ${P.qualityLabel(found.brew?.quality)}`,
      );
    }

    if (!found.brew) {
      outcome = "off-map";
      break;
    }
    const scale = num(found.brew.finalWeight) ? next.finalWeight / num(found.brew.finalWeight) : 1;
    sim.push({
      ...found.brew,
      ...next,
      id: `sim-${step}`,
      createdAt: simDate,
      stages: Array.isArray(found.brew.stages) ? found.brew.stages.map((s) => ({ ...s, endWeight: Math.round(s.endWeight * scale * 10) / 10 })) : found.brew.stages,
      suggestion: undefined,
    });
    if (found.match === "exact" && found.brew.quality === c.bestQ) {
      outcome = "reached";
      attempts = step;
      break;
    }
  }

  return {
    coffee: c.label,
    set: c.set,
    method: c.method,
    actualAttempts: c.actualAttempts,
    cap: c.cap,
    outcome,
    attempts,
    steps,
    costUsd: cost,
    avgLatencyMs: steps.length ? latency / steps.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Open-loop check: real history up to each pre-best brew, one suggestion each
// ---------------------------------------------------------------------------

async function openLoop(c, arm) {
  const otherBrews = hh.householdBrews.filter((b) => !c.sameIds.includes(b.coffeeId));
  const bests = c.rated.filter((b) => b.quality === c.bestQ);
  const points = [];
  for (let k = 1; k < c.actualAttempts; k++) {
    const history = c.brews.slice(0, k);
    const baseline = history[k - 1];
    const g = await generateGuidance(arm, {
      coffee: c.coffee,
      coffees: hh.coffees,
      householdBrews: [...otherBrews.filter((b) => b.createdAt < baseline.createdAt), ...history],
      coffeeBrews: history,
      sameCoffeeIds: c.sameIds,
      baselineId: baseline.id,
      brewMethod: c.method,
      requesterUserId: baseline.userId,
      userNames: hh.userNames,
      grinderProfiles: hh.grinderProfiles,
      effort: EFFORT,
      now: new Date(baseline.createdAt),
    });
    const top = g.full.suggestions[0];
    const current = settingsFor(c, baseline);
    const applied = await applyFirstSuggestion({ method: c.method, grinderName: c.equipment.grinderName, settings: current, suggestion: top });
    const next = { grindSetting: applied.grindSetting, dosage: applied.dosage, finalWeight: applied.finalWeight, waterTemp: applied.waterTemp };
    const before = Math.min(...bests.map((b) => distance(c, current, b)));
    const after = Math.min(...bests.map((b) => distance(c, next, b)));
    points.push({
      k,
      suggestion: `[${top.parameter}] ${top.action} (${top.confidence})`,
      kind: applied.kind,
      towardBest: after < before - 1e-9 ? "closer" : after > before + 1e-9 ? "farther" : "same",
      landsOnBest: after <= 1,
      costUsd: g.costUsd + applied.costUsd,
    });
  }
  return { coffee: c.label, set: c.set, method: c.method, points };
}

// ---------------------------------------------------------------------------
// Run and report
// ---------------------------------------------------------------------------

const results = [];
const openResults = [];
const errorRow = (c) => ({ coffee: c.label, set: c.set, method: c.method, actualAttempts: c.actualAttempts, cap: c.cap, outcome: "error", attempts: null, steps: [], costUsd: 0, avgLatencyMs: 0 });

for (let run = 1; run <= RUNS; run++) {
  for (const arm of ARMS) {
    const t0 = Date.now();
    const [rows, open] = await Promise.all([
      mapLimit(cases, CONCURRENCY, (c) =>
        replay(c, arm).catch((e) => {
          console.error(`  ${arm.label} ${c.label}: ${e.message}`);
          return errorRow(c);
        }),
      ),
      mapLimit(cases, CONCURRENCY, (c) =>
        openLoop(c, arm).catch((e) => {
          console.error(`  open-loop ${arm.label} ${c.label}: ${e.message}`);
          return { coffee: c.label, set: c.set, method: c.method, points: [], error: true };
        }),
      ),
    ]);
    rows.forEach((r) => results.push({ run, arm: arm.label, ...r }));
    open.forEach((r) => openResults.push({ run, arm: arm.label, ...r }));
    const s = summarize(rows);
    const o = summarizeOpen(open);
    console.log(
      `[run ${run}] ${arm.label.padEnd(18)} reached ${s.reached}/${s.n} · median attempts ${fmt(s.medianAttempts)} (actual ${fmt(s.medianActual)}) · saved/coffee ${fmt(s.meanSaved, 2)} · open-loop closer ${o.closer}/${o.n}, lands ${o.lands}/${o.n} · $${fmt(s.cost + o.cost, 2)} · ${Math.round((Date.now() - t0) / 1000)}s`,
    );
  }
}

function summarize(rows) {
  const ok = rows.filter((r) => r.outcome !== "error");
  const steps = ok.flatMap((r) => r.steps);
  return {
    n: ok.length,
    errors: rows.length - ok.length,
    reached: ok.filter((r) => r.outcome === "reached").length,
    medianAttempts: median(ok.map((r) => r.attempts)),
    medianActual: median(ok.map((r) => r.actualAttempts)),
    meanSaved: mean(ok.map((r) => r.actualAttempts - r.attempts)),
    faster: ok.filter((r) => r.attempts < r.actualAttempts).length,
    slower: ok.filter((r) => r.attempts > r.actualAttempts).length,
    exactRate: steps.length ? steps.filter((s) => s.match === "exact").length / steps.length : NaN,
    offMap: ok.filter((r) => r.outcome === "off-map").length,
    holds: steps.filter((s) => s.kind === "hold").length,
    cost: ok.reduce((a, r) => a + r.costUsd, 0),
    latency: mean(ok.filter((r) => r.steps.length).map((r) => r.avgLatencyMs)),
  };
}

function summarizeOpen(rows) {
  const pts = rows.flatMap((r) => r.points);
  return {
    n: pts.length,
    closer: pts.filter((p) => p.towardBest === "closer").length,
    farther: pts.filter((p) => p.towardBest === "farther").length,
    lands: pts.filter((p) => p.landsOnBest).length,
    cost: pts.reduce((a, p) => a + p.costUsd, 0),
  };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const lines = [];
lines.push(`# Replay to best brew`);
lines.push("");
lines.push(
  `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${cases.length} coffees · arms ${ARMS.map((a) => `\`${a.label}\``).join(", ")} · ${RUNS} run(s) · new-prompt effort \`${EFFORT}\`. Re-run with \`node scripts/test-replay-to-best.mjs\`.`,
);
lines.push("");
lines.push("## How to read this");
lines.push("");
lines.push(
  `- **Attempts (closed loop):** each coffee starts from its real first brew. The arm's first suggestion is applied to get the next settings, and the outcome comes from the nearest real brew at those settings. Attempts counts brews, including the first, until it lands on settings that produced a brew as good as the coffee's best. Not reaching it within actual attempts + ${EXTRA_STEPS} counts as cap + 1. Lower is better.`,
);
lines.push(
  "- **Off-map:** the arm proposed settings more than 2× the matching tolerance from anything you brewed, so the outcome is unknown and the run stops as not reached. A high count doesn't prove the advice was bad, only that your history can't confirm it. Read it together with the open-loop columns.",
);
lines.push(
  "- **Open loop:** at every real brew before the best one, the arm sees your actual history up to that brew. *Closer* means its first suggestion moved the settings toward the best brew, and *lands* means it reached the best brew's settings in one step. No outcome assumptions are involved.",
);
lines.push("- With this few coffees, a gap smaller than the run-to-run spread is noise.");
lines.push("");

for (const subset of ["all", "tuning", "hold-out"]) {
  const inSet = (r) => subset === "all" || r.set === subset;
  if (!results.some(inSet)) continue;
  lines.push(`## ${subset === "all" ? "All coffees" : subset === "tuning" ? "Tuning set (prompt rules were derived from these)" : "Hold-out set"}`);
  lines.push("");
  lines.push("| Arm | Run | Reached best | Median attempts | Actual median | Saved per coffee | Faster / slower than actual | Off-map | Holds | Open loop: closer | Open loop: farther | Open loop: lands | Cost | Avg latency |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (let run = 1; run <= RUNS; run++) {
    for (const arm of ARMS) {
      const rows = results.filter((r) => r.run === run && r.arm === arm.label && inSet(r));
      const open = openResults.filter((r) => r.run === run && r.arm === arm.label && inSet(r));
      const s = summarize(rows);
      const o = summarizeOpen(open);
      lines.push(
        `| \`${arm.label}\` | ${run} | ${s.reached}/${s.n} | ${fmt(s.medianAttempts)} | ${fmt(s.medianActual)} | ${fmt(s.meanSaved, 2)} | ${s.faster} / ${s.slower} | ${s.offMap} | ${s.holds} | ${pct(o.closer, o.n)} | ${pct(o.farther, o.n)} | ${o.lands}/${o.n} | $${fmt(s.cost + o.cost, 2)} | ${fmt(s.latency / 1000, 1)}s |`,
      );
    }
  }
  lines.push("");
}

lines.push("## Per coffee (closed-loop attempts)");
lines.push("");
lines.push(`| Coffee | Set | Best | Actual | ${ARMS.map((a) => `\`${a.label}\``).join(" | ")} |`);
lines.push(`|---|---|---|---|${ARMS.map(() => "---").join("|")}|`);
for (const c of cases) {
  const cells = ARMS.map((a) =>
    results
      .filter((r) => r.arm === a.label && r.coffee === c.label && r.method === c.method)
      .map((r) => (r.outcome === "reached" ? String(r.attempts) : r.outcome === "cap" ? `>${c.cap}` : r.outcome))
      .join(" / "),
  );
  lines.push(`| ${c.label} (${c.method}) | ${c.set} | ${P.qualityLabel(c.bestQ)} | ${c.actualAttempts} | ${cells.join(" | ")} |`);
}
lines.push("");
lines.push('Multiple runs are separated by " / ".');
lines.push("");

await fs.mkdir(path.dirname(path.join(REPO_ROOT, OUT_BASE)), { recursive: true });
await fs.writeFile(path.join(REPO_ROOT, `${OUT_BASE}.md`), lines.join("\n"));
await fs.writeFile(path.join(REPO_ROOT, `${OUT_BASE}.json`), JSON.stringify({ arms: ARMS, runs: RUNS, effort: EFFORT, results, openResults }, null, 2));
console.log(`\n[replay] wrote ${OUT_BASE}.md and .json`);
