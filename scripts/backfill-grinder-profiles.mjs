#!/usr/bin/env node
/**
 * Backfill grinder profiles (grinder-profile:<model> in the KV store). Generates a profile for every
 * grinder that has none, or one from an older GRINDER_PROFILE_VERSION. New and renamed grinders get
 * one in the background from the edge function.
 *
 * Usage:
 *   node scripts/backfill-grinder-profiles.mjs             # missing or outdated profiles only
 *   node scripts/backfill-grinder-profiles.mjs --force     # regenerate every profile
 *   node scripts/backfill-grinder-profiles.mjs --dry-run   # list what would be generated
 */
import * as P from "../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { generateGrinderProfile, getByPrefix, requireEnv, setKey } from "./lib/household.mjs";
import { mapLimit } from "./lib/guidanceArms.mjs";

requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY");

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");

const [equipment, brews, existing] = await Promise.all([
  getByPrefix("equipment:"),
  getByPrefix("brew:"),
  getByPrefix("grinder-profile:"),
]);
const current = new Set(existing.filter(P.isCurrentGrinderProfile).map((p) => P.grinderProfileKey(p.name)));

// Brews carry the grinder name too, which covers grinders whose equipment record was deleted.
const names = new Map();
for (const name of [
  ...equipment.filter((e) => e.type === "grinder").map(P.grinderLabel),
  ...brews.map((b) => b.grinderName).filter(Boolean),
]) {
  const key = P.grinderProfileKey(name);
  if (key && !names.has(key)) names.set(key, name.trim());
}
const todo = [...names].filter(([key]) => FORCE || !current.has(key));
console.log(`[grinder-backfill] ${names.size} grinder models, ${current.size} with a v${P.GRINDER_PROFILE_VERSION} profile, ${todo.length} to generate${DRY_RUN ? " (dry run)" : ""}\n`);
if (DRY_RUN) {
  for (const [, name] of todo) console.log(`- ${name}`);
  process.exit(0);
}

let failed = 0;
await mapLimit(todo, 6, async ([key, name]) => {
  try {
    const stored = await generateGrinderProfile(P, name);
    await setKey(key, stored);
    console.log(`${stored.searches ? "🔎" : "  "} ${P.formatGrinderLine(name, stored) ?? `${name}: not recognized`}`);
  } catch (error) {
    failed++;
    console.error(`✗ ${name}: ${error.message}`);
  }
});
console.log(`\n[grinder-backfill] done · ${todo.length - failed} saved, ${failed} failed (🔎 = used web search)`);
