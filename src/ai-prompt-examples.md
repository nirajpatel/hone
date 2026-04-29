# AI Suggestion Prompt Examples

## System Configuration

### OpenAI API Parameters
- **Model**: `gpt-5.4`
- **Temperature**: `0.2` (low temperature for consistent, deterministic responses)
- **Max Completion Tokens**: `1000`
- **Response Format**: `json_object` (enforces JSON-only response)

### Brew History Selection
- **Brews included**: 7 most recent + the baseline brew (if not in top 7) + the most recent exceptional (3-star) brew
- **Markers**:
  - ⭐ **REFERENCE BREW** - The brew being analyzed for suggestions
  - 🏆 **BEST RECORDED BREW** - The most recent excellent (3-star) brew in history
  - Both markers appear together if a brew is both reference and best

---

## Example 1: Maru Coffee Santo Blend (Espresso with Previous Extractions)

### System Message
```
You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.
```

### User Prompt
```
You are an expert barista analyzing the extraction history for a specific coffee to provide improvement suggestions.

COFFEE:
- Name: Santo Blend
- Roaster: Maru Coffee
- Brew Method: espresso
- Region: Guatemala, Ethiopia
- Roast Level: Medium
- Flavor Notes: Chocolate, caramel, red fruit

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

EXTRACTION HISTORY (Most recent to oldest):
Note: Only the 5 most recent extractions are shown, plus the best extraction if it's not in the top 5 (max 6 total).

EXTRACTION #1 (Dec 22, 2024) ⭐ REFERENCE EXTRACTION:
- Brewer: La Marzocco Linea Micra
- Grinder: Niche Zero
- Bean Temperature: Room Temperature
- Grind Setting: 14
- Dosage: 18g
- Water Temperature: 200°F
- Extraction Time: 28s
- Final Weight: 40g
- Quality Rating: Decent
- Tasting Notes: Sour, thin body
- Extraction Notes: Flow was very fast

EXTRACTION #2 (Dec 20, 2024):
- Brewer: La Marzocco Linea Micra
- Grinder: Niche Zero
- Bean Temperature: Room Temperature
- Grind Setting: 15
- Dosage: 18g
- Water Temperature: 200°F
- Extraction Time: 22s
- Final Weight: 42g
- Quality Rating: Bad
- Tasting Notes: Sour, watery
- Extraction Notes: Channeling observed

EXTRACTION #3 (Dec 18, 2024) 🏆 BEST RECORDED EXTRACTION:
- Brewer: La Marzocco Linea Micra
- Grinder: Niche Zero
- Bean Temperature: Room Temperature
- Grind Setting: 13.5
- Dosage: 18g
- Water Temperature: 202°F
- Extraction Time: 31s
- Final Weight: 38g
- Quality Rating: Excellent
- Tasting Notes: Balanced, chocolate, smooth
- Extraction Notes: Great mouthfeel

IMPORTANT CONSIDERATIONS:
1. Focus on the REFERENCE BREW (marked with ⭐): Your suggestions should specifically address how to improve THIS brew. Use the brew history to understand what has been tried.
2. Equipment: Consider grinder scale direction (some use lower numbers for finer, others higher), sensitivity (stepless grinders like Niche Zero are highly sensitive ~0.5 adjustments, stepped grinders need 2-3 step adjustments), and brewer characteristics when making suggestions.
3. Anti-repeat escalation: When the same parameter+direction has been suggested in any of the three prior brews on this coffee, you MUST NOT repeat the same magnitude. Either (a) escalate the magnitude meaningfully (~2× the prior step) and explain why, (b) switch to a different parameter from the decision hierarchy, or (c) explicitly recommend holding all parameters and re-tasting to confirm the diagnosis. The minimal-change preference does not apply once a small step in this direction has already been tried without improvement.
4. NO BREW IDs: Do not reference brew numbers (like "Brew #1" or "#3") in your response. When referring to previous brews, use descriptive terms like "previous attempts", "an earlier excellent brew", etc. The user does not have access to brew numbers.
5. Baseline Brew Terminology: When referring to the REFERENCE BREW (marked with ⭐) in your summary or suggestions, always use the term "baseline brew". This brew is the starting point for improvement suggestions.
6. Do not infer causes that are not supported by recorded data.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless history strongly suggests otherwise; default to small steps for the first attempt at a parameter, then escalate per rule 3):
   - Grind setting
   - Flow behavior / puck preparation (espresso only — if flow issues indicate channeling, address distribution, tamping, or pre-infusion before changing core parameters)
   - Final weight / ratio
   - Steep time (immersion only)
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
   - If a parameter appears optimal based on excellent brews, explicitly state it should remain unchanged.

> **Note**: The shared rules above are produced by `buildBrewRules(brewMethod)` in [supabase/functions/make-server-23508aac/index.ts](../supabase/functions/make-server-23508aac/index.ts). The anti-repeat (rule 3), confidence-downgrade (rule C), and re-derive-diagnosis (rule D) clauses are findings-driven edits — see [docs/ai-analysis/brew-failure-modes.md](../docs/ai-analysis/brew-failure-modes.md) for the data behind each one and [docs/ai-analysis/prompt-eval.md](../docs/ai-analysis/prompt-eval.md) for the OLD-vs-NEW gpt-5.4 eval that gated the change.

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
      "reasoning": "Concise explanation (1 sentence) of why this works based on extraction history. Do NOT reference extraction numbers (no period at end)",
      "confidence": "High" | "Medium" | "Low"
    }
  ]
}

REQUIREMENTS:
- You must provide at least 1 suggestion and at most 3 suggestions
- Each suggestion must follow the structure: Action → Expected effect → Why it matters (based on history)
- Only include high-quality, non-redundant suggestions
```

