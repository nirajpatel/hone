#!/usr/bin/env node
/**
 * Regenerate AI guidance for the most recent brew of every coffee a household
 * has brewed, using the same prompt module as the edge function, and write
 * `suggestion: { concise, full }` back to kv_store_23508aac.
 *
 * Required env (read from .env): SUPABASE_URL or VITE_SUPABASE_PROJECT_ID,
 * SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ANALYZE_USER_ID.
 *
 * Usage:
 *   node scripts/regenerate-suggestions.mjs                 # all coffees, write
 *   node scripts/regenerate-suggestions.mjs --dry-run       # build prompts only
 *   node scripts/regenerate-suggestions.mjs --print         # dry run + print each prompt
 *   node scripts/regenerate-suggestions.mjs --limit 5       # first 5 coffees
 *   node scripts/regenerate-suggestions.mjs --coffee <id>   # one coffee
 *   TEST_MODEL=gpt-6.1-sol node scripts/regenerate-suggestions.mjs
 */
import * as P from "../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { ANALYZE_USER_ID, callChat, getKey, loadHousehold, requireEnv, setKey, SUPABASE_URL } from "./lib/household.mjs";

const args = process.argv.slice(2);
const PRINT = args.includes("--print");
const DRY_RUN = PRINT || args.includes("--dry-run");
const argValue = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
const LIMIT = parseInt(argValue("--limit"), 10) || Infinity;
const ONLY_COFFEE = argValue("--coffee");
const MODEL = process.env.TEST_MODEL || P.MODEL;

requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANALYZE_USER_ID", ...(DRY_RUN ? [] : ["OPENAI_API_KEY"]));

console.log(`[regen] ${SUPABASE_URL} user=${ANALYZE_USER_ID} model=${MODEL} dry-run=${DRY_RUN}`);
const hh = await loadHousehold();
const coffeesById = new Map(hh.coffees.map((c) => [c.id, c]));

const newestByCoffee = new Map();
for (const b of hh.householdBrews) {
  if (!b.coffeeId) continue;
  const cur = newestByCoffee.get(b.coffeeId);
  if (!cur || new Date(b.createdAt) > new Date(cur.createdAt)) newestByCoffee.set(b.coffeeId, b);
}
const targets = [...newestByCoffee.values()]
  .filter((b) => (ONLY_COFFEE ? b.coffeeId === ONLY_COFFEE : true))
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  .slice(0, LIMIT);
console.log(`[regen] ${targets.length} coffees to process\n`);

const summary = { ok: 0, skipped: 0, failed: 0, tokens: 0 };
for (const newest of targets) {
  const coffee = coffeesById.get(newest.coffeeId) || { id: newest.coffeeId, name: newest.coffeeName || "(unknown)", roaster: newest.roaster || "(unknown)" };
  const tag = `${coffee.roaster} — ${coffee.name}`;
  if (!newest.brewMethod || (!newest.grindSetting && !newest.dosage)) {
    console.log(`[skip] ${tag}: newest brew lacks method or parameters`);
    summary.skipped++;
    continue;
  }

  const ctx = P.assembleGuidanceContext({
    coffee,
    coffees: hh.coffees,
    householdBrews: hh.householdBrews,
    brewMethod: newest.brewMethod,
    sameCoffeeIds: P.findSameCoffeeIds(coffee, hh.coffees, hh.aliases),
    baselineBrewId: newest.id,
    requesterUserId: newest.userId,
    userNames: hh.userNames,
    grinderProfiles: hh.grinderProfiles,
  });
  const prompt = P.buildImprovementPrompt(ctx);

  if (DRY_RUN) {
    console.log(`[dry] ${tag} brew=${newest.id.slice(0, 8)} rows=${ctx.historyRows.length} ledger=${ctx.ledger.length} profile=${ctx.profileLines.length} prompt=${prompt.user.length} chars`);
    if (PRINT) console.log(`\n${prompt.user}\n${"-".repeat(80)}`);
    continue;
  }

  process.stdout.write(`[regen] ${tag} (brew ${newest.id.slice(0, 8)})… `);
  try {
    const inputsKey = P.regenInputsKey(newest);
    const res = await callChat(
      P.buildChatBody(MODEL, [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }], "medium", {
        name: "brew_guidance",
        schema: P.IMPROVEMENT_SCHEMA,
      }),
    );
    const result = P.normalizeImprovement(JSON.parse(res.content || "null"), prompt.user);
    if (!result) throw new Error(`invalid output (finish_reason=${res.finishReason})`);
    const fresh = await getKey(`brew:${newest.id}`);
    if (!fresh) throw new Error("brew disappeared during regenerate");
    if (P.regenInputsKey(fresh) !== inputsKey) throw new Error("brew changed during regenerate; not saved");
    await setKey(`brew:${newest.id}`, { ...fresh, suggestion: result });
    summary.ok++;
    summary.tokens += res.usage?.total_tokens || 0;
    console.log(`ok (${res.elapsedMs}ms, ${res.usage?.total_tokens || 0} tok) → "${result.concise.goal} / ${result.concise.action}" [${result.concise.confidence}]`);
  } catch (e) {
    summary.failed++;
    console.log(`FAIL: ${e.message}`);
  }
}

console.log(`\n[regen] done. ok=${summary.ok}, skipped=${summary.skipped}, failed=${summary.failed}, tokens=${summary.tokens}`);
