#!/usr/bin/env node
/**
 * Improvement-guidance eval: score each arm (prompt version × model) on real brew
 * histories cut at every rated brew with at least 2 earlier brews. Picks MODEL.
 *
 * Checks (pass rates; n < 3 is reported as "not measured"):
 *   Issue fixes (from the original failure-mode analysis)
 *     diagnosisRefreshed  primary issue isn't copied from the previous brew's guidance after params changed
 *     breaksRepeatLoop    doesn't repeat the previous top suggestion at the same magnitude
 *     hasMagnitude        top suggestion has a number
 *   Voice
 *     noHedges, imperative
 *   Behavior (new rules)
 *     holdOnce            single Bad cup at settings that were Decent+ before → repeat them or return to the Decent+ brew's exact settings
 *     noDoubleHold        second Bad cup in a row at the same settings → don't hold again
 *     avoidsBadCluster    never proposes settings the tried-settings list marks consistently Bad
 *     staysInHabitBand    next dose / water temp stay inside the brewer's standard band
 *     basisGrounded       every date cited in basis appears in the prompt (new prompt only, pre-filter)
 *
 * Usage:
 *   node scripts/test-brew-prompt.mjs --dry-run
 *   node scripts/test-brew-prompt.mjs --arms old:gpt-5.4,new:gpt-5.4,new:gpt-5.4@7,new:gpt-6.1-sol,new:gpt-6-astra --runs 2
 *   node scripts/test-brew-prompt.mjs --max-per-set 15
 *
 * Writes docs/ai-analysis/prompt-eval-models.md (+ .json), and blind-review.md when the
 * top two new-prompt arms overlap within their run-to-run spread.
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as P from "../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { REPO_ROOT, loadHousehold, requireEnv, ANALYZE_USER_ID } from "./lib/household.mjs";
import { applyFirstSuggestion, argValue, fmt, generateGuidance, loadTuningCoffeeIds, mapLimit, mean, parseArms } from "./lib/guidanceArms.mjs";

const DRY = process.argv.includes("--dry-run");
requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANALYZE_USER_ID", ...(DRY ? [] : ["OPENAI_API_KEY"]));

const ARMS = parseArms(argValue("--arms", "old:gpt-5.4,new:gpt-5.4"));
let RUNS = parseInt(argValue("--runs", "1"), 10);
const CONCURRENCY = parseInt(argValue("--concurrency", "8"), 10);
const EFFORT = argValue("--effort", "medium");
const MAX_PER_SET = parseInt(argValue("--max-per-set", "20"), 10);
const OUT_BASE = argValue("--out", "docs/ai-analysis/prompt-eval-models");

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : NaN;
};
const byOldest = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
const settingsOf = (b) => ({ grindSetting: num(b.grindSetting), dosage: num(b.dosage), finalWeight: num(b.finalWeight), waterTemp: num(b.waterTemp) });

const hh = await loadHousehold(ANALYZE_USER_ID);
const tuningIds = await loadTuningCoffeeIds();

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

function grindTolFor(equipment) {
  const grinds = hh.householdBrews
    .filter((b) => P.onSameEquipment(b, { ...equipment, brewerId: b.brewerId, brewerName: b.brewerName }))
    .map((b) => num(b.grindSetting))
    .filter(Number.isFinite);
  return grinds.length > 1 ? Math.max(0.05 * (Math.max(...grinds) - Math.min(...grinds)), 0.05) : 0.25;
}

function sameSettings(a, b, method, grindTol) {
  const sa = settingsOf(a);
  const sb = settingsOf(b);
  const ratioTol = method === "espresso" ? 0.1 : 0.5;
  return (
    Math.abs(sa.grindSetting - sb.grindSetting) <= grindTol + 1e-9 &&
    Math.abs(sa.dosage - sb.dosage) <= Math.max(0.02 * sb.dosage, 0.2) + 1e-9 &&
    Math.abs(sa.finalWeight / sa.dosage - sb.finalWeight / sb.dosage) <= ratioTol + 1e-9
  );
}

function buildCases() {
  const seen = new Set();
  const cases = [];
  for (const coffee of hh.coffees) {
    const sameIds = P.findSameCoffeeIds(coffee, hh.coffees, hh.aliases);
    const key = [...sameIds].sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const beanBrews = hh.householdBrews.filter((b) => sameIds.includes(b.coffeeId)).sort(byOldest);
    for (const method of [...new Set(beanBrews.map((b) => b.brewMethod))]) {
      const brews = beanBrews.filter((b) => b.brewMethod === method);
      brews.forEach((target, i) => {
        if (i < 2 || !target.quality) return;
        const history = brews.slice(0, i + 1);
        const equipment = P.equipmentOf(target);
        const grindTol = grindTolFor(equipment);
        const onSetup = history.filter((b) => P.onSameEquipment(b, equipment));
        const prev = history[i - 1];
        const earlierSame = onSetup.slice(0, -1).filter((b) => b.quality && sameSettings(b, target, method, grindTol));
        const prevSame = prev && P.onSameEquipment(prev, equipment) && sameSettings(prev, target, method, grindTol);

        const ctx = P.assembleGuidanceContext({
          coffee: hh.coffees.find((c) => c.id === target.coffeeId) ?? coffee,
          coffees: hh.coffees,
          householdBrews: [...hh.householdBrews.filter((b) => !sameIds.includes(b.coffeeId) && b.createdAt < target.createdAt), ...history],
          brewMethod: method,
          sameCoffeeIds: sameIds,
          baselineBrewId: target.id,
          requesterUserId: target.userId,
        });
        const standard = ctx.profileLines.find((l) => l.includes("Your standard")) ?? "";
        const bands = {};
        for (const m of standard.matchAll(/(dose|water temperature|grind) (\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/g)) bands[m[1]] = [+m[2], +m[3]];

        cases.push({
          id: `${target.id}`,
          label: `${coffee.roaster.trim()} — ${coffee.name}`,
          method,
          set: sameIds.some((id) => tuningIds.has(id)) ? "tuning" : "hold-out",
          coffee: hh.coffees.find((c) => c.id === target.coffeeId) ?? coffee,
          sameIds,
          history,
          target,
          prev,
          equipment,
          grindTol,
          bands,
          badClusters: ctx.ledger.filter((c) => c.consistentlyBad).map((c) => c.brews[0]),
          goodSame: earlierSame.filter((b) => b.quality >= 2),
          applies: {
            holdOnce: target.quality === 1 && earlierSame.some((b) => b.quality >= 2) && !(prevSame && prev.quality === 1),
            noDoubleHold: target.quality === 1 && !!prevSame && prev.quality === 1,
            avoidsBadCluster: ctx.ledger.some((c) => c.consistentlyBad),
            staysInHabitBand: Object.keys(bands).some((k) => k !== "grind"),
          },
        });
      });
    }
  }
  return cases;
}

function pickCases(all) {
  const out = [];
  for (const set of ["tuning", "hold-out"]) {
    const pool = all.filter((c) => c.set === set);
    const special = pool.filter((c) => c.applies.holdOnce || c.applies.noDoubleHold || c.applies.avoidsBadCluster);
    const rest = pool.filter((c) => !special.includes(c));
    const step = rest.length / Math.max(1, MAX_PER_SET - special.length);
    const filler = [];
    for (let i = 0; filler.length < MAX_PER_SET - special.length && i < rest.length; i += Math.max(step, 1)) filler.push(rest[Math.floor(i)]);
    out.push(...special, ...filler);
  }
  return out;
}

const allCases = buildCases();
const cases = pickCases(allCases);
const applyCount = (k) => cases.filter((c) => c.applies[k]).length;
console.log(
  `[eval] ${cases.length} cases (${cases.filter((c) => c.set === "tuning").length} tuning, ${cases.filter((c) => c.set === "hold-out").length} hold-out) of ${allCases.length} · holdOnce n=${applyCount("holdOnce")} · noDoubleHold n=${applyCount("noDoubleHold")} · avoidsBadCluster n=${applyCount("avoidsBadCluster")} · habitBand n=${applyCount("staysInHabitBand")}`,
);
console.log(`[eval] arms ${ARMS.map((a) => a.label).join(", ")} · runs ${RUNS} · effort ${EFFORT}\n`);
if (DRY) process.exit(0);

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const HEDGES = ["likely", "suggests", "step in the right direction", "might", "could potentially", "perhaps", "may be"];
const IMPERATIVES = new Set(
  "grind increase decrease reduce raise lower adjust switch hold maintain skip try use move keep shorten lengthen extend stop add remove swirl pour wait preinfuse pre-infuse tamp distribute set warm cool rest change target repeat rebrew re-brew brew".split(" "),
);
const MONTH = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/g;

function paramOf(label = "") {
  const s = label.toLowerCase();
  if (s.includes("grind")) return "grind";
  if (s.includes("dose") || s.includes("dosage")) return "dose";
  if (s.includes("temp")) return "temp";
  if (/ratio|yield|final weight|output/.test(s)) return "yield";
  return s;
}
const direction = (a = "") => (/(finer|decrease|reduce|lower|less|shorten|tighten)/i.test(a) ? "down" : /(coarser|increase|raise|higher|more|extend|longer)/i.test(a) ? "up" : null);
const magnitude = (a = "") => {
  const by = a.match(/by\s*(?:about\s+|~)?\s*(\d+(?:\.\d+)?)(?:\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?))?/i);
  if (by) return Math.max(+by[1], +(by[2] ?? 0));
  const ft = a.match(/from\s+(\d+(?:\.\d+)?)\s*(?:to|→|->)\s*(\d+(?:\.\d+)?)/i);
  return ft ? Math.abs(+ft[1] - +ft[2]) : 0;
};
const wps = (t = "") => {
  const ss = t.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  return ss.length ? ss.reduce((a, s) => a + s.split(/\s+/).length, 0) / ss.length : 0;
};

async function score(c, arm, g) {
  const top = g.full.suggestions[0];
  const checks = {};
  const prevTop = c.prev?.suggestion?.full?.suggestions?.[0];
  const prevIssue = c.prev?.suggestion?.full?.primaryIssue;
  const changed = c.prev && JSON.stringify(settingsOf(c.prev)) !== JSON.stringify(settingsOf(c.target));
  if (prevIssue && changed) checks.diagnosisRefreshed = g.full.primaryIssue !== prevIssue;
  if (prevTop && direction(prevTop.action) && direction(top.action)) {
    const same = paramOf(prevTop.parameter) === paramOf(top.parameter) && direction(prevTop.action) === direction(top.action);
    checks.breaksRepeatLoop =
      !same ||
      /\b(hold|repeat|re-?taste|same settings)\b/i.test(`${top.action} ${top.reasoning}`) ||
      (magnitude(prevTop.action) > 0 && magnitude(top.action) >= 1.6 * magnitude(prevTop.action));
  }
  checks.hasMagnitude = /\d/.test(top.action) || /\b(hold|repeat)\b/i.test(top.action);
  checks.noHedges = HEDGES.every((h) => !JSON.stringify(g.full).toLowerCase().includes(h));
  checks.imperative = IMPERATIVES.has((top.action.trim().split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z-]/g, ""));

  const needsApplied = c.applies.holdOnce || c.applies.noDoubleHold || c.applies.avoidsBadCluster || c.applies.staysInHabitBand;
  if (needsApplied) {
    const current = settingsOf(c.target);
    const applied = await applyFirstSuggestion({ method: c.method, grinderName: c.equipment.grinderName, settings: current, suggestion: top });
    const next = { ...c.target, grindSetting: applied.grindSetting, dosage: applied.dosage, finalWeight: applied.finalWeight, waterTemp: applied.waterTemp };
    // Technique advice and small temperature/yield moves are not holds.
    const unchanged = ["grindSetting", "dosage", "finalWeight", "waterTemp"].every((k) => !(Math.abs(num(next[k]) - current[k]) > 1e-6));
    const isHold = applied.kind === "hold" || (applied.kind === "change" && unchanged);
    const returnsToGood = c.goodSame.some((b) => sameSettings(next, b, c.method, c.grindTol) && Math.abs(num(next.waterTemp) - num(b.waterTemp)) <= 1);
    if (c.applies.holdOnce) checks.holdOnce = isHold || returnsToGood;
    if (c.applies.noDoubleHold) checks.noDoubleHold = !isHold;
    if (c.applies.avoidsBadCluster) checks.avoidsBadCluster = !c.badClusters.some((b) => sameSettings(next, b, c.method, c.grindTol));
    if (c.applies.staysInHabitBand) {
      const inBand = (v, band) => !band || (v >= band[0] - 0.05 && v <= band[1] + 0.05);
      checks.staysInHabitBand = inBand(applied.dosage, c.bands.dose) && inBand(applied.waterTemp, c.bands["water temperature"]);
    }
  }
  if (g.storedBasisGrounded !== undefined) {
    checks.basisGrounded = g.storedBasisGrounded;
  } else if (arm.version === "new" && Array.isArray(g.raw?.basis) && g.raw.basis.some((s) => MONTH.test(s))) {
    checks.basisGrounded = g.raw.basis.every((s) => [...s.matchAll(MONTH)].every((m) => g.prompt.user.includes(`${m[1]} ${+m[2]}`)));
  }
  MONTH.lastIndex = 0;
  return { checks, summaryWps: wps(g.full.summary) };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const CHECKS = ["diagnosisRefreshed", "breaksRepeatLoop", "hasMagnitude", "noHedges", "imperative", "holdOnce", "noDoubleHold", "avoidsBadCluster", "staysInHabitBand", "basisGrounded"];
const results = [];
const RESCORE = argValue("--rescore");

if (RESCORE) {
  // Re-score saved guidance after a scorer change, without regenerating it.
  const saved = JSON.parse(await fs.readFile(path.resolve(REPO_ROOT, RESCORE), "utf8"));
  ARMS.splice(0, ARMS.length, ...saved.arms);
  RUNS = saved.runs;
  const byId = new Map(cases.map((c) => [c.id, c]));
  const rows = await mapLimit(saved.results, CONCURRENCY, async (r) => {
    const c = byId.get(r.caseId);
    if (r.error || !c) return r;
    const arm = saved.arms.find((a) => a.label === r.arm);
    const s = await score(c, arm, { full: r.full, storedBasisGrounded: r.checks.basisGrounded });
    return { ...r, ...s };
  });
  results.push(...rows);
}

for (let run = 1; run <= (RESCORE ? 0 : RUNS); run++) {
  for (const arm of ARMS) {
    const t0 = Date.now();
    const rows = await mapLimit(cases, CONCURRENCY, async (c) => {
      try {
        const g = await generateGuidance(arm, {
          coffee: c.coffee,
          coffees: hh.coffees,
          householdBrews: [...hh.householdBrews.filter((b) => !c.sameIds.includes(b.coffeeId) && b.createdAt < c.target.createdAt), ...c.history],
          coffeeBrews: c.history,
          sameCoffeeIds: c.sameIds,
          baselineId: c.target.id,
          brewMethod: c.method,
          requesterUserId: c.target.userId,
          userNames: hh.userNames,
          grinderProfiles: hh.grinderProfiles,
          effort: EFFORT,
          now: new Date(c.target.createdAt),
        });
        const s = await score(c, arm, g);
        return { run, arm: arm.label, caseId: c.id, set: c.set, label: c.label, ...s, full: g.full, costUsd: g.costUsd, elapsedMs: g.elapsedMs };
      } catch (e) {
        console.error(`  ${arm.label} ${c.label} ${c.id.slice(0, 8)}: ${e.message.slice(0, 200)}`);
        return { run, arm: arm.label, caseId: c.id, set: c.set, label: c.label, error: e.message };
      }
    });
    results.push(...rows);
    const s = summarize(rows);
    console.log(`[run ${run}] ${arm.label.padEnd(20)} score ${fmt(s.score * 100, 1)} · errors ${s.errors} · $${fmt(s.cost, 2)} · ${fmt(s.latency / 1000, 1)}s/call · ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}

function summarize(rows) {
  const ok = rows.filter((r) => !r.error);
  const rates = {};
  for (const k of CHECKS) {
    const vals = ok.map((r) => r.checks[k]).filter((v) => v !== undefined);
    rates[k] = { pass: vals.filter(Boolean).length, n: vals.length };
  }
  const measured = CHECKS.filter((k) => rates[k].n >= 3 && k !== "basisGrounded");
  return {
    rates,
    score: mean(measured.map((k) => rates[k].pass / rates[k].n)),
    errors: rows.length - ok.length,
    cost: ok.reduce((a, r) => a + r.costUsd, 0),
    latency: mean(ok.map((r) => r.elapsedMs)),
    wps: mean(ok.map((r) => r.summaryWps)),
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const armStats = ARMS.map((arm) => {
  const perRun = Array.from({ length: RUNS }, (_, i) => summarize(results.filter((r) => r.arm === arm.label && r.run === i + 1)));
  const scores = perRun.map((s) => s.score);
  return { arm, perRun, mean: mean(scores), spread: Math.max(...scores) - Math.min(...scores) };
});
const ranked = armStats.filter((a) => a.arm.version === "new" && !a.arm.historyLimit).sort((a, b) => b.mean - a.mean);
const [first, second] = ranked;
const closeCall = first && second && first.mean - second.mean <= Math.max(first.spread, second.spread);

const lines = ["# Improvement guidance eval: models and prompts", ""];
lines.push(
  `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${cases.length} cases (${cases.filter((c) => c.set === "tuning").length} tuning, ${cases.filter((c) => c.set === "hold-out").length} hold-out) · ${RUNS} run(s) · new-prompt effort \`${EFFORT}\`.`,
);
lines.push("");
lines.push(
  "Score is the mean pass rate over measured checks (n ≥ 3; `basisGrounded` is reported but excluded because the old prompt has no basis). The scorers are wording heuristics tuned on gpt-5.4 output, so a different model can lose points for style alone.",
);
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push("| Arm | Score (mean of runs) | Run spread | Errors | Cost per run | Avg latency | Summary words/sentence |");
lines.push("|---|---|---|---|---|---|---|");
for (const a of armStats) {
  lines.push(
    `| \`${a.arm.label}\` | ${fmt(a.mean * 100, 1)} | ${fmt(a.spread * 100, 1)} | ${a.perRun.reduce((x, s) => x + s.errors, 0)} | $${fmt(mean(a.perRun.map((s) => s.cost)), 2)} | ${fmt(mean(a.perRun.map((s) => s.latency)) / 1000, 1)}s | ${fmt(mean(a.perRun.map((s) => s.wps)), 1)} |`,
  );
}
lines.push("");
if (first) {
  lines.push(
    closeCall
      ? `**Close call:** \`${first.arm.label}\` and \`${second.arm.label}\` overlap within the run spread. Decide with docs/ai-analysis/blind-review.md.`
      : `**Best new-prompt arm:** \`${first.arm.label}\` (${fmt(first.mean * 100, 1)} vs next ${second ? fmt(second.mean * 100, 1) : "–"}).`,
  );
  lines.push("");
}

for (const subset of ["all", "tuning", "hold-out"]) {
  lines.push(`## Checks: ${subset === "all" ? "all cases" : subset === "tuning" ? "tuning set" : "hold-out set"}`);
  lines.push("");
  lines.push(`| Check | ${ARMS.map((a) => `\`${a.label}\``).join(" | ")} |`);
  lines.push(`|---|${ARMS.map(() => "---").join("|")}|`);
  for (const k of CHECKS) {
    const cells = ARMS.map((arm) =>
      Array.from({ length: RUNS }, (_, i) => {
        const s = summarize(results.filter((r) => r.arm === arm.label && r.run === i + 1 && (subset === "all" || r.set === subset)));
        const { pass, n } = s.rates[k];
        return n === 0 ? "–" : n < 3 ? `not measured (n=${n})` : `${Math.round((100 * pass) / n)}% (${pass}/${n})`;
      }).join(" / "),
    );
    lines.push(`| ${k} | ${cells.join(" | ")} |`);
  }
  lines.push("");
}
lines.push('Multiple runs are separated by " / ".');
lines.push("");

await fs.mkdir(path.dirname(path.join(REPO_ROOT, OUT_BASE)), { recursive: true });
await fs.writeFile(path.join(REPO_ROOT, `${OUT_BASE}.md`), lines.join("\n"));
await fs.writeFile(path.join(REPO_ROOT, `${OUT_BASE}.json`), JSON.stringify({ arms: ARMS, runs: RUNS, effort: EFFORT, results }, null, 2));
console.log(`\n[eval] wrote ${OUT_BASE}.md and .json`);

if (closeCall) {
  const picks = cases.filter((c) => results.some((r) => r.caseId === c.id && r.arm === first.arm.label && !r.error) && results.some((r) => r.caseId === c.id && r.arm === second.arm.label && !r.error));
  const sample = picks.filter((_, i) => i % Math.max(1, Math.floor(picks.length / 8)) === 0).slice(0, 8);
  const key = [];
  const doc = [
    "# Blind review: pick the better guidance",
    "",
    `Two models' guidance for ${sample.length} real brews, shown in random order. For each case, write A or B next to **Pick**. The answer key is in blind-review-key.json; open it only after picking.`,
    "",
  ];
  sample.forEach((c, i) => {
    const flip = Math.random() < 0.5;
    const [a, b] = flip ? [second, first] : [first, second];
    key.push({ case: i + 1, A: a.arm.label, B: b.arm.label });
    const render = (arm) => {
      const r = results.find((x) => x.caseId === c.id && x.arm === arm.arm.label && x.run === 1 && !x.error) ?? results.find((x) => x.caseId === c.id && x.arm === arm.arm.label && !x.error);
      return [`${r.full.summary}`, "", ...r.full.suggestions.map((s, j) => `${j + 1}. **${s.parameter}** (${s.confidence}): ${s.action}. ${s.effect}. ${s.reasoning}.`), ...(r.full.basis?.length ? ["", `_Based on: ${r.full.basis.join(" · ")}_`] : [])].join("\n");
    };
    doc.push(`## Case ${i + 1}: ${c.label} (${c.method}), ${P.qualityLabel(c.target.quality)} brew${c.target.tastingNotes ? ` — "${c.target.tastingNotes}"` : ""}`, "");
    doc.push("### A", "", render(a), "", "### B", "", render(b), "", "**Pick:** ", "");
  });
  await fs.writeFile(path.join(REPO_ROOT, "docs/ai-analysis/blind-review.md"), doc.join("\n"));
  await fs.writeFile(path.join(REPO_ROOT, "docs/ai-analysis/blind-review-key.json"), JSON.stringify(key, null, 2));
  console.log("[eval] close call: wrote docs/ai-analysis/blind-review.md (key in blind-review-key.json)");
}