### Example Response
```json
{
  "summary": "The baseline extraction rated decent with sour and thin body, indicating under-extraction from the fast 28-second flow.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind Setting",
      "action": "Grind finer by moving to 13.5 on Niche Zero",
      "effect": "This will slow the flow to 30-32 seconds and reduce sourness while building more body",
      "reasoning": "An earlier excellent extraction at 13.5 delivered balanced flavor with 31s extraction time, and the current grind at 14 is producing fast flow and under-extraction",
      "confidence": "High"
    },
    {
      "parameter": "Final Weight",
      "action": "Reduce final weight from 40g to 38g",
      "effect": "This will concentrate the flavors and improve body",
      "reasoning": "The excellent extraction used 38g output for a tighter 1:2.1 ratio, which helped balance the cup",
      "confidence": "High"
    }
  ]
}
```

---

## Example 2: Onyx Coffee - Southern Weather (Pour Over - First Time)

### System Message
```
You are an expert barista helping set up initial extraction parameters for a new coffee. Provide specific, actionable starting parameters based on coffee characteristics. Respond with valid JSON only.
```

### User Prompt
```
You are helping a barista brew a coffee for the first time. Based on the coffee's characteristics, suggest optimal starting parameters for an excellent extraction.

COFFEE:
- Name: Southern Weather
- Roaster: Onyx Coffee
- Brew Method: pour over
- Region: Colombia
- Roast Level: Light
- Flavor Notes: Peach, honey, jasmine
- Brewing Equipment: Hario V60
- Grinder: Fellow Ode Gen 2

GOAL:
Provide starting parameters that have a high probability of yielding a well-balanced extraction (≈3/3 stars) on the first brew, with room for easy adjustment.

IMPORTANT GUIDELINES:
- Adapt recommendations to the brew method (espresso, pour-over, immersion, etc.).
- Commit to one primary recommended value per parameter.
- Use narrow ranges only when unavoidable (e.g., brew time).
- Prefer forgiving starting points that avoid stalled flow, over-extraction, or severe under-extraction.
- When grinders use numeric dials, assume typical real-world ranges for that grinder and method, then pick the best starting point.
- Assume grinder is calibrated to factory default unless stated otherwise.
- Do not rename, reorder, or omit any fields.
- Parameter "name" values must match the schema exactly.

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no code blocks, just raw JSON. Use this exact structure:

{
  "introduction": "Brief introduction (1-2 sentences) acknowledging this is the first time brewing this coffee and what makes it distinctive (origin, roast level, or flavor profile)",
  "parameters": [
    {
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
      "name": "Brew Time",
      "recommendation": "Target total brew time from start to finish (e.g., '2:45-3:00')",
      "explanation": "One sentence explaining why this timing supports balance"
    },
    {
      "name": "Final Weight/Ratio",
      "recommendation": "Target final output weight and ratio (e.g., '300g output (1:15 ratio)')",
      "explanation": "One sentence explaining why this ratio fits the flavor profile and method"
    },
    {
      "name": "Pour Structure",
      "recommendation": "Stage-by-stage pour details with specific weights and timings (e.g., 'Bloom: 40g for 45s, First pour: 100g to 140g at 0:45, Second pour: 160g to 300g at 1:45'). Include this parameter ONLY if Brew Method is pour-over, V60, Chemex, Kalita, or Wave. Otherwise omit entirely.",
      "explanation": "One sentence explaining why this pour structure suits the coffee characteristics"
    }
  ],
  "note": "These are based on common best practices for this brew method and equipment. Adjust grind first, then ratio or time, based on taste and flow."
}
```

