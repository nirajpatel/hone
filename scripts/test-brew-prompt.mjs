#!/usr/bin/env node
/**
 * A/B-test the OLD vs NEW brew-suggestion prompt against gpt-5.4 over real
 * brew fixtures pulled by analyze-brew-prompts.mjs.
 *
 * Scoring:
 *   A. Issue-fix checks (one per failure mode found in Step 3)
 *   B. Voice / conciseness regression guard
 *
 * Writes: docs/ai-analysis/prompt-eval.md
 *
 * Required env (read from .env if present):
 *   OPENAI_API_KEY
 *
 * Usage:
 *   node scripts/test-brew-prompt.mjs                  # run all eligible fixtures
 *   node scripts/test-brew-prompt.mjs --max 8          # cap brews evaluated
 *   node scripts/test-brew-prompt.mjs --coffee <id>    # only one coffee
 */
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

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.TEST_MODEL || "gpt-5.4";
if (!OPENAI_KEY) {
  console.error("Missing OPENAI_API_KEY. Add it to .env.");
  process.exit(1);
}

const args = process.argv.slice(2);
const maxIdx = args.indexOf("--max");
const MAX_BREWS = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) || Infinity : Infinity;
const coffeeIdx = args.indexOf("--coffee");
const ONLY_COFFEE = coffeeIdx >= 0 ? args[coffeeIdx + 1] : null;

// ------------------------------------------------------------------------
// 1. Load fixtures
// ------------------------------------------------------------------------
const fixturesPath = path.join(REPO_ROOT, "scripts", "fixtures", "brew-sequences.json");
const fixtures = JSON.parse(await fs.readFile(fixturesPath, "utf8"));
console.log(`[eval] loaded ${fixtures.length} coffee sequences`);

// ------------------------------------------------------------------------
// 2. Reproduce both prompt builders. The OLD prompt is a verbatim copy of
//    the pre-edit prompt at supabase/functions/make-server-23508aac/index.ts
//    (commit before this PR). The NEW prompt mirrors the current edge-function
//    code (using buildBrewRules).
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

function buildHistoryAndCoffeeBlocks(coffee, brews, baselineId) {
  const baseline = brews.find((b) => b.id === baselineId);
  const exceptional = brews.find((b) => b.quality === 3);

  const top7 = [...brews]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 7);
  const set = new Set(top7.map((b) => b.id));
  const list = [...top7];
  if (!set.has(baselineId) && baseline) list.push(baseline);
  if (exceptional && !list.find((b) => b.id === exceptional.id)) list.push(exceptional);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const tagged = list.map((b) => ({
    ...b,
    isBaseline: b.id === baselineId,
    isExceptional: exceptional && b.id === exceptional.id,
  }));

  const coffeeInfo = `COFFEE:
- Name: ${coffee.name}
- Roaster: ${coffee.roaster}
- Brew Method: ${baseline.brewMethod}${coffee.region ? `\n- Region: ${coffee.region}` : ""}${coffee.roastLevel ? `\n- Roast Level: ${coffee.roastLevel}` : ""}${coffee.notes ? `\n- Flavor Notes: ${coffee.notes}` : ""}`;

  let hist = `BREW HISTORY (Most recent to oldest):\n`;
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
    hist += `\nBREW #${n} (${fmtDate(b.createdAt)})${tags}:
- Brewer: ${b.brewerName || "Not specified"}
- Grinder: ${b.grinderName || "Not specified"}
- Bean Temperature: ${b.coffeeTemperature === "frozen" ? "Frozen" : "Room Temperature"}
- Grind Setting: ${b.grindSetting}
- Dosage: ${b.dosage}g
- Water Temperature: ${b.waterTemp ? `${b.waterTemp}°F` : "Not recorded"}`;
    hist += formatBrewMethodDetails(b, baseline.brewMethod);
    hist += `\n- Quality Rating: ${getQualityLabel(b.quality)}${
      b.tastingNotes ? `\n- Tasting Notes: ${b.tastingNotes}` : ""
    }${
      b.personalNotes ? `\n- Extraction Notes: ${b.personalNotes}` : ""
    }\n`;
  });

  return { coffeeInfo, hist };
}

