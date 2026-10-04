/**
 * Eval "arms": one way of producing improvement guidance (prompt version + model).
 *   old:<model>  frozen pre-overhaul prompt (scripts/lib/legacyPrompt.mjs)
 *   new:<model>  current brewPrompts.ts pipeline
 * Shared by the replay, improvement and first-brew evals.
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as P from "../../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { REPO_ROOT, callChat, costUsd } from "./household.mjs";
import { buildLegacyChatBody, buildLegacyImprovementPrompt, normalizeLegacy } from "./legacyPrompt.mjs";

/** "old:gpt-5.4,new:gpt-6.1-sol,new:gpt-5.4@7" — an optional @N sets the history length. */
export function parseArms(spec) {
  return spec.split(",").map((s) => {
    const [version, rest] = s.trim().split(":");
    const [model, history] = (rest ?? "").split("@");
    if (!["old", "new"].includes(version) || !model) throw new Error(`Bad arm "${s}" (expected old:<model> or new:<model>[@N])`);
    return { version, model, historyLimit: history ? parseInt(history, 10) : undefined, label: s.trim() };
  });
}

/** Coffee IDs whose histories the prompt rules were derived from; everything else is hold-out. */
export async function loadTuningCoffeeIds() {
  try {
    const fixtures = JSON.parse(await fs.readFile(path.join(REPO_ROOT, "scripts/fixtures/brew-sequences.json"), "utf8"));
    return new Set(fixtures.map((f) => f.coffeeId));
  } catch {
    return new Set();
  }
}

async function withRetry(fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

/**
 * Generate improvement guidance with one arm.
 * input: { coffee, coffees, householdBrews, coffeeBrews, sameCoffeeIds, baselineId, brewMethod, userNames, historyLimit, effort }
 * Returns { full, prompt, usage, costUsd, elapsedMs }.
 */
export async function generateGuidance(arm, input) {
  let prompt;
  let body;
  const historyLimit = arm.historyLimit ?? input.historyLimit;
  if (arm.version === "old") {
    prompt = buildLegacyImprovementPrompt(input.coffee, input.coffeeBrews, input.baselineId, historyLimit ?? 7);
    body = buildLegacyChatBody(prompt, arm.model);
  } else {
    const ctx = P.assembleGuidanceContext({
      coffee: input.coffee,
      coffees: input.coffees,
      householdBrews: input.householdBrews,
      brewMethod: input.brewMethod,
      sameCoffeeIds: input.sameCoffeeIds,
      baselineBrewId: input.baselineId,
      requesterUserId: input.requesterUserId,
      userNames: input.userNames,
      grinderProfiles: input.grinderProfiles,
      historyLimit,
    });
    prompt = P.buildImprovementPrompt(ctx);
    body = P.buildChatBody(
      arm.model,
      [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      input.effort ?? "medium",
      { name: "brew_guidance", schema: P.IMPROVEMENT_SCHEMA },
    );
  }
  const res = await withRetry(() => callChat(body));
  const parsed = JSON.parse(res.content ?? "null");
  const full = arm.version === "old" ? normalizeLegacy(parsed) : P.normalizeImprovement(parsed, prompt.user)?.full;
  if (!full) throw new Error(`Invalid guidance from ${arm.label}`);
  return { full, raw: parsed, concise: parsed?.concise, prompt, usage: res.usage, costUsd: costUsd(arm.model, res.usage), elapsedMs: res.elapsedMs };
}

// ---------------------------------------------------------------------------
// Applier: turns the first suggestion into the next brew's concrete settings.
// Same model and prompt for every arm, so it doesn't favor either side.
// ---------------------------------------------------------------------------

export const APPLIER_MODEL = "gpt-5.4";

const APPLIER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "grindSetting", "dosage", "finalWeight", "waterTemp"],
  properties: {
    kind: {
      type: "string",
      enum: ["change", "hold", "technique"],
      description:
        "change: a grind/dose/yield/temperature setting moves. hold: repeat the same settings. technique: puck prep, distribution, pour structure, agitation, pre-infusion, or a target time without a settings change.",
    },
    grindSetting: { type: "number" },
    dosage: { type: "number", description: "grams of coffee" },
    finalWeight: { type: "number", description: "grams of output (espresso) or total water (pour over / immersion)" },
    waterTemp: { type: "number", description: "°F" },
  },
};

const applierCache = new Map();

export async function applyFirstSuggestion({ method, grinderName, settings, suggestion }) {
  const key = JSON.stringify([method, settings, suggestion.parameter, suggestion.action]);
  if (applierCache.has(key)) return applierCache.get(key);
  const user = `A barista will follow ONLY this suggestion on their next ${method} brew. Return the exact settings they will use.

Current settings: grind ${settings.grindSetting} on ${grinderName || "their grinder"}, dose ${settings.dosage}g, ${method === "espresso" ? "yield" : "water"} ${settings.finalWeight}g, water ${settings.waterTemp}°F.

Suggestion: [${suggestion.parameter}] ${suggestion.action}

Rules:
- Change only what the suggestion names; copy every other setting unchanged.
- For a range ("0.3-0.5", "1-2°F") use the midpoint. "Finer"/"coarser" follow the grinder's direction as stated in the suggestion; if it gives a target value, use it.
- A ratio change keeps the dose and changes the ${method === "espresso" ? "yield" : "water"} unless the suggestion says otherwise.
- Repeat / hold / re-taste: kind "hold", settings unchanged. Technique-only or time-target advice: kind "technique", settings unchanged.`;
  const res = await withRetry(() =>
    callChat(P.buildChatBody(APPLIER_MODEL, [{ role: "user", content: user }], "low", { name: "next_settings", schema: APPLIER_SCHEMA })),
  );
  const out = JSON.parse(res.content);
  const result = { ...out, costUsd: costUsd(APPLIER_MODEL, res.usage) };
  applierCache.set(key, result);
  return result;
}

export const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "–");

export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const GENERIC_WORDS = new Set(["coffee", "coffees", "roasters", "roastery", "roasting", "co", "company", "espresso", "blend", "decaf", "light", "medium", "dark", "the", "bright", "sweet", "classic", "house"]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Other coffees' names and roasters that appear in `text`. Skips words that also describe the
 * target (its name, roaster, region, notes) and generic coffee words, so only real leaks count.
 */
export function otherCoffeeMentions(text, coffees, target, sameIds) {
  const own = `${target.name} ${target.roaster} ${target.region ?? ""} ${target.notes ?? ""}`.toLowerCase();
  const distinctive = (s) => {
    const words = String(s ?? "").replace(/["'”“]/g, " ").split(/\s+/).filter((w) => w && !GENERIC_WORDS.has(w.toLowerCase()) && !/^[\d.x]+$/i.test(w));
    const phrase = words.join(" ").trim();
    return phrase.length > 3 && !own.includes(phrase.toLowerCase()) ? phrase : null;
  };
  const terms = new Set();
  for (const c of coffees) {
    if (sameIds.includes(c.id)) continue;
    const name = distinctive(c.name);
    if (name) terms.add(name);
    const roaster = distinctive(c.roaster);
    if (roaster && roaster.toLowerCase() !== target.roaster?.trim().toLowerCase()) terms.add(roaster);
  }
  return [...terms].filter((t) => new RegExp(`\\b${escapeRe(t)}\\b`, "i").test(text));
}

export function argValue(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
