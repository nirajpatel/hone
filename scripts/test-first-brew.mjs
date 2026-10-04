#!/usr/bin/env node
/**
 * First-brew eval (directional, not a gate): for each coffee you dialed in, hide its own
 * brews and anything brewed after its first brew, ask each arm for starting parameters,
 * and measure how far they land from the coffee's actual best brew.
 *
 *   old:<model>  bag details only ("assume typical ranges for that grinder")
 *   new:<model>  coffees recently brewed on the grinder + brewer profile
 *
 * Distances: grind in grinder tolerances (5% of the grinder's range), ratio, brew time,
 * water temperature. "Closer" compares the sum of normalized distances per coffee.
 *
 * Usage:
 *   node scripts/test-first-brew.mjs --dry-run
 *   node scripts/test-first-brew.mjs --arms old:gpt-5.4,new:gpt-5.4,new:gpt-6.1-sol --runs 2
 *   node scripts/test-first-brew.mjs --arms new:gpt-6.1-sol --out tmp/first-brew-before.md
 *
 * Also counts other coffees named in the reader-facing text (introduction, recommendations,
 * explanations, note) and em dashes. Writes docs/ai-analysis/first-brew-eval.md unless --out is given.
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as P from "../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { REPO_ROOT, callChat, costUsd, loadHousehold, requireEnv, ANALYZE_USER_ID } from "./lib/household.mjs";
import { argValue, fmt, loadTuningCoffeeIds, mapLimit, mean, median, otherCoffeeMentions, parseArms } from "./lib/guidanceArms.mjs";
import { buildLegacyChatBody, buildLegacyFirstBrewPrompt } from "./lib/legacyPrompt.mjs";

const DRY = process.argv.includes("--dry-run");
requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANALYZE_USER_ID", ...(DRY ? [] : ["OPENAI_API_KEY"]));

const ARMS = parseArms(argValue("--arms", "old:gpt-5.4,new:gpt-5.4"));
const RUNS = parseInt(argValue("--runs", "1"), 10);
const CONCURRENCY = parseInt(argValue("--concurrency", "6"), 10);
const EFFORT = argValue("--effort", "low");
const OUT = argValue("--out", "docs/ai-analysis/first-brew-eval.md");

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : NaN;
};
const byOldest = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

const hh = await loadHousehold(ANALYZE_USER_ID);
const tuningIds = await loadTuningCoffeeIds();

function buildCases() {
  const seen = new Set();
  const cases = [];
  for (const coffee of hh.coffees) {
    const sameIds = P.findSameCoffeeIds(coffee, hh.coffees, hh.aliases);
    const key = [...sameIds].sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const beanBrews = hh.householdBrews.filter((b) => sameIds.includes(b.coffeeId)).sort(byOldest);
    if (!beanBrews.length) continue;
    const cutoff = beanBrews[0].createdAt;
    for (const method of [...new Set(beanBrews.map((b) => b.brewMethod))]) {
      const brews = beanBrews.filter((b) => b.brewMethod === method);
      const bestQ = Math.max(0, ...brews.map((b) => b.quality || 0));
      if (bestQ < 2) continue;
      const best = brews.filter((b) => b.quality === bestQ).sort(byOldest)[0];
      const equipment = P.equipmentOf(best);
      if (!equipment.grinderId && !equipment.grinderName) continue;
      const grinds = hh.householdBrews
        .filter((b) => P.onSameEquipment(b, { ...equipment, brewerId: b.brewerId, brewerName: b.brewerName }))
        .map((b) => num(b.grindSetting))
        .filter(Number.isFinite);
      cases.push({
        label: `${coffee.roaster.trim()} — ${coffee.name}`,
        method,
        set: sameIds.some((id) => tuningIds.has(id)) ? "tuning" : "hold-out",
        coffee: hh.coffees.find((c) => c.id === beanBrews[0].coffeeId) ?? coffee,
        sameIds,
        best,
        equipment,
        grindTol: grinds.length > 1 ? Math.max(0.05 * (Math.max(...grinds) - Math.min(...grinds)), 0.05) : 0.25,
        priorBrews: hh.householdBrews.filter((b) => !sameIds.includes(b.coffeeId) && b.createdAt < cutoff),
      });
    }
  }
  return cases;
}

const cases = buildCases();
console.log(`[first-brew] ${cases.length} coffees · arms ${ARMS.map((a) => a.label).join(", ")} · runs ${RUNS}\n`);
if (DRY) {
  for (const c of cases) {
    const ctx = P.assembleGuidanceContext({ coffee: c.coffee, coffees: hh.coffees, householdBrews: c.priorBrews, brewMethod: c.method, sameCoffeeIds: c.sameIds, requesterUserId: c.best.userId, equipment: c.equipment });
    console.log(`${c.set.padEnd(8)} ${c.label} [${c.method}] best ${P.qualityLabel(c.best.quality)} · grinder coffees ${ctx.grinderHistory.length} · prior brews ${c.priorBrews.length}`);
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Parse recommendations
// ---------------------------------------------------------------------------

function parseTime(s, method) {
  const mmss = [...s.matchAll(/(\d+):(\d{2})/g)].map((m) => +m[1] * 60 + +m[2]);
  if (mmss.length) return mean(mmss);
  const secs = s.match(/(\d+(?:\.\d+)?)\s*(?:[-–]\s*(\d+(?:\.\d+)?))?\s*s(?:ec|econds)?\b/i);
  if (secs) return secs[2] ? (+secs[1] + +secs[2]) / 2 : +secs[1];
  return method === "espresso" ? NaN : NaN;
}

function parseParams(parameters, method) {
  const get = (re) => parameters.find((p) => re.test(p.name))?.recommendation ?? "";
  const grind = get(/grind/i).match(/(\d+(?:\.\d+)?)/);
  const dose = get(/dos/i).match(/(\d+(?:\.\d+)?)\s*g/i);
  const tempStr = get(/temp/i);
  const f = tempStr.match(/(\d{2,3}(?:\.\d+)?)\s*°?\s*F/i);
  const c = tempStr.match(/(\d{2,3}(?:\.\d+)?)\s*°?\s*C/i);
  const finalStr = get(/final|ratio/i);
  const ratio = finalStr.match(/1\s*:\s*(\d+(?:\.\d+)?)/);
  const weight = finalStr.match(/(\d+(?:\.\d+)?)\s*g/i);
  const d = dose ? +dose[1] : NaN;
  return {
    grind: grind ? +grind[1] : NaN,
    dose: d,
    temp: f ? +f[1] : c ? +c[1] * 1.8 + 32 : NaN,
    ratio: ratio ? +ratio[1] : weight && d ? +weight[1] / d : NaN,
    time: parseTime(get(/time/i), method),
  };
}

async function suggest(arm, c) {
  let prompt;
  let body;
  if (arm.version === "old") {
    prompt = buildLegacyFirstBrewPrompt(c.coffee, c.method, c.equipment.brewerName, c.equipment.grinderName);
    body = buildLegacyChatBody(prompt, arm.model);
  } else {
    const ctx = P.assembleGuidanceContext({
      coffee: c.coffee,
      coffees: hh.coffees,
      householdBrews: c.priorBrews,
      brewMethod: c.method,
      sameCoffeeIds: c.sameIds,
      requesterUserId: c.best.userId,
      equipment: c.equipment,
      userNames: hh.userNames,
      grinderProfiles: hh.grinderProfiles,
    });
    prompt = P.buildFirstBrewPrompt(ctx);
    body = P.buildChatBody(
      arm.model,
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      EFFORT,
      { name: "first_brew", schema: P.buildFirstBrewSchema(c.method) },
    );
  }
  const res = await callChat(body);
  const parsed = JSON.parse(res.content);
  const params = parsed.parameters ?? [];
  const reader = [parsed.introduction, ...params.flatMap((p) => [p.recommendation, p.explanation]), parsed.note].filter(Boolean).join(" ");
  return {
    params: parseParams(params, c.method),
    leaks: otherCoffeeMentions(reader, hh.coffees, c.coffee, c.sameIds),
    emDashes: (`${reader} ${(parsed.basis ?? []).join(" ")}`.match(/—/g) ?? []).length,
    costUsd: costUsd(arm.model, res.usage),
    elapsedMs: res.elapsedMs,
  };
}

function distances(c, p) {
  const b = c.best;
  const ratio = num(b.finalWeight) / num(b.dosage);
  return {
    grind: Math.abs(p.grind - num(b.grindSetting)) / c.grindTol,
    ratio: Math.abs(p.ratio - ratio),
    time: Math.abs(p.time - num(b.brewTime)),
    temp: Number.isFinite(num(b.waterTemp)) ? Math.abs(p.temp - num(b.waterTemp)) : NaN,
  };
}

// Normalizers for the composite: one grinder tolerance, ratio 0.1 (espresso) / 0.5, 3s / 15s, 2°F.
const composite = (c, d) => {
  const parts = [d.grind, d.ratio / (c.method === "espresso" ? 0.1 : 0.5), d.time / (c.method === "espresso" ? 3 : 15), d.temp / 2].filter(Number.isFinite);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : NaN;
};

const results = [];
for (let run = 1; run <= RUNS; run++) {
  for (const arm of ARMS) {
    const rows = await mapLimit(cases, CONCURRENCY, async (c) => {
      try {
        const s = await suggest(arm, c);
        const d = distances(c, s.params);
        return { run, arm: arm.label, coffee: c.label, method: c.method, set: c.set, params: s.params, leaks: s.leaks, emDashes: s.emDashes, d, composite: composite(c, d), costUsd: s.costUsd, elapsedMs: s.elapsedMs };
      } catch (e) {
        console.error(`  ${arm.label} ${c.label}: ${e.message.slice(0, 200)}`);
        return { run, arm: arm.label, coffee: c.label, method: c.method, set: c.set, error: e.message };
      }
    });
    results.push(...rows);
    const ok = rows.filter((r) => !r.error);
    console.log(`[run ${run}] ${arm.label.padEnd(18)} median grind error ${fmt(median(ok.map((r) => r.d.grind).filter(Number.isFinite)), 1)} tol · median composite ${fmt(median(ok.map((r) => r.composite).filter(Number.isFinite)), 1)}`);
  }
}

const lines = ["# First-brew eval", ""];
lines.push(
  `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${cases.length} coffees · ${RUNS} run(s) · new-prompt effort \`${EFFORT}\`. Directional check, not a ship gate: the best brew is only roughly the right start.`,
);
lines.push("");
lines.push("Median absolute distance from each coffee's best brew. Grind is in grinder tolerances (5% of that grinder's range across your brews). Lower is better.");
lines.push("");
lines.push("| Arm | Run | Grind (tol) | Ratio | Time (s) | Temp (°F) | Composite | Closer than old | Names other coffees | Em dashes | Errors |");
lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
const oldLabel = ARMS.find((a) => a.version === "old")?.label;
for (let run = 1; run <= RUNS; run++) {
  for (const arm of ARMS) {
    const ok = results.filter((r) => r.run === run && r.arm === arm.label && !r.error);
    const med = (k) => fmt(median(ok.map((r) => r.d[k]).filter(Number.isFinite)), k === "ratio" ? 2 : 1);
    let closer = "–";
    if (oldLabel && arm.label !== oldLabel) {
      const pairs = ok
        .map((r) => [r, results.find((o) => o.run === run && o.arm === oldLabel && o.coffee === r.coffee && o.method === r.method && !o.error)])
        .filter(([r, o]) => o && Number.isFinite(r.composite) && Number.isFinite(o.composite));
      closer = `${pairs.filter(([r, o]) => r.composite < o.composite).length}/${pairs.length}`;
    }
    lines.push(
      `| \`${arm.label}\` | ${run} | ${med("grind")} | ${med("ratio")} | ${med("time")} | ${med("temp")} | ${fmt(median(ok.map((r) => r.composite).filter(Number.isFinite)), 1)} | ${closer} | ${ok.filter((r) => r.leaks.length).length}/${ok.length} | ${ok.reduce((n, r) => n + r.emDashes, 0)} | ${results.filter((r) => r.run === run && r.arm === arm.label && r.error).length} |`,
    );
  }
}
lines.push("");
lines.push("## Per coffee (grind suggested vs best)");
lines.push("");
lines.push(`| Coffee | Set | Best grind | ${ARMS.map((a) => `\`${a.label}\``).join(" | ")} |`);
lines.push(`|---|---|---|${ARMS.map(() => "---").join("|")}|`);
for (const c of cases) {
  const cells = ARMS.map((a) =>
    results
      .filter((r) => r.arm === a.label && r.coffee === c.label && r.method === c.method && !r.error)
      .map((r) => fmt(r.params.grind, 2))
      .join(" / "),
  );
  lines.push(`| ${c.label} (${c.method}) | ${c.set} | ${c.best.grindSetting} | ${cells.join(" | ")} |`);
}
lines.push("");

await fs.writeFile(path.join(REPO_ROOT, OUT), lines.join("\n"));
await fs.writeFile(path.join(REPO_ROOT, OUT.replace(/\.md$/, ".json")), JSON.stringify(results, null, 2));
console.log(`\n[first-brew] wrote ${OUT}`);
