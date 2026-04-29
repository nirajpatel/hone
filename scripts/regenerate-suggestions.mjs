#!/usr/bin/env node
/**
 * Regenerate AI suggestions for the most-recent brew of every coffee a user
 * has brewed. Uses the NEW prompt + gpt-5.4 (mirrors the current edge function
 * code at supabase/functions/make-server-23508aac/index.ts), then writes the
 * new `suggestion: { concise, full }` payload back to kv_store_23508aac.
 *
 * Required env (read from .env if present):
 *   SUPABASE_URL or VITE_SUPABASE_PROJECT_ID
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *   ANALYZE_USER_ID (defaults to VITE_LAMARZOCCO_ALLOWED_USER_ID)
 *
 * Usage:
 *   node scripts/regenerate-suggestions.mjs                # all coffees, write
 *   node scripts/regenerate-suggestions.mjs --dry-run      # build prompts, no OpenAI/write
 *   node scripts/regenerate-suggestions.mjs --limit 5      # only first 5 coffees
 *   node scripts/regenerate-suggestions.mjs --coffee <id>  # one coffee only
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

async function loadDotenv() {
  try {
    const raw = await fs.readFile(path.join(REPO_ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      if (process.env[m[1]] === undefined)
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}
await loadDotenv();

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || process.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  (PROJECT_REF ? `https://${PROJECT_REF}.supabase.co` : null);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.TEST_MODEL || "gpt-5.4";
const ANALYZE_USER_ID =
  process.env.ANALYZE_USER_ID || process.env.VITE_LAMARZOCCO_ALLOWED_USER_ID;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.");
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY in .env.");
  process.exit(1);
}
if (!ANALYZE_USER_ID) {
  console.error("Missing ANALYZE_USER_ID in .env.");
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) || Infinity : Infinity;
const coffeeIdx = args.indexOf("--coffee");
const ONLY_COFFEE = coffeeIdx >= 0 ? args[coffeeIdx + 1] : null;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ------------------------------------------------------------------------
// KV helpers
// ------------------------------------------------------------------------
async function getByPrefix(prefix) {
  const PAGE = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb
      .from("kv_store_23508aac")
      .select("key,value")
      .like("key", `${prefix}%`)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
async function getKey(key) {
  const { data, error } = await sb
    .from("kv_store_23508aac")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value;
}
async function setKey(key, value) {
  const { error } = await sb
    .from("kv_store_23508aac")
    .upsert({ key, value });
  if (error) throw error;
}

// ------------------------------------------------------------------------
// Mirror the edge function's prompt (must stay in sync with
// supabase/functions/make-server-23508aac/index.ts buildBrewRules + the full
// suggestion prompt at ~L2449)
// ------------------------------------------------------------------------
function getQualityLabel(q) {
  return !q ? "Not rated" : q === 1 ? "Bad" : q === 2 ? "Decent" : "Excellent";
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatBrewMethodDetails(brew, method) {
  if (method === "pour over" && brew.stages) {
    return `\n- Stages: ${brew.stages
      .map((s, i) => `Stage ${i + 1}: ${s.endTime}s / ${s.endWeight}g`)
      .join(", ")}`;
  }
  if (method === "immersion") {
    return `\n- Steep Time: ${brew.brewTime}s\n- Final Weight: ${brew.finalWeight}g`;
  }
  return `\n- Extraction Time: ${brew.brewTime}s\n- Final Weight: ${brew.finalWeight}g`;
}
function buildBrewRules(brewMethod) {
  const espressoFlow =
    brewMethod === "espresso"
      ? `\n   - Flow behavior / puck preparation (if flow issues indicate channeling, address distribution, tamping, or pre-infusion before changing core parameters)`
      : "";
  const immersionTime = brewMethod === "immersion" ? `\n   - Steep time` : "";
  return `
IMPORTANT CONSIDERATIONS:
1. Focus on the REFERENCE BREW (marked with ⭐): Your suggestions should specifically address how to improve THIS brew. Use the brew history to understand what has been tried.
2. Equipment: Consider grinder scale direction (some use lower numbers for finer, others higher), sensitivity (stepless grinders like Niche Zero are highly sensitive ~0.5 adjustments, stepped grinders need 2-3 step adjustments), and brewer characteristics when making suggestions.
3. Anti-repeat escalation: When the same parameter+direction has been suggested in any of the three prior brews on this coffee, you MUST NOT repeat the same magnitude. Either (a) escalate the magnitude meaningfully (~2× the prior step) and explain why, (b) switch to a different parameter from the decision hierarchy, or (c) explicitly recommend holding all parameters and re-tasting to confirm the diagnosis. The minimal-change preference does not apply once a small step in this direction has already been tried without improvement.
4. NO BREW IDs: Do not reference brew numbers (like "Brew #1" or "#3") in your response. When referring to previous brews, use descriptive terms like "previous attempts", "an earlier excellent brew", etc. The user does not have access to brew numbers.
5. Baseline Brew Terminology: When referring to the REFERENCE BREW (marked with ⭐) in your summary or suggestions, always use the term "baseline brew". This brew is the starting point for improvement suggestions.
6. Do not infer causes that are not supported by recorded data.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless history strongly suggests otherwise; default to small steps for the first attempt at a parameter, then escalate per rule 3):
   - Grind setting${espressoFlow}
   - Final weight / ratio${immersionTime}
   - Water temperature
   - Dose

B) Require directional reasoning (no vague advice):
   - Each suggestion must specify the exact direction and a small magnitude that fits the grinder/equipment (example: "Grind finer by ~0.3–0.5 on Niche Zero").
   - Each suggestion must include the expected taste/texture impact (example: "should reduce sourness and increase body").

C) Confidence score:
   - Every suggestion must include a confidence score: High / Medium / Low.
   - Use "High" only when supported by at least two prior brews or a direct comparison.
   - Downgrade confidence to Medium or Low whenever the most recent brew that followed a similar suggestion regressed in quality, or whenever the suggested direction would push past a known-good baseline value (e.g. a previous excellent brew used a coarser grind than what you're proposing).

D) Primary failure mode:
   - Identify exactly ONE primary failure mode for the baseline brew (e.g., "under-extracted due to fast flow" or "over-extracted due to excessive yield"). All suggestions must directly address it.
   - Re-derive this from the baseline brew's recorded outcome alone; do not carry forward the diagnosis from any prior brew. If the same diagnosis recurs across consecutive brews despite parameter changes, treat that as evidence the diagnosis itself is wrong and consider an alternative cause (e.g. dose / ratio rather than grind, or puck preparation).

E) Quality over quantity:
   - If fewer than three high-quality, non-redundant suggestions exist, provide fewer.
   - It is acceptable to provide only 1-2 suggestions if those are the most impactful.
   - Do not suggest adjusting parameters that are already optimal or not contributing to the issue.

F) Exceptional brews:
   - If the history contains an exceptional brew, it is acceptable to recommend reverting one or more parameters back toward that setup, with reasoning. Reverting to a previously successful setting is not considered repetition.
   - When referring to it, use descriptive language like "an earlier exceptional brew" without mentioning brew numbers.
   - If a parameter appears optimal based on excellent brews, explicitly state it should remain unchanged.`;
}

function buildPrompt(coffee, baselineBrew, brewsForCoffee) {
  const exceptionalBrew = brewsForCoffee.find((b) => b.quality === 3);
  // Mirror the edge function: top 7 most recent + baseline + exceptional
  const sortedDesc = [...brewsForCoffee].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const top7 = sortedDesc.slice(0, 7);
  const top7Ids = new Set(top7.map((b) => b.id));
  const list = [...top7];
  if (!top7Ids.has(baselineBrew.id)) list.push(baselineBrew);
  if (exceptionalBrew && !list.find((b) => b.id === exceptionalBrew.id)) {
    list.push(exceptionalBrew);
  }
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const tagged = list.map((b) => ({
    ...b,
    isBaseline: b.id === baselineBrew.id,
    isExceptional: exceptionalBrew && b.id === exceptionalBrew.id,
  }));

  const coffeeInfo = `COFFEE:
- Name: ${coffee.name}
- Roaster: ${coffee.roaster}
- Brew Method: ${baselineBrew.brewMethod}${coffee.region ? `\n- Region: ${coffee.region}` : ""}${coffee.roastLevel ? `\n- Roast Level: ${coffee.roastLevel}` : ""}${coffee.notes ? `\n- Flavor Notes: ${coffee.notes}` : ""}`;

  let brewHistoryText = `BREW HISTORY (Most recent to oldest):\n`;
  tagged.forEach((b, i) => {
    const n = i + 1;
    const tags =
      b.isBaseline && b.isExceptional
        ? " ⭐ REFERENCE BREW, 🏆 BEST RECORDED BREW"
        : b.isBaseline
        ? " ⭐ REFERENCE BREW"
        : b.isExceptional
        ? " 🏆 BEST RECORDED BREW"
        : "";
    brewHistoryText += `\nBREW #${n} (${fmtDate(b.createdAt)})${tags}:
- Brewer: ${b.brewerName || "Not specified"}
- Grinder: ${b.grinderName || "Not specified"}
- Bean Temperature: ${b.coffeeTemperature === "frozen" ? "Frozen" : "Room Temperature"}
- Grind Setting: ${b.grindSetting}
- Dosage: ${b.dosage}g
- Water Temperature: ${b.waterTemp ? `${b.waterTemp}°F` : "Not recorded"}`;
    brewHistoryText += formatBrewMethodDetails(b, baselineBrew.brewMethod);
    brewHistoryText += `\n- Quality Rating: ${getQualityLabel(b.quality)}${
      b.tastingNotes ? `\n- Tasting Notes: ${b.tastingNotes}` : ""
    }${
      b.personalNotes || b.notes
        ? `\n- Extraction Notes: ${b.personalNotes || b.notes}`
        : ""
    }\n`;
  });

  return `You are an expert barista analyzing the brew history for a specific coffee to provide improvement suggestions.

${coffeeInfo}

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

${brewHistoryText}${buildBrewRules(baselineBrew.brewMethod)}

TONE AND VOICE:
Use a calm, confident, craft-focused tone.
Sound like an experienced specialty barista giving guidance.

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no code blocks, just raw JSON. Use this exact structure:

{
  "summary": "Brief diagnostic summary (1-2 sentences). State the outcome (quality rating and key tasting notes) and what was missing or wrong. Avoid hedging language like 'likely', 'suggests', 'step in the right direction'. Collapse cause and effect into one sentence.",
  "primaryIssue": "The primary failure mode (e.g., 'under-extracted due to fast flow' or 'over-extracted due to excessive yield')",
  "concise": {
    "goal": "2-3 words describing the primary goal based on the FIRST suggestion (e.g., 'Reduce sourness', 'Increase body', 'Fix channeling')",
    "action": "2-4 words describing the action from the FIRST suggestion (e.g., 'Grind finer', 'Increase temperature', 'Reduce final weight')",
    "confidence": "High" | "Medium" | "Low" (same as first suggestion's confidence)
  },
  "suggestions": [
    {
      "parameter": "Parameter name",
      "action": "Action with specific magnitude (no period at end)",
      "effect": "Expected taste/texture effect as a complete sentence starting with 'This will' or 'This should' (no period at end)",
      "reasoning": "Concise explanation (1 sentence) of why this works based on brew history. Do NOT reference brew numbers (no period at end)",
      "confidence": "High" | "Medium" | "Low"
    }
  ]
}

REQUIREMENTS:
- You must provide at least 1 suggestion and at most 3 suggestions
- Each suggestion must follow the structure: Action → Expected effect → Why it matters (based on history)
- Only include high-quality, non-redundant suggestions
- CRITICAL: Order suggestions by importance - the first suggestion should be the highest confidence change with the greatest likely impact
- The concise format MUST be derived from the FIRST suggestion in the suggestions array
- Concise goal must be exactly 2-3 words - extract the primary goal from the first suggestion's effect text
- Concise action must be exactly 2-4 words - extract from the first suggestion's action, removing magnitude/details (e.g., "Increase water temperature by 2-3°F" becomes "Increase temperature")
- Concise confidence must match the first suggestion's confidence exactly`;
}

const SYSTEM_MSG =
  "You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.";

async function callOpenAI(prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_MSG },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 400)}`);
  }
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content,
    usage: data.usage,
  };
}

// Mirror the edge function's parsing + concise fallback.
function parseAndNormalize(content) {
  const full = JSON.parse(content);
  if (
    !full.summary ||
    !full.primaryIssue ||
    !Array.isArray(full.suggestions) ||
    full.suggestions.length === 0
  ) {
    throw new Error("Invalid full format: missing summary/primaryIssue/suggestions");
  }
  const confOrder = { High: 0, Medium: 1, Low: 2 };
  full.suggestions.sort(
    (a, b) => (confOrder[a.confidence] ?? 999) - (confOrder[b.confidence] ?? 999)
  );
  let concise;
  if (full.concise?.goal && full.concise?.action && full.concise?.confidence) {
    concise = {
      goal: full.concise.goal,
      action: full.concise.action,
      confidence: full.concise.confidence,
    };
    // Match concise confidence to first suggestion
    const first = full.suggestions[0];
    if (concise.confidence !== first.confidence) {
      concise.confidence = first.confidence;
    }
  } else {
    const first = full.suggestions[0];
    concise = {
      goal: "Improve balance",
      action: first.action.split(/\s+/).slice(0, 4).join(" "),
      confidence: first.confidence,
    };
  }
  return {
    concise,
    full: {
      summary: full.summary,
      primaryIssue: full.primaryIssue,
      suggestions: full.suggestions,
    },
  };
}

// ------------------------------------------------------------------------
// Main
// ------------------------------------------------------------------------
console.log(`[regen] connecting to ${SUPABASE_URL}`);
console.log(`[regen] target user: ${ANALYZE_USER_ID}  model: ${MODEL}  dry-run: ${DRY_RUN}`);

const userRecord = await getKey(`user:${ANALYZE_USER_ID}`);
if (!userRecord) {
  console.error("Target user not found.");
  process.exit(1);
}

let householdMemberIds = [ANALYZE_USER_ID];
if (userRecord.householdId) {
  const allUsers = (await getByPrefix("user:")).map((r) => r.value);
  householdMemberIds = allUsers
    .filter((u) => u && u.id && u.householdId === userRecord.householdId)
    .map((u) => u.id);
  if (!householdMemberIds.includes(ANALYZE_USER_ID))
    householdMemberIds.push(ANALYZE_USER_ID);
}
const householdSet = new Set(householdMemberIds);
console.log(`[regen] household members: ${householdMemberIds.length}`);

const [coffeeRows, brewRows] = await Promise.all([
  getByPrefix("coffee:"),
  getByPrefix("brew:"),
]);
const coffeesById = new Map(
  coffeeRows.map((r) => r.value).filter((c) => c && c.id).map((c) => [c.id, c])
);
const allBrews = brewRows.map((r) => r.value).filter(Boolean);
const householdBrews = allBrews.filter((b) => b && householdSet.has(b.userId));

// Group by coffee, find newest brew per coffee
const byCoffee = new Map();
for (const b of householdBrews) {
  if (!b.coffeeId) continue;
  if (!byCoffee.has(b.coffeeId)) byCoffee.set(b.coffeeId, []);
  byCoffee.get(b.coffeeId).push(b);
}
for (const arr of byCoffee.values()) {
  arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

const targets = [...byCoffee.entries()]
  .map(([coffeeId, brews]) => ({
    coffeeId,
    coffee: coffeesById.get(coffeeId) || {
      id: coffeeId,
      name: brews[0]?.coffeeName || "(unknown)",
      roaster: brews[0]?.roaster || "(unknown)",
    },
    newestBrew: brews[0],
    allBrews: brews,
  }))
  .filter((t) => (ONLY_COFFEE ? t.coffeeId === ONLY_COFFEE : true))
  .sort((a, b) => new Date(b.newestBrew.createdAt) - new Date(a.newestBrew.createdAt))
  .slice(0, LIMIT);

console.log(`[regen] ${targets.length} coffees to process`);
console.log("");

const summary = { ok: 0, skipped: 0, failed: 0, totalTokens: 0 };
for (const t of targets) {
  const tag = `${t.coffee.roaster} — ${t.coffee.name}`;
  const newest = t.newestBrew;
  if (!newest.brewMethod) {
    console.log(`[skip] ${tag}: newest brew has no brewMethod`);
    summary.skipped++;
    continue;
  }
  if (!newest.grindSetting && !newest.dosage) {
    console.log(`[skip] ${tag}: newest brew lacks grind/dose data`);
    summary.skipped++;
    continue;
  }

  const prompt = buildPrompt(t.coffee, newest, t.allBrews);

  if (DRY_RUN) {
    console.log(`[dry] ${tag} brew=${newest.id.slice(0, 8)} prompt=${prompt.length} chars`);
    continue;
  }

  process.stdout.write(`[regen] ${tag} (brew ${newest.id.slice(0, 8)})… `);
  try {
    const t0 = Date.now();
    const res = await callOpenAI(prompt);
    if (!res.content) throw new Error("empty content");
    const normalized = parseAndNormalize(res.content);

    // re-fetch the brew to avoid clobbering concurrent writes
    const fresh = await getKey(`brew:${newest.id}`);
    if (!fresh) {
      throw new Error("brew disappeared during regenerate");
    }
    const updated = {
      ...fresh,
      suggestion: { concise: normalized.concise, full: normalized.full },
    };
    await setKey(`brew:${newest.id}`, updated);

    const elapsed = Date.now() - t0;
    summary.ok++;
    summary.totalTokens += res.usage?.total_tokens || 0;
    console.log(
      `ok (${elapsed}ms, ${res.usage?.total_tokens || 0} tok) → "${normalized.concise.goal} / ${normalized.concise.action}" [${normalized.concise.confidence}]`
    );
  } catch (e) {
    summary.failed++;
    console.log(`FAIL: ${e.message}`);
  }
}

console.log("");
console.log(`[regen] done. ok=${summary.ok}, skipped=${summary.skipped}, failed=${summary.failed}, tokens=${summary.totalTokens}`);