const OLD_RULES = `
IMPORTANT CONSIDERATIONS:
1. Focus on the REFERENCE BREW (marked with ⭐): Your suggestions should specifically address how to improve THIS brew. Use the brew history to understand what has been tried and avoid suggesting the same adjustments that were already attempted.
2. Equipment: Consider grinder scale direction (some use lower numbers for finer, others higher), sensitivity (stepless grinders like Niche Zero are highly sensitive ~0.5 adjustments, stepped grinders need 2-3 step adjustments), and brewer characteristics when making suggestions.
3. Avoid Repetition: Review the previous brews to ensure you're not suggesting something that was already tried. If a previous brew tried a parameter change and it didn't improve things, suggest a different approach.
4. NO BREW IDs: Do not reference brew numbers (like "Brew #1" or "#3") in your response. When referring to previous brews, use descriptive terms like "previous attempts", "an earlier excellent brew", etc. The user does not have access to brew numbers.
5. Baseline Brew Terminology: When referring to the REFERENCE BREW (marked with ⭐) in your summary or suggestions, always use the term "baseline brew" instead of "most recent brew" or "best brew". This brew is the starting point for improvement suggestions.
6. Do not infer causes that are not supported by recorded data.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy and change magnitude (use this order unless history strongly suggests otherwise, prefer minimal changes):
   - Grind / flow behavior
   - Final weight / ratio
   - Water temperature
   - Dose
   - If flow issues indicate puck preparation or channeling, address distribution, tamping, or pre-infusion before changing core parameters.
   - Prefer the smallest reasonable change that could plausibly fix the issue. Avoid large jumps unless history clearly shows they are necessary.

B) Require directional reasoning (no vague advice):
   - Each suggestion must specify the exact direction and a small magnitude that fits the grinder/equipment (example: "Grind finer by ~0.3–0.5 on Niche Zero").
   - Each suggestion must include the expected taste/texture impact (example: "should reduce sourness and increase body").

C) Confidence score:
   - Every suggestion must include a confidence score: High / Medium / Low.
   - Confidence should reflect how strongly the brew history supports the change (e.g., repeated evidence vs weak signal).
   - Use "High" only when supported by at least two prior brews or a direct comparison.

D) Primary failure mode:
   - Before listing suggestions, identify exactly ONE primary failure mode for the selected brew (e.g., "under-extracted due to fast flow" or "over-extracted due to excessive yield").
   - All suggestions must directly address this failure mode.

E) Quality over quantity:
   - If fewer than three high-quality, non-redundant suggestions exist, provide fewer suggestions rather than forcing additional ones.
   - It is acceptable to provide only 1-2 suggestions if those are the most impactful changes.
   - Do not suggest adjusting parameters that are already optimal or not contributing to the issue.

F) Exceptional brews:
   - If the history contains an exceptional brew, it is acceptable to recommend reverting one or more parameters back toward that setup, with reasoning.
   - Reverting to a previously successful setting is not considered repetition.
   - When referring to it, use descriptive language like "an earlier exceptional brew" without mentioning brew numbers.

G) Stability check:
   - If a parameter appears optimal based on excellent brews, explicitly state that it should remain unchanged.`;

