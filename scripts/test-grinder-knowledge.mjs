#!/usr/bin/env node
/**
 * Grinder knowledge eval: does the model know each saved grinder's scale well enough to skip a
 * web lookup? Asks the same model for a grinder profile twice without search (run-to-run noise)
 * and once with web search, then compares fields and checks each answer against the grind
 * settings actually logged on that grinder.
 *
 * Usage:
 *   node scripts/test-grinder-knowledge.mjs                   # gpt-6.1-sol
 *   node scripts/test-grinder-knowledge.mjs --model gpt-5.4 --max 5
 *
 * Writes docs/ai-analysis/grinder-knowledge-eval.md and .json.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT, OPENAI_KEY, PRICING, getByPrefix, requireEnv } from "./lib/household.mjs";
import { argValue, mapLimit } from "./lib/guidanceArms.mjs";

requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY");

const MODEL = argValue("--model", "gpt-6.1-sol");
const MAX = parseInt(argValue("--max", "999"), 10);
const CONCURRENCY = parseInt(argValue("--concurrency", "6"), 10);

const [equipment, brews] = await Promise.all([getByPrefix("equipment:"), getByPrefix("brew:")]);

const label = (e) => `${e.company || ""} ${e.model || e.name || ""}`.replace(/\s+/g, " ").trim();
const keyOf = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const looksReal = (s) => (s.match(/[a-z]/gi) || []).length >= 5 && !/\btest\b/i.test(s);

const grinders = new Map();
for (const e of equipment.filter((e) => e.type === "grinder")) {
  const name = label(e);
  if (!looksReal(name)) continue;
  const g = grinders.get(keyOf(name)) ?? { name, ids: new Set(), methods: new Set(), observed: {} };
  g.ids.add(e.id);
  for (const m of e.methods || [e.method]) if (m) g.methods.add(m);
  grinders.set(keyOf(name), g);
}
for (const b of brews) {
  const g = [...grinders.values()].find((g) => g.ids.has(b.grinderId));
  const v = parseFloat(b.grindSetting);
  if (g && Number.isFinite(v) && b.brewMethod) (g.observed[b.brewMethod] ??= []).push(v);
}
const targets = [...grinders.values()].slice(0, MAX);
console.log(`[grinder-eval] ${targets.length} distinct grinders · ${MODEL}\n`);

const range = { type: ["object", "null"], additionalProperties: false, required: ["min", "max"], properties: { min: { type: "number" }, max: { type: "number" } } };
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recognized", "adjustment", "higherIsCoarser", "scale", "notation", "espresso", "pourOver", "smallestUsefulStep", "confidence"],
  properties: {
    recognized: { type: "boolean", description: "True only if you know this specific grinder model." },
    adjustment: { type: "string", enum: ["stepped", "stepless", "unknown"] },
    higherIsCoarser: { type: "string", enum: ["yes", "no", "unknown"], description: "Does a higher number on the dial mean a coarser grind?" },
    scale: { ...range, description: "Full numeric range of the dial as users record it, or null." },
    notation: { type: "string", description: "How settings are written, e.g. '0–50 stepless dial', '1–11 with 3 sub-steps (1.1, 1.2)', 'macro 1–10 + micro A–W'." },
    espresso: { ...range, description: "Typical espresso range on this dial, or null if it can't grind for espresso." },
    pourOver: { ...range, description: "Typical pour-over range on this dial, or null if unsuitable." },
    smallestUsefulStep: { type: ["number", "null"], description: "Smallest adjustment that changes the cup, in dial units." },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
};

const promptFor = (name, search) =>
  `Grinder: "${name}" (as typed by a home coffee app user; it may be a machine with a built-in grinder).\n\n` +
  `Describe how its grind setting dial works so a dial-in assistant can give correct adjustments: adjustment type, ` +
  `whether a higher number is coarser, the dial's numeric range, how settings are written, typical espresso and ` +
  `pour-over ranges on that dial, and the smallest useful step. Use null or "unknown" for anything you don't know; do not guess.` +
  (search ? ` Search the web for the manufacturer's manual or specs first.` : ` Answer from your own knowledge; do not search.`);

async function ask(name, search) {
  const t0 = Date.now();
  const body = {
    model: MODEL,
    input: [{ role: "user", content: promptFor(name, search) }],
    reasoning: { effort: "low" },
    text: { format: { type: "json_schema", name: "grinder_profile", schema: SCHEMA, strict: true } },
    ...(search ? { tools: [{ type: "web_search" }] } : {}),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) continue;
      return { error: `${res.status} ${(await res.text()).slice(0, 200)}`, ms: Date.now() - t0 };
    }
    const data = await res.json();
    const text = data.output?.find((i) => i.type === "message")?.content?.find((c) => c.type === "output_text")?.text;
    const [inp, out] = PRICING[MODEL] || [0, 0];
    return {
      profile: JSON.parse(text),
      searches: (data.output || []).filter((i) => i.type === "web_search_call").length,
      cost: ((data.usage?.input_tokens || 0) * inp + (data.usage?.output_tokens || 0) * out) / 1e6,
      ms: Date.now() - t0,
    };
  }
}

const overlap = (a, b) => {
  if (!a || !b) return a === b ? 1 : 0;
  const lo = Math.max(a.min, b.min), hi = Math.min(a.max, b.max);
  const span = Math.max(a.max - a.min, b.max - b.min, 1e-9);
  return Math.max(0, hi - lo) / span;
};

/** Field-level disagreements between two profiles. Only fields both sides claim to know count. */
function diff(a, b) {
  const out = [];
  if (a.recognized !== b.recognized) out.push("recognized");
  if (a.higherIsCoarser !== "unknown" && b.higherIsCoarser !== "unknown" && a.higherIsCoarser !== b.higherIsCoarser) out.push("direction");
  if (a.adjustment !== "unknown" && b.adjustment !== "unknown" && a.adjustment !== b.adjustment) out.push("stepped/stepless");
  if (a.scale && b.scale && overlap(a.scale, b.scale) < 0.8) out.push("scale");
  if (a.espresso && b.espresso && overlap(a.espresso, b.espresso) < 0.5) out.push("espresso range");
  if (a.pourOver && b.pourOver && overlap(a.pourOver, b.pourOver) < 0.5) out.push("pour-over range");
  const s1 = a.smallestUsefulStep, s2 = b.smallestUsefulStep;
  if (s1 > 0 && s2 > 0 && Math.max(s1, s2) / Math.min(s1, s2) > 2) out.push("step size");
  return out;
}

