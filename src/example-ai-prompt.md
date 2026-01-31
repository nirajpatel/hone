# AI Suggestion Prompt Example - Maru Coffee Santo Blend

## Scenario
Coffee: Maru Coffee Santo Blend (Espresso method)
Previous extractions exist with quality ratings and history

---

## SYSTEM MESSAGE
You are an expert barista helping improve coffee extractions. Analyze the full extraction history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.

---

## USER PROMPT

You are an expert barista analyzing the extraction history for a specific coffee to provide improvement suggestions.

COFFEE:
- Name: Santo Blend
- Roaster: Maru Coffee
- Brew Method: espresso
- Region: Brazil, Colombia
- Roast Level: Medium
- Flavor Notes: Chocolate, Hazelnut, Caramel

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

EXTRACTION HISTORY (Most recent to oldest):

EXTRACTION #1 (Jan 8, 2026) ⭐ TARGET EXTRACTION:
- Brewer: Flair 58
- Grinder: Niche Zero
- Coffee Temperature: Room Temperature
- Grind Setting: 13
- Dosage: 18g
- Water Temperature: 200°F
- Extraction Time: 28s
- Final Weight: 38g
- Quality Rating: Decent
- Tasting Notes: Slightly sour, thin body
- Extraction Notes: Flow was a bit fast, channeling suspected

EXTRACTION #2 (Jan 7, 2026):
- Brewer: Flair 58
- Grinder: Niche Zero
- Coffee Temperature: Room Temperature
- Grind Setting: 14
- Dosage: 18g
- Water Temperature: 202°F
- Extraction Time: 24s
- Final Weight: 40g
- Quality Rating: Decent
- Tasting Notes: Bright, acidic, lacks sweetness
- Extraction Notes: Too fast, very watery

EXTRACTION #3 (Jan 6, 2026):
- Brewer: Flair 58
- Grinder: Niche Zero
- Coffee Temperature: Room Temperature
- Grind Setting: 12
- Dosage: 18g
- Water Temperature: 200°F
- Extraction Time: 35s
- Final Weight: 36g
- Quality Rating: Excellent
- Tasting Notes: Sweet chocolate, smooth caramel, balanced
- Extraction Notes: Perfect flow, great body

EXTRACTION #4 (Jan 5, 2026):
- Brewer: Flair 58
- Grinder: Niche Zero
- Coffee Temperature: Room Temperature
- Grind Setting: 12.5
- Dosage: 18g
- Water Temperature: 198°F
- Extraction Time: 32s
- Final Weight: 37g
- Quality Rating: Excellent
- Tasting Notes: Chocolate, hazelnut, creamy
- Extraction Notes: Very good extraction

IMPORTANT CONSIDERATIONS:
1. Focus on the SELECTED EXTRACTION (marked with ⭐): Your suggestions should specifically address how to improve THIS extraction. Use the extraction history to understand what has already been tried and avoid suggesting the same adjustments that were already attempted.
2. Grinder Direction: Different grinders have different scales. Some use lower numbers for finer grinds (e.g., Niche Zero, Fellow Ode), while others use higher numbers for finer grinds. Ensure your suggestion moves in the correct direction for the specific grinder being used.
3. Grinder Sensitivity: Pay attention to how sensitive the grinder's adjustments are. Stepless grinders like the Niche Zero are highly sensitive (0.5 adjustments matter), while stepped grinders may need larger adjustments (2-3 steps).
4. Equipment Context: Consider the brewer and grinder being used when making suggestions. Different equipment has different characteristics and optimal parameters.
5. Avoid Repetition: Review the previous extractions to ensure you're not suggesting something that was already tried. If a previous extraction tried a parameter change and it didn't improve things, suggest a different approach.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless history strongly suggests otherwise):
   - Grind / flow behavior
   - Final weight / ratio
   - Water temperature
   - Dose

B) Require directional reasoning (no vague advice):
   - Each suggestion must specify the exact direction and a small magnitude that fits the grinder/equipment (example: "Grind finer by ~0.3–0.5 on Niche Zero").
   - Each suggestion must include the expected taste/texture impact (example: "should reduce sourness and increase body").

C) Confidence score:
   - Every suggestion must include a confidence score: High / Medium / Low.
   - Confidence should reflect how strongly the extraction history supports the change (e.g., repeated evidence vs weak signal).

D) Primary failure mode:
   - Before listing suggestions, identify exactly ONE primary failure mode for the selected extraction (e.g., "under-extracted due to fast flow" or "over-extracted due to excessive yield").
   - All suggestions must directly address this failure mode.

E) Quality over quantity:
   - If fewer than three high-quality, non-redundant suggestions exist, provide fewer suggestions rather than forcing additional ones.
   - It is acceptable to provide only 1-2 suggestions if those are the most impactful changes.
   - Do not suggest adjusting parameters that are already optimal or not contributing to the issue.

F) Learning from excellent extractions:
   - If the history contains an excellent extraction, it is acceptable to recommend reverting one or more parameters back toward that setup, with reasoning.
   - Reference the specific excellent extraction when making such suggestions.

G) Prefer minimal changes:
   - When suggesting adjustments, prefer the smallest reasonable change that could plausibly fix the issue.
   - Avoid large jumps unless history clearly shows they are necessary.

OUTPUT FORMAT:
Provide your response in plain text (NO markdown formatting - no bold, italics, or special formatting):

Start with a brief diagnostic summary (1-2 sentences max):
- State the outcome (quality rating and key tasting notes)
- State what was missing or wrong
- Avoid hedging language like "likely", "suggests", "step in the right direction"
- Collapse cause and effect into one sentence (e.g., "The shot showed muted sweetness and body, indicating mild under-extraction" NOT "The extraction time was reasonable but the flavor profile suggests...")

After the summary, identify the primary failure mode on a new line starting with "Primary issue:" (e.g., "Primary issue: under-extracted due to fast flow" or "Primary issue: over-extracted due to excessive yield").

Then include this instruction line exactly:
Try these suggestions in order, changing only one variable at a time so you can learn what works.

Then:

Suggestions:
Each suggestion must follow this structure: Action → Expected effect → Why it matters (based on history)
1. [Parameter]: [Action with specific magnitude]. [Expected taste/texture effect]. [Why this works based on extraction history]. (Confidence: [High/Medium/Low])
2. [Parameter]: [Action with specific magnitude]. [Expected taste/texture effect]. [Why this works based on extraction history]. (Confidence: [High/Medium/Low])
3. [Parameter]: [Action with specific magnitude]. [Expected taste/texture effect]. [Why this works based on extraction history]. (Confidence: [High/Medium/Low])

Note: Provide 1-3 suggestions. Only include suggestions that are high-quality and non-redundant. It is better to have fewer impactful suggestions than to force additional ones.

---

## EXPECTED AI RESPONSE (Example)

The baseline extraction produced decent flavors with sourness and thin body, indicating under-extraction from fast flow.
Primary issue: under-extracted due to fast flow

Try these suggestions in order, changing only one variable at a time so you can learn what works.

Suggestions:
1. Grind Setting: Grind finer to 12 (down from 13). This should slow flow, increase extraction, reduce sourness, and build body. Earlier excellent extractions at grind 12-12.5 achieved balanced sweetness and body, while moving coarser resulted in fast flow and sourness. (Confidence: High)
2. Final Weight: Reduce yield to 36g (1:2 ratio). This should concentrate flavors and increase perceived body. An earlier excellent extraction used 36g with similar parameters and achieved superior sweetness and balance. (Confidence: Medium)
3. Water Temperature: Maintain or slightly reduce to 198-200°F. The current temperature is appropriate for this medium roast and matched the excellent extractions. Temperature is not the primary issue here. (Confidence: Low)