function buildNewRules(brewMethod) {
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

const OUTPUT_FORMAT = `

TONE AND VOICE:
Use a calm, confident, craft-focused tone.
Sound like an experienced specialty barista giving guidance.

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no code blocks, just raw JSON. Use this exact structure:

{
  "summary": "Brief diagnostic summary (1-2 sentences). State the outcome (quality rating and key tasting notes) and what was missing or wrong. Avoid hedging language like 'likely', 'suggests', 'step in the right direction'. Collapse cause and effect into one sentence.",
  "primaryIssue": "The primary failure mode (e.g., 'under-extracted due to fast flow' or 'over-extracted due to excessive yield')",
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
- Only include high-quality, non-redundant suggestions`;

function buildPrompt(coffee, brews, baselineId, version) {
  const baseline = brews.find((b) => b.id === baselineId);
  const { coffeeInfo, hist } = buildHistoryAndCoffeeBlocks(coffee, brews, baselineId);
  const rules = version === "old" ? OLD_RULES : buildNewRules(baseline.brewMethod);
  return `You are an expert barista analyzing the brew history for a specific coffee to provide improvement suggestions.

${coffeeInfo}

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

${hist}${rules}${OUTPUT_FORMAT}`;
}

const SYSTEM_MSG =
  "You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.";

// ------------------------------------------------------------------------
// 3. OpenAI call
// ------------------------------------------------------------------------
async function callOpenAI(prompt) {
  const t0 = Date.now();
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
  const elapsed = Date.now() - t0;
  return {
    content: data.choices?.[0]?.message?.content,
    usage: data.usage,
    elapsedMs: elapsed,
  };
}

// ------------------------------------------------------------------------
// 4. Pick which brews to score per fixture: those with a real quality rating
//    AND at least 2 prior brews (so the failure modes can manifest).
// ------------------------------------------------------------------------
function eligibleTargets(seq) {
  return seq.brews
    .map((b, i) => ({ b, i }))
    .filter(({ b, i }) => i >= 2 && b.quality)
    .map(({ b }) => b);
}

// ------------------------------------------------------------------------
// 5. Scorers
// ------------------------------------------------------------------------
function normalizeParameter(label) {
  if (!label) return null;
  const s = label.toLowerCase();
  if (s.includes("grind")) return "grindSetting";
  if (s.includes("dose") || s.includes("dosage")) return "dosage";
  if (s.includes("water") && s.includes("temp")) return "waterTemp";
  if (s.includes("temperature")) return "waterTemp";
  if (s.includes("ratio") || s.includes("yield") || s.includes("final weight") || s.includes("output"))
    return "finalWeight";
  if (s.includes("time") || s.includes("steep") || s.includes("extraction time"))
    return "brewTime";
  return null;
}
function extractDirection(action) {
  if (!action) return null;
  const s = action.toLowerCase();
  if (/(finer|smaller|decrease|reduce|lower|down|less|tight)/.test(s)) return "down";
  if (/(coarser|larger|increase|raise|higher|up|more|loose|extend|longer)/.test(s)) return "up";
  return null;
}
// Pull the maximum numeric magnitude from an action string. Handles
// "0.3-0.5", "by ~0.5 to 1.0", "from 5.0 to 4.5" (returns the delta in that
// case as |to - from|), bare numbers, and percentages. Returns 0 if nothing
// useful is found.
function maxMagnitude(action) {
  if (!action) return 0;
  // 1) Explicit "by X" or "by ~X" or "by X to Y" magnitude clause -- preferred.
  const byClause = action.match(
    /by\s*(?:about\s+|~)?\s*(\d+(?:\.\d+)?)\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)|by\s*(?:about\s+|~)?\s*(\d+(?:\.\d+)?)/i
  );
  if (byClause) {
    const nums = [byClause[1], byClause[2], byClause[3]]
      .filter(Boolean)
      .map((n) => parseFloat(n));
    return Math.max(...nums);
  }
  // 2) "from X to Y" -- compute the absolute delta (real magnitude).
  const fromTo = action.match(
    /from\s+(?:about\s+|~)?(\d+(?:\.\d+)?)\s*(?:to|→|->)\s*(?:about\s+|~)?(\d+(?:\.\d+)?)/i
  );
  if (fromTo) {
    return Math.abs(parseFloat(fromTo[1]) - parseFloat(fromTo[2]));
  }
  return 0;
}

function meanWordsPerSentence(text) {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return 0;
  return (
    sentences.reduce((sum, s) => sum + s.split(/\s+/).filter(Boolean).length, 0) /
    sentences.length
  );
}

const HEDGES = [
  "likely",
  "suggests",
  "step in the right direction",
  "might",
  "could potentially",
  "perhaps",
  "may be",
];

const IMPERATIVE_VERBS = [
  "grind",
  "increase",
  "decrease",
  "reduce",
  "raise",
  "lower",
  "adjust",
  "switch",
  "hold",
  "maintain",
  "skip",
  "try",
  "use",
  "move",
  "keep",
  "shorten",
  "lengthen",
  "extend",
  "stop",
  "add",
  "remove",
  "swirl",
  "pour",
  "wait",
  "preinfuse",
  "pre-infuse",
  "tamp",
  "distribute",
  "set",
  "warm",
  "cool",
  "rest",
  "change",
  "target",
];