/** Share of logged settings (per method) inside the profile's range, padded by one smallest step. */
function fitsObserved(profile, observed) {
  const res = {};
  for (const [method, vals] of Object.entries(observed)) {
    const r = method === "espresso" ? profile.espresso : profile.pourOver;
    if (method === "immersion" || !r) continue;
    const pad = profile.smallestUsefulStep || 0;
    res[method] = vals.filter((v) => v >= r.min - pad && v <= r.max + pad).length / vals.length;
  }
  return res;
}

const results = await mapLimit(targets, CONCURRENCY, async (g) => {
  const [a, b, web] = await Promise.all([ask(g.name, false), ask(g.name, false), ask(g.name, true)]);
  const row = { name: g.name, methods: [...g.methods], observed: g.observed, a, b, web };
  if (a.profile && b.profile && web.profile) {
    row.noise = diff(a.profile, b.profile);
    row.vsWeb = diff(a.profile, web.profile);
    row.fitA = fitsObserved(a.profile, g.observed);
    row.fitWeb = fitsObserved(web.profile, g.observed);
  }
  process.stdout.write(".");
  return row;
});
console.log("\n");

const ok = results.filter((r) => r.vsWeb);
const count = (field, key) => ok.filter((r) => r[key].includes(field)).length;
const FIELDS = ["recognized", "direction", "stepped/stepless", "scale", "espresso range", "pour-over range", "step size"];
const withLogs = ok.filter((r) => Object.keys(r.fitA).length);
const fitAvg = (key) => {
  const vals = withLogs.flatMap((r) => Object.values(r[key]));
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : NaN;
};
const pct = (n) => `${Math.round(n * 100)}%`;
const sum = (arm, f) => results.reduce((s, r) => s + (r[arm]?.[f] || 0), 0);