### Example Response
```json
{
  "introduction": "Southern Weather is a light roast Colombian coffee with delicate floral and fruit notes that will shine with proper extraction. Light roasts require careful attention to grind size and water temperature to avoid under-extraction.",
  "parameters": [
    {
      "name": "Grind Setting",
      "recommendation": "Start at 5.5 on the Fellow Ode Gen 2",
      "explanation": "This medium-fine setting allows for proper extraction of light roasts while maintaining a 2:45-3:15 brew time"
    },
    {
      "name": "Dosage",
      "recommendation": "20g",
      "explanation": "This dose provides a good balance for the V60 size and allows for a stable brew bed"
    },
    {
      "name": "Water Temperature",
      "recommendation": "205°F",
      "explanation": "Light roasts need higher temperatures to fully extract the delicate fruit and floral notes without sourness"
    },
    {
      "name": "Brew Time",
      "recommendation": "2:45-3:15 total brew time",
      "explanation": "This timing window ensures full extraction of the light roast while preventing over-extraction"
    },
    {
      "name": "Final Weight/Ratio",
      "recommendation": "300g output (1:15 ratio)",
      "explanation": "A 1:15 ratio provides clarity and brightness ideal for highlighting the peach and jasmine notes"
    },
    {
      "name": "Pour Structure",
      "recommendation": "Bloom: 40g for 45s, First pour: to 140g at 0:45-1:15, Second pour: to 240g at 1:30-2:00, Final pour: to 300g at 2:15-2:30",
      "explanation": "This three-pour structure with a gentle bloom allows even extraction and prevents channeling in light roasts"
    }
  ],
  "note": "These are based on common best practices for this brew method and equipment. Adjust grind first, then ratio or time, based on taste and flow."
}
```

---

## Key Differences Between First-Time vs. Historical Prompts

### First-Time Coffee (No Extractions)
- **Focus**: Provide safe, forgiving starting parameters
- **Structure**: Introduction + parameter recommendations + general note
- **Tone**: Encouraging and educational
- **Output**: Includes pour structure for pour-over methods
- **Temperature**: 0.2 (consistent starting points)

### Coffee with History (Previous Extractions)
- **Focus**: Analyze patterns and suggest specific improvements
- **Structure**: Summary + primary issue + 1-3 targeted suggestions
- **Tone**: Direct and diagnostic
- **Output**: Includes confidence levels and reasoning based on history
- **Temperature**: 0.2 (consistent analysis)

Both prompts enforce JSON-only responses with structured output for reliable parsing in the frontend.