function scoreSingle({ parsed, prevSuggestion, prevPrimaryIssue, paramsChangedSincePrev }) {
  const checks = {};
  if (!parsed) {
    checks.parses = false;
    return checks;
  }
  checks.parses = true;

  const top = parsed.suggestions?.[0];
  const topParam = normalizeParameter(top?.parameter || top?.action);
  const topDir = extractDirection(top?.action);

  // A1. primaryIssue not stale: if the previous suggestion existed and params changed since, primaryIssue should not exactly equal previous.
  if (prevPrimaryIssue && paramsChangedSincePrev?.length > 0) {
    checks.A_diagnosisRefreshed = parsed.primaryIssue !== prevPrimaryIssue;
  }

  // A2. anti-repeat: if previous baseline's top suggestion targeted the same
  // (param, dir), this baseline must either pivot (different param/dir) OR
  // meaningfully escalate magnitude (~2x) OR explicitly recommend holding.
  // F1 explicitly *allows* repeating direction with an escalated step, so
  // simply checking "same direction" punishes the right behavior.
  if (prevSuggestion) {
    const prevParam = normalizeParameter(prevSuggestion.parameter || prevSuggestion.action);
    const prevDir = extractDirection(prevSuggestion.action);
    if (prevParam && prevDir && topParam && topDir) {
      const samePair = prevParam === topParam && prevDir === topDir;
      if (!samePair) {
        checks.A_breaksRepeatLoop = true; // pivot
      } else {
        const prevMag = maxMagnitude(prevSuggestion.action || "");
        const currMag = maxMagnitude(top.action || "");
        const holdLanguage = /\b(hold|keep|maintain)\b.*(parameter|setting|all)|re-?taste|re-?test|same setting|do not (change|adjust)/i.test(
          (top.action || "") + " " + (top.reasoning || "") + " " + (parsed.summary || "")
        );
        const escalated = prevMag > 0 && currMag >= 1.6 * prevMag;
        const escalationLanguage = /\b(meaningfully|larger|bigger|escalate|aggressive|substantial)\b/i.test(
          (top.action || "") + " " + (top.reasoning || "")
        );
        checks.A_breaksRepeatLoop = holdLanguage || escalated || escalationLanguage;
      }
    }
  }

  // A3. magnitude specified: top suggestion action must contain a digit
  if (top) {
    checks.A_hasMagnitude = /\d/.test(top.action || "");
  }

  // B. tone / conciseness checks
  const hedgeText = JSON.stringify(parsed).toLowerCase();
  checks.B_noHedges = HEDGES.every((h) => !hedgeText.includes(h));
  checks.B_summaryWPS = meanWordsPerSentence(parsed.summary || "");
  checks.B_effectWPS =
    parsed.suggestions
      ?.map((s) => meanWordsPerSentence(s.effect || ""))
      .reduce((a, b) => a + b, 0) / Math.max(parsed.suggestions?.length || 1, 1);

  if (top) {
    const firstWord = (top.action || "").trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z\-]/g, "");
    checks.B_imperative = IMPERATIVE_VERBS.includes(firstWord);
  }
  return checks;
}

// ------------------------------------------------------------------------
// 6. Run
// ------------------------------------------------------------------------
const reportChunks = [];
let totalPairs = 0;
let oldUsage = { prompt: 0, completion: 0 };
let newUsage = { prompt: 0, completion: 0 };
const aggregate = {
  A_diagnosisRefreshed: { old: [0, 0], new: [0, 0] },
  A_breaksRepeatLoop: { old: [0, 0], new: [0, 0] },
  A_hasMagnitude: { old: [0, 0], new: [0, 0] },
  B_noHedges: { old: [0, 0], new: [0, 0] },
  B_imperative: { old: [0, 0], new: [0, 0] },
};
const wpsAccum = { old: { sum: 0, n: 0 }, new: { sum: 0, n: 0 } };

const PARAM_KEYS = [
  "grindSetting",
  "dosage",
  "waterTemp",
  "brewTime",
  "finalWeight",
  "coffeeTemperature",
];
const paramDiff = (a, b) => {
  const out = [];
  for (const k of PARAM_KEYS) if (a?.[k] !== b?.[k]) out.push(k);
  return out;
};