const lines = [
  "# Grinder knowledge eval",
  "",
  `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${targets.length} distinct saved grinders · \`${MODEL}\` at \`low\` · strict JSON schema.`,
  "",
  "Each grinder was asked twice without web search (A and B) and once with it. A vs B is run-to-run noise; A vs web is what a lookup would change. Only fields both sides answered count as disagreements.",
  "",
  "| Field | A vs B (noise) | A vs web search |",
  "|---|---|---|",
  ...FIELDS.map((f) => `| ${f} | ${count(f, "noise")}/${ok.length} | ${count(f, "vsWeb")}/${ok.length} |`),
  "",
  `Grinders with no disagreement vs web: ${ok.filter((r) => !r.vsWeb.length).length}/${ok.length}. Errors: ${results.length - ok.length}.`,
  "",
  `Logged settings inside the stated range (${withLogs.length} grinders with brews, padded by one step): without search ${pct(fitAvg("fitA"))}, with search ${pct(fitAvg("fitWeb"))}.`,
  "",
  `Unknown direction: without search ${ok.filter((r) => r.a.profile.higherIsCoarser === "unknown").length}, with search ${ok.filter((r) => r.web.profile.higherIsCoarser === "unknown").length}. Not recognized: without ${ok.filter((r) => !r.a.profile.recognized).length}, with ${ok.filter((r) => !r.web.profile.recognized).length}.`,
  "",
  `Cost: without search $${(sum("a", "cost") + sum("b", "cost")).toFixed(3)} for two passes, with search $${sum("web", "cost").toFixed(3)} (${(results.reduce((s, r) => s + (r.web?.searches || 0), 0) / results.length).toFixed(1)} searches per grinder).`,
  "",
  "## Per grinder",
  "",
  "| Grinder | Logged settings | Without search (A) | With search | A vs web | Fit A / web |",
  "|---|---|---|---|---|---|",
];
const fmtRange = (r) => (r ? `${r.min}–${r.max}` : "–");
const brief = (p) => (p ? `${p.adjustment}, higher coarser: ${p.higherIsCoarser}, esp ${fmtRange(p.espresso)}, PO ${fmtRange(p.pourOver)}, step ${p.smallestUsefulStep ?? "–"} (${p.confidence})` : "error");
const fmtObs = (o) => Object.entries(o).map(([m, v]) => `${m} ${Math.min(...v)}–${Math.max(...v)} (n=${v.length})`).join("; ") || "–";
const fmtFit = (f) => Object.entries(f || {}).map(([m, v]) => `${m.split(" ")[0]} ${pct(v)}`).join(", ") || "–";
for (const r of results.sort((x, y) => (y.vsWeb?.length || 0) - (x.vsWeb?.length || 0))) {
  lines.push(`| ${r.name} | ${fmtObs(r.observed)} | ${brief(r.a.profile)} | ${brief(r.web.profile)} | ${r.vsWeb?.join(", ") || "agree"} | ${fmtFit(r.fitA)} / ${fmtFit(r.fitWeb)} |`);
}
lines.push("", "## Notation (without search vs with search)", "");
for (const r of ok) lines.push(`- **${r.name}:** ${r.a.profile.notation} · *web:* ${r.web.profile.notation}`);

const outDir = path.join(REPO_ROOT, "docs/ai-analysis");
await fs.writeFile(path.join(outDir, "grinder-knowledge-eval.md"), lines.join("\n") + "\n");
await fs.writeFile(path.join(outDir, "grinder-knowledge-eval.json"), JSON.stringify(results, null, 2));
console.log(lines.slice(6, 22).join("\n"));
console.log("\n[grinder-eval] wrote docs/ai-analysis/grinder-knowledge-eval.md");
