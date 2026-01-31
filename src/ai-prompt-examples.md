# AI Suggestion Prompt Examples

## System Configuration

### OpenAI API Parameters
- **Model**: `gpt-5.2`
- **Temperature**: `0.2` (low temperature for consistent, deterministic responses)
- **Max Completion Tokens**: `1000`
- **Response Format**: `json_object` (enforces JSON-only response)

### Extraction History Selection
- **Maximum Extractions**: 6 (5 most recent + best extraction if not in top 5)
- **Markers**: 
  - ⭐ **REFERENCE EXTRACTION** - The extraction being analyzed for suggestions
  - 🏆 **BEST RECORDED EXTRACTION** - The highest quality extraction in history
  - Both markers appear together if an extraction is both reference and best

---

## Example 1: Maru Coffee Santo Blend (Espresso with Previous Extractions)

### System Message
```
You are an expert barista helping improve coffee extractions. Analyze the full extraction history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.
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
1. Focus on the REFERENCE EXTRACTION (marked with ⭐): Your suggestions should specifically address how to improve THIS extraction. Use the extraction history to understand what has already been tried and avoid suggesting the same adjustments that were already attempted.
2. Grinder Direction: Different grinders have different scales. Some use lower numbers for finer grinds (e.g., Niche Zero, Fellow Ode), while others use higher numbers for finer grinds. Ensure your suggestion moves in the correct direction for the specific grinder being used.
3. Grinder Sensitivity: Pay attention to how sensitive the grinder's adjustments are. Stepless grinders like the Niche Zero are highly sensitive (0.5 adjustments matter), while stepped grinders may need larger adjustments (2-3 steps).
4. Equipment Context: Consider the brewer and grinder being used when making suggestions. Different equipment has different characteristics and optimal parameters.
5. Avoid Repetition: Review the previous extractions to ensure you're not suggesting something that was already tried. If a previous extraction tried a parameter change and it didn't improve things, suggest a different approach.
6. NO EXTRACTION IDs: Do not reference extraction numbers (like "Extraction #1" or "#3") in your response. When referring to previous extractions, use descriptive terms like "previous attempts", "an earlier excellent extraction", etc. The user does not have access to extraction numbers.
7. Baseline Extraction Terminology: When referring to the REFERENCE EXTRACTION (marked with ⭐) in your summary or suggestions, always use the term "baseline extraction" instead of "most recent extraction" or "best extraction". This extraction is the starting point for improvement suggestions.
8. Do not infer causes that are not supported by recorded data.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless history strongly suggests otherwise):
   - Grind / flow behavior
   - Final weight / ratio
   - Water temperature
   - Dose
   - If flow issues indicate puck preparation or channeling, address distribution, tamping, or pre-infusion before changing core parameters.

B) Require directional reasoning (no vague advice):
   - Each suggestion must specify the exact direction and a small magnitude that fits the grinder/equipment (example: "Grind finer by ~0.3–0.5 on Niche Zero").
   - Each suggestion must include the expected taste/texture impact (example: "should reduce sourness and increase body").

C) Confidence score:
   - Every suggestion must include a confidence score: High / Medium / Low.
   - Confidence should reflect how strongly the extraction history supports the change (e.g., repeated evidence vs weak signal).
   - Use "High" only when supported by at least two prior extractions or a direct comparison.

D) Primary failure mode:
   - Before listing suggestions, identify exactly ONE primary failure mode for the selected extraction (e.g., "under-extracted due to fast flow" or "over-extracted due to excessive yield").
   - All suggestions must directly address this failure mode.

E) Quality over quantity:
   - If fewer than three high-quality, non-redundant suggestions exist, provide fewer suggestions rather than forcing additional ones.
   - It is acceptable to provide only 1-2 suggestions if those are the most impactful changes.
   - Do not suggest adjusting parameters that are already optimal or not contributing to the issue.

F) Learning from excellent extractions:
   - If the history contains an excellent extraction, it is acceptable to recommend reverting one or more parameters back toward that setup, with reasoning.
   - Reverting to a previously successful setting is not considered repetition.
   - When referring to it, use descriptive language like "an earlier excellent extraction" without mentioning extraction numbers.

G) Prefer minimal changes:
   - When suggesting adjustments, prefer the smallest reasonable change that could plausibly fix the issue.
   - Avoid large jumps unless history clearly shows they are necessary.

H) Stability check:
   - If a parameter appears optimal based on excellent extractions, explicitly state that it should remain unchanged.

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