reportChunks.push(`# Brew Prompt Eval — OLD vs NEW on ${MODEL}`);
reportChunks.push("");
reportChunks.push(
  `Generated ${new Date().toISOString()}. Fixtures: ${fixturesPath.replace(REPO_ROOT + "/", "")}`
);
reportChunks.push("");

for (const seq of fixtures) {
  if (ONLY_COFFEE && seq.coffeeId !== ONLY_COFFEE) continue;
  const targets = eligibleTargets(seq);
  if (targets.length === 0) continue;

  reportChunks.push(`## ${seq.coffee.roaster} — ${seq.coffee.name}`);
  reportChunks.push("");

  for (const target of targets) {
    if (totalPairs >= MAX_BREWS) break;
    const baselineIdx = seq.brews.findIndex((b) => b.id === target.id);
    const prev = seq.brews[baselineIdx - 1];
    const prevSuggestion = prev?.suggestion?.full?.suggestions?.[0];
    const prevPrimaryIssue = prev?.suggestion?.full?.primaryIssue;
    const paramsChanged = prev ? paramDiff(prev, target) : [];

    process.stdout.write(
      `[eval] ${seq.coffee.name} brew ${baselineIdx + 1}/${seq.brews.length} (${target.id.slice(0, 8)})…`
    );

    const oldPrompt = buildPrompt(seq.coffee, seq.brews, target.id, "old");
    const newPrompt = buildPrompt(seq.coffee, seq.brews, target.id, "new");

    let oldRes, newRes;
    try {
      [oldRes, newRes] = await Promise.all([callOpenAI(oldPrompt), callOpenAI(newPrompt)]);
    } catch (e) {
      console.log(` ERR ${e.message}`);
      continue;
    }
    process.stdout.write(` ok (${oldRes.elapsedMs}ms / ${newRes.elapsedMs}ms)\n`);
    totalPairs++;
    oldUsage.prompt += oldRes.usage?.prompt_tokens || 0;
    oldUsage.completion += oldRes.usage?.completion_tokens || 0;
    newUsage.prompt += newRes.usage?.prompt_tokens || 0;
    newUsage.completion += newRes.usage?.completion_tokens || 0;

    let oldParsed = null,
      newParsed = null;
    try {
      oldParsed = JSON.parse(oldRes.content);
    } catch {}
    try {
      newParsed = JSON.parse(newRes.content);
    } catch {}

    const oldScore = scoreSingle({
      parsed: oldParsed,
      prevSuggestion,
      prevPrimaryIssue,
      paramsChangedSincePrev: paramsChanged,
    });
    const newScore = scoreSingle({
      parsed: newParsed,
      prevSuggestion,
      prevPrimaryIssue,
      paramsChangedSincePrev: paramsChanged,
    });

    for (const key of Object.keys(aggregate)) {
      if (oldScore[key] !== undefined) {
        aggregate[key].old[1]++;
        if (oldScore[key]) aggregate[key].old[0]++;
      }
      if (newScore[key] !== undefined) {
        aggregate[key].new[1]++;
        if (newScore[key]) aggregate[key].new[0]++;
      }
    }
    if (oldScore.B_summaryWPS) {
      wpsAccum.old.sum += oldScore.B_summaryWPS;
      wpsAccum.old.n++;
    }
    if (newScore.B_summaryWPS) {
      wpsAccum.new.sum += newScore.B_summaryWPS;
      wpsAccum.new.n++;
    }

    reportChunks.push(
      `### Brew ${baselineIdx + 1} (${new Date(target.createdAt).toISOString().slice(0, 10)}, quality=${getQualityLabel(target.quality)})`
    );
    if (prev && prevSuggestion) {
      reportChunks.push(
        `Prev top suggestion: \`${(prevSuggestion.action || "").slice(0, 120)}\` (${prevSuggestion.confidence}); params changed since prev: \`${paramsChanged.join(", ") || "none"}\``
      );
    }
    reportChunks.push("");
    reportChunks.push("**OLD prompt output:**");
    reportChunks.push("```json");
    reportChunks.push(oldRes.content || "(unparseable)");
    reportChunks.push("```");
    reportChunks.push("");
    reportChunks.push("**NEW prompt output:**");
    reportChunks.push("```json");
    reportChunks.push(newRes.content || "(unparseable)");
    reportChunks.push("```");
    reportChunks.push("");
    reportChunks.push("Score deltas:");
    for (const k of Object.keys(aggregate)) {
      if (oldScore[k] === undefined && newScore[k] === undefined) continue;
      reportChunks.push(`- ${k}: old=${oldScore[k]} → new=${newScore[k]}`);
    }
    reportChunks.push(
      `- summary mean wps: old=${oldScore.B_summaryWPS?.toFixed(1)} → new=${newScore.B_summaryWPS?.toFixed(1)}`
    );
    reportChunks.push("");
  }
  if (totalPairs >= MAX_BREWS) break;
}

