/**
 * Frozen copy of the production improvement prompt before the context-builder
 * overhaul (background path: top 7 recent + baseline + best, json_object,
 * temperature 0.2, confidence re-sort). Eval baseline only; do not edit to
 * track current prompts — that is brewPrompts.ts.
 */
import { formatBrewForPrompt, supportsStages } from "../../supabase/functions/make-server-23508aac/brewMethods.ts";

export const LEGACY_MODEL = "gpt-5.4";

const SYSTEM =
  "You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.";

function legacyRules(brewMethod) {
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

const OUTPUT_FORMAT = `OUTPUT FORMAT:
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

const qualityLabel = (q) => (!q ? "Not rated" : q === 1 ? "Bad" : q === 2 ? "Decent" : "Excellent");
const formatDate = (s) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** coffeeBrews: this coffee + method, any order. Returns { system, user }. */
export function buildLegacyImprovementPrompt(coffee, coffeeBrews, baselineId, historyLimit = 7) {
  const sorted = [...coffeeBrews].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const baseline = sorted.find((b) => b.id === baselineId) ?? sorted[0];
  const picked = sorted.slice(0, historyLimit);
  const exceptional = sorted.find((b) => b.quality === 3);
  if (!picked.some((b) => b.id === baseline.id)) picked.push(baseline);
  if (exceptional && !picked.some((b) => b.id === exceptional.id)) picked.push(exceptional);
  picked.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const coffeeInfo = `COFFEE:
- Name: ${coffee.name}
- Roaster: ${coffee.roaster}
- Brew Method: ${baseline.brewMethod}${coffee.region ? `\n- Region: ${coffee.region}` : ""}${coffee.roastLevel ? `\n- Roast Level: ${coffee.roastLevel}` : ""}${coffee.notes ? `\n- Flavor Notes: ${coffee.notes}` : ""}`;

  let history = `BREW HISTORY (Most recent to oldest):
`;
  picked.forEach((brew, idx) => {
    const isTarget = brew.id === baseline.id;
    const isExceptional = exceptional && brew.id === exceptional.id;
    const qualifiers =
      isTarget && isExceptional ? " ⭐ REFERENCE BREW, 🏆 BEST RECORDED BREW" : isTarget ? " ⭐ REFERENCE BREW" : isExceptional ? " 🏆 BEST RECORDED BREW" : "";
    history += `
BREW #${idx + 1} (${formatDate(brew.createdAt)})${qualifiers}:
- Brewer: ${brew.brewerName || "Not specified"}
- Grinder: ${brew.grinderName || "Not specified"}
- Bean Temperature: ${brew.coffeeTemperature === "frozen" ? "Frozen" : "Room Temperature"}
- Grind Setting: ${brew.grindSetting}
- Dosage: ${brew.dosage}g
- Water Temperature: ${brew.waterTemp ? `${brew.waterTemp}°F` : "Not recorded"}`;
    history += formatBrewForPrompt(brew, baseline.brewMethod);
    history += `
- Quality Rating: ${qualityLabel(brew.quality)}${brew.tastingNotes ? `
- Tasting Notes: ${brew.tastingNotes}` : ""}${brew.personalNotes || brew.notes ? `
- Extraction Notes: ${brew.personalNotes || brew.notes}` : ""}
`;
  });

  const user = `You are an expert barista analyzing the brew history for a specific coffee to provide improvement suggestions.

${coffeeInfo}

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

${history}
${legacyRules(baseline.brewMethod)}

TONE AND VOICE:
Use a calm, confident, craft-focused tone.
Sound like an experienced specialty barista giving guidance.

${OUTPUT_FORMAT}`;
  return { system: SYSTEM, user };
}

export function buildLegacyChatBody(prompt, model = LEGACY_MODEL) {
  return {
    model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    temperature: 0.2,
    max_completion_tokens: 1000,
    response_format: { type: "json_object" },
  };
}

const CONFIDENCE_ORDER = { High: 0, Medium: 1, Low: 2 };

/** Production post-processing at the time: validate, then re-sort by confidence. */
export function normalizeLegacy(parsed) {
  if (!parsed?.summary || !parsed?.primaryIssue || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) return null;
  const suggestions = [...parsed.suggestions].sort((a, b) => (CONFIDENCE_ORDER[a.confidence] ?? 9) - (CONFIDENCE_ORDER[b.confidence] ?? 9));
  return { summary: parsed.summary, primaryIssue: parsed.primaryIssue, suggestions, basis: [] };
}

/** Pre-overhaul first-brew prompt: bag details only, "assume typical ranges" for the grinder. */
export function buildLegacyFirstBrewPrompt(coffee, brewMethod, brewerName, grinderName) {
  const system =
    "You are an expert barista helping set up initial brew parameters for a new coffee. Provide specific, actionable starting parameters based on coffee characteristics. Respond with valid JSON only.";
  const isImmersion = brewMethod === "immersion";
  const timeName = isImmersion ? "Steep Time" : "Brew Time";
  const timeRec = isImmersion ? "Target steep time (e.g., '4:00')" : "Target total brew time from start to finish (e.g., '2:45-3:00')";
  const timeExp = isImmersion
    ? "One sentence explaining why this steep duration extracts well for this roast and grind"
    : "One sentence explaining why this timing supports balance";
  const finalRec = isImmersion
    ? "Target total water weight and ratio (e.g., '350g water (1:15 ratio)')"
    : "Target final output weight and ratio (e.g., '300g output (1:15 ratio)')";
  const base = `    {
      "name": "Grind Setting",
      "recommendation": "Specific setting on the grinder (e.g., 'Start at 6.5 on the Fellow Ode Gen 2')",
      "explanation": "One sentence explaining why this setting works for this coffee and equipment"
    },
    {
      "name": "Dosage",
      "recommendation": "Specific dose (e.g., '20g')",
      "explanation": "One sentence explaining why this dose suits the brew method and coffee"
    },
    {
      "name": "Water Temperature",
      "recommendation": "Specific temperature (e.g., '200°F')",
      "explanation": "One sentence explaining why this temperature suits the roast level"
    },
    {
      "name": "${timeName}",
      "recommendation": "${timeRec}",
      "explanation": "${timeExp}"
    },
    {
      "name": "Final Weight/Ratio",
      "recommendation": "${finalRec}",
      "explanation": "One sentence explaining why this ratio fits the flavor profile and method"
    }`;
  const pour = `,
    {
      "name": "Pour Structure",
      "recommendation": "Stage-by-stage pour details with specific weights and timings (e.g., 'Bloom: 40g for 45s, First pour: 100g to 140g at 0:45, Second pour: 160g to 300g at 1:45')",
      "explanation": "One sentence explaining why this pour structure suits the coffee characteristics"
    }`;
  const params = supportsStages(brewMethod) ? base + pour : base;
  const user = `You are helping a barista brew a coffee for the first time. Based on the coffee's characteristics, suggest optimal starting parameters for an excellent brew.

COFFEE:
- Name: ${coffee.name}
- Roaster: ${coffee.roaster}
- Brew Method: ${brewMethod}${coffee.region ? `\n- Region: ${coffee.region}` : ""}${coffee.roastLevel ? `\n- Roast Level: ${coffee.roastLevel}` : ""}${coffee.notes ? `\n- Flavor Notes: ${coffee.notes}` : ""}${brewerName ? `\n- Brewing Equipment: ${brewerName}` : ""}${grinderName ? `\n- Grinder: ${grinderName}` : ""}

GOAL:
Provide starting parameters that have a high probability of yielding a well-balanced brew (≈3/3 stars) on the first attempt, with room for easy adjustment.

IMPORTANT GUIDELINES:
- Adapt recommendations to the brew method (espresso, pour-over, immersion, etc.).
- Commit to one primary recommended value per parameter.
- Use narrow ranges only when unavoidable (e.g., brew time).
- Prefer forgiving starting points that avoid stalled flow, over-extraction, or under-extraction.
- When grinders use numeric dials, assume typical real-world ranges for that grinder and method, then pick the best starting point.
- Assume grinder is calibrated to factory default unless stated otherwise.
- Do not rename, reorder, or omit any fields.
- Parameter "name" values must match the schema exactly.

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no code blocks, just raw JSON. Use this exact structure:

{
  "introduction": "Brief introduction (1-2 sentences) acknowledging this is the first time brewing this coffee and what makes it distinctive (origin, roast level, or flavor profile)",
  "parameters": [
${params}
  ],
  "note": "These are based on common best practices for this brew method and equipment. Adjust grind first, then ratio or time, based on taste and flow."
}`;
  return { system, user };
}
