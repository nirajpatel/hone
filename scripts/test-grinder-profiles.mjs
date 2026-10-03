#!/usr/bin/env node
/**
 * Grinder profile accuracy: generates profiles with the production prompt (nothing is saved) and
 * scores them against a hand-verified answer key (scripts/fixtures/grinder-profiles.json):
 * direction, required facts in settingFormat, forbidden content, and agreement between runs.
 * Re-run after changing buildGrinderProfilePrompt or GRINDER_PROFILE_SCHEMA.
 *
 * Usage:
 *   node scripts/test-grinder-profiles.mjs              # 2 runs per grinder
 *   node scripts/test-grinder-profiles.mjs --runs 3
 *
 * Writes docs/ai-analysis/grinder-profile-eval.md.
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as P from "../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { REPO_ROOT, generateGrinderProfile, requireEnv } from "./lib/household.mjs";
import { argValue } from "./lib/guidanceArms.mjs";

requireEnv("OPENAI_API_KEY");

const RUNS = parseInt(argValue("--runs", "2"), 10);
const key = JSON.parse(await fs.readFile(path.join(REPO_ROOT, "scripts/fixtures/grinder-profiles.json"), "utf8"));
console.log(`[grinder-profiles] ${key.length} grinders × ${RUNS} runs · ${P.MODEL} · profile v${P.GRINDER_PROFILE_VERSION}\n`);

function score(entry, stored) {
  const { recognized, direction, settingFormat } = stored.profile;
  const misses = [];
  if (!recognized) misses.push("not recognized");
  if (!entry.direction.includes(direction)) misses.push(`direction ${direction}`);
  for (const [label, re] of Object.entries(entry.facts)) if (!new RegExp(re, "i").test(settingFormat)) misses.push(`missing ${label}`);
  for (const [label, re] of Object.entries(entry.forbidden)) if (new RegExp(re, "i").test(settingFormat)) misses.push(`has ${label}`);
  return misses;
}

const results = await Promise.all(key.flatMap((entry) => Array.from({ length: RUNS }, async (_, i) => {
  const t0 = Date.now();
  try {
    const stored = await generateGrinderProfile(P, entry.name);
    return { entry, run: i + 1, stored, secs: (Date.now() - t0) / 1000, misses: score(entry, stored) };
  } catch (error) {
    return { entry, run: i + 1, error: error.message, misses: ["error"] };
  }
})));

const byGrinder = key.map((entry) => {
  const runs = results.filter((r) => r.entry === entry);
  const directions = new Set(runs.filter((r) => r.stored).map((r) => r.stored.profile.direction));
  return { entry, runs, allPass: runs.every((r) => !r.misses.length), consistent: directions.size === 1 };
});

const runCount = results.length;
const passRuns = results.filter((r) => !r.misses.length).length;
const dirRight = results.filter((r) => r.stored && r.entry.direction.includes(r.stored.profile.direction)).length;
const secs = results.filter((r) => r.secs).map((r) => r.secs).sort((a, b) => a - b);
const searches = results.reduce((s, r) => s + (r.stored?.searches || 0), 0) / runCount;

const lines = [
  "# Grinder profile eval",
  "",
  `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${key.length} grinders × ${RUNS} runs · \`${P.MODEL}\` · profile v${P.GRINDER_PROFILE_VERSION} · answer key \`scripts/fixtures/grinder-profiles.json\` (hand-verified against the sources listed there).`,
  "",
  `- Runs fully correct: ${passRuns}/${runCount}`,
  `- Direction correct: ${dirRight}/${runCount}`,
  `- Grinders correct on every run: ${byGrinder.filter((g) => g.allPass).length}/${key.length}; same direction across runs: ${byGrinder.filter((g) => g.consistent).length}/${key.length}`,
  `- Median latency ${secs[Math.floor(secs.length / 2)]?.toFixed(0)}s, ${searches.toFixed(1)} searches per run`,
  "",
  "| Grinder | Run | Result | Prompt line |",
  "|---|---|---|---|",
];
for (const g of byGrinder) {
  for (const r of g.runs) {
    const line = r.stored ? (P.formatGrinderLine(g.entry.name, r.stored) ?? "(not recognized)") : `error: ${r.error}`;
    lines.push(`| ${g.entry.name} | ${r.run} | ${r.misses.length ? r.misses.join("; ") : "✓"} | ${line.replace(/\|/g, "\\|")} |`);
  }
}
const outPath = path.join(REPO_ROOT, "docs/ai-analysis/grinder-profile-eval.md");
await fs.writeFile(outPath, lines.join("\n") + "\n");
console.log(lines.slice(4, 8).join("\n"));
console.log();
for (const r of results.filter((r) => r.misses.length)) console.log(`✗ ${r.entry.name} run ${r.run}: ${r.misses.join("; ")}\n    ${r.stored?.profile.settingFormat ?? r.error}`);
console.log(`\n[grinder-profiles] wrote ${path.relative(REPO_ROOT, outPath)}`);