// ------------------------------------------------------------------------
// 7. Verdict
// ------------------------------------------------------------------------
function pct([n, d]) {
  return d === 0 ? "n/a" : `${((100 * n) / d).toFixed(0)}% (${n}/${d})`;
}
const summaryRows = [];
summaryRows.push(`| Check | OLD | NEW | Δ |`);
summaryRows.push(`|---|---|---|---|`);
for (const k of Object.keys(aggregate)) {
  const o = aggregate[k].old;
  const n = aggregate[k].new;
  const delta = n[1] && o[1] ? `${(((n[0] / n[1]) - (o[0] / o[1])) * 100).toFixed(0)}pp` : "n/a";
  summaryRows.push(`| ${k} | ${pct(o)} | ${pct(n)} | ${delta} |`);
}
const oldTokTotal = oldUsage.prompt + oldUsage.completion;
const newTokTotal = newUsage.prompt + newUsage.completion;
const tokDelta = oldTokTotal ? (((newTokTotal - oldTokTotal) / oldTokTotal) * 100).toFixed(1) : "n/a";

const aggregateBlock = [
  "## Aggregate scorecard",
  "",
  ...summaryRows,
  "",
  "Token usage:",
  `- OLD: prompt=${oldUsage.prompt}, completion=${oldUsage.completion}, total=${oldTokTotal}`,
  `- NEW: prompt=${newUsage.prompt}, completion=${newUsage.completion}, total=${newTokTotal}`,
  `- delta: ${tokDelta}% total tokens (NEW vs OLD)`,
  "",
  "Voice/conciseness:",
  `- mean summary words/sentence: OLD=${(wpsAccum.old.sum / Math.max(wpsAccum.old.n, 1)).toFixed(1)} → NEW=${(wpsAccum.new.sum / Math.max(wpsAccum.new.n, 1)).toFixed(1)}`,
  "",
];

// Ship gate
const issueFixKeys = ["A_diagnosisRefreshed", "A_breaksRepeatLoop", "A_hasMagnitude"];
const voiceKeys = ["B_noHedges", "B_imperative"];
const issueFixOK = issueFixKeys.every((k) => {
  const o = aggregate[k].old, n = aggregate[k].new;
  if (!o[1] || !n[1]) return true;
  return n[0] / n[1] >= o[0] / o[1];
});
const voiceOK = voiceKeys.every((k) => {
  const o = aggregate[k].old, n = aggregate[k].new;
  if (!o[1] || !n[1]) return true;
  return n[0] / n[1] >= 0.95 * (o[0] / o[1]); // allow tiny stochastic noise
});
const verdict = issueFixOK && voiceOK ? "SHIP" : "DO NOT SHIP";
aggregateBlock.push(`## Verdict: **${verdict}**`);
aggregateBlock.push(
  `- issue-fix gate: ${issueFixOK ? "pass" : "FAIL"} (NEW pass-rate must meet or beat OLD on every check)`
);
aggregateBlock.push(
  `- voice/conciseness gate: ${voiceOK ? "pass" : "FAIL"} (NEW pass-rate must be \u2265 95% of OLD on hedge + imperative checks)`
);
aggregateBlock.push("");

const outDir = path.join(REPO_ROOT, "docs", "ai-analysis");
await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "prompt-eval.md");
await fs.writeFile(
  outPath,
  [reportChunks[0], reportChunks[1], reportChunks[2], "", ...aggregateBlock, "---", "", ...reportChunks.slice(3)].join(
    "\n"
  )
);
console.log(`\n[eval] wrote ${outPath}`);
console.log(`[eval] verdict: ${verdict}`);
console.log(`[eval] tokens: ${oldTokTotal} → ${newTokTotal} (${tokDelta}%)`);
