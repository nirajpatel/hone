# AI Suggestion Prompt Examples

Real prompts generated from household data by the shared builder in `supabase/functions/make-server-23508aac/brewPrompts.ts`. The edge function, `scripts/regenerate-suggestions.mjs` and the eval scripts all call the same builder, so what you see here is what the model sees.

## System configuration

| Call | Model | Reasoning effort | Timeout | Output |
|---|---|---|---|---|
| Background guidance (after a brew is saved, edited, or rated by SMS) | `gpt-6.1-sol` | `medium` | 60s, then one retry on the same model (`low`, 30s) | strict JSON schema |
| On-demand guidance (New Brew → suggestions) | `gpt-6.1-sol` | `low` | 25s, then the same retry | strict JSON schema |
| Bag scan (`/extract-coffee-bag`) | `gpt-6.1-sol` | `low` | 25s request timeout; one retry on the same model after a network error, 429 or 5xx | strict JSON schema |
| Coffee details lookup (`/lookup-coffee-details`, web search) | `gpt-5.4` | `none` | Same as bag scan | text |
| Grinder profile (background, when a grinder is added or renamed, or first used in guidance without one; always web-searches to confirm the scale) | `gpt-6.1-sol` | `low` | One retry on the same model after a network error, 429 or 5xx | strict JSON schema (`recognized`, `direction`, `settingFormat`; source URLs stored separately, `version` 2), stored once per grinder model as `grinder-profile:<model>`; code builds the GRINDER line from it. Accuracy check: `scripts/test-grinder-profiles.mjs` |

- No `temperature` (reasoning models reject it) and no token cap (reasoning tokens count against it; the schema bounds output length).
- Background results are only saved if the brew's inputs (parameters, rating, notes) are unchanged since generation started.
- An Excellent baseline returns "dialed in" from the server without a model call.

## What the prompt contains

**Improvement (the coffee has brews):**
- **Brew history:** the 15 most recent brews of this bean and method (every bag), plus the baseline and best brew if older. One line per brew: date, setup, days off roast, frozen or room temp, settings, rating, notes, and the guidance shown before that brew.
- **Tried settings:** groups of near-identical settings on this setup with their outcomes and what differed. Grind tolerance is 5% of the grinder's observed range.
- **Brewer preferences:** last 20 rated brews on the same brewer and grinder, across all coffees. Covers habit bands, typical Decent-or-better ranges for the roast bucket (n ≥ 5, otherwise labeled low sample), and recurring complaints.
- **Rules:** hold once, never hold twice, evidence order, frozen-bean age rule, standard bands, and the brewer's own tasting words.

**First brew (no brews of this bean yet):** up to 3 reference beans (same grinder, roast within one level, origin, recency) with their best brews, plus the brewer preferences. Without references it falls back to typical ranges.

**Basis:** both outputs include 1-2 `basis` strings shown under the guidance. Any basis citing a date that isn't in the prompt is dropped before saving.

---

## Example 1: Small Planes Arboretum (espresso, improvement)

### System message
```
You are an expert barista helping improve coffee brews. Analyze the full brew history to understand what has been tried and provide specific, actionable suggestions. Be concise and direct.
```

### User prompt
```
You are an expert barista analyzing the brew history for a specific coffee to provide improvement suggestions.

COFFEE:
- Name: Arboretum
- Roaster: Small Planes Coffee
- Brew Method: espresso
- Region: Colombia, Ethiopia
- Roast Level: Medium-Light
- Flavor Notes: Milk Chocolate, Toasted Nuts, Ripe Fruit

GOAL: Help achieve an excellent rating (3/3 stars) with a well-rounded, balanced cup of coffee.

BREW HISTORY (most recent first; ⭐ BASELINE is the brew to improve, 🏆 BEST is the best recorded brew):
- May 1, 2026 ⭐ BASELINE | La Marzocco Linea Mini + Niche Zero | 24d off roast, frozen | grind 23.25 | 18.2g → 30.8g (1:1.69) | 35s | 199.9°F | Not rated | guidance before this brew: "Grind coarser"
- Apr 30, 2026 | La Marzocco Linea Mini + Niche Zero | 23d off roast, frozen | grind 22.75 | 18.2g → 30.7g (1:1.69) | 38s | 199.9°F | Decent | notes: Round, Lacks Sweetness | guidance before this brew: "Reduce final weight"
- Apr 29, 2026 | La Marzocco Linea Mini + Niche Zero | 22d off roast, frozen | grind 22.75 | 18.2g → 33.2g (1:1.82) | 40s | 199.9°F | Bad | notes: Watery start, Round finish | guidance before this brew: "Grind finer"
- Apr 28, 2026 | La Marzocco Linea Mini + Niche Zero | 21d off roast, frozen | grind 23.25 | 18.2g → 33g (1:1.81) | 30s | 199.9°F | Bad | notes: Watery, Unbalanced
- Apr 22, 2026 | La Marzocco Linea Mini + Niche Zero | 15d off roast, frozen | grind 23.25 | 18.2g → 33.3g (1:1.83) | 36s | 203°F | Not rated
- Apr 21, 2026 | La Marzocco Linea Mini + Niche Zero | 14d off roast, frozen | grind 23.5 | 18.2g → 33g (1:1.81) | 27s | 203°F | Not rated | guidance before this brew: "Grind coarser"
- Apr 20, 2026 | La Marzocco Linea Mini + Niche Zero | 13d off roast, frozen | grind 22.5 | 18.2g → 32.8g (1:1.80) | 39s | 203°F | Decent | guidance before this brew: "Reduce yield"
- Apr 19, 2026 | La Marzocco Linea Mini + Niche Zero | 12d off roast, room temp | grind 22.1 | 18.2g → 33.4g (1:1.84) | 29s | 203°F | Bad | notes: Bitter
- Apr 19, 2026 | La Marzocco Linea Mini + Niche Zero | 12d off roast, room temp | grind 22.1 | 18.2g → 32.6g (1:1.79) | 28s | 203°F | Bad | notes: Bitter | guidance before this brew: "Grind finer"
- Apr 18, 2026 | La Marzocco Linea Mini + Niche Zero | 11d off roast, room temp | grind 22.25 | 18.2g → 33g (1:1.81) | 24s | 203°F | Bad | guidance before this brew: "Grind coarser"
- Apr 16, 2026 | La Marzocco Linea Mini + Niche Zero | 9d off roast, room temp | grind 22 | 18.2g → 33g (1:1.81) | 38s | 203°F | Decent | notes: Thin, Sweet, Dry | guidance before this brew: "Increase yield"
- Apr 15, 2026 | La Marzocco Linea Mini + Niche Zero | 8d off roast, room temp | grind 22 | 18.2g → 33.1g (1:1.82) | 30s | 201°F | Decent | notes: Dry, Sweet, Short Finish | guidance before this brew: "Grind finer"
- Apr 14, 2026 | La Marzocco Linea Mini + Niche Zero | 7d off roast, room temp | grind 22 | 18.2g → 31g (1:1.70) | 31s | 201°F | Bad
- Apr 13, 2026 | La Marzocco Linea Mini + Niche Zero | 6d off roast, room temp | grind 21 | 18.1g → 31.1g (1:1.72) | 40s | 201°F | Bad

TRIED SETTINGS (this coffee on this setup, near-identical settings grouped):
- grind 22-22.1, 18.2g, 1:1.70-1.79, room temp → Apr 14: Bad; Apr 19: Bad (consistently Bad). Differed: water 201–203°F.
- grind 22-22.25, 18.2g, 1:1.81-1.84, room temp → Apr 15: Decent; Apr 16: Decent; Apr 18: Bad; Apr 19: Bad (mixed). Differed: time 24s–38s, water 201–203°F.
- grind 22.5-22.75, 18.2g, 1:1.80-1.82, frozen → Apr 20: Decent; Apr 29: Bad (mixed). Differed: water 199.9–203°F.

BREWER PREFERENCES (Niraj Patel, espresso on La Marzocco Linea Mini + Niche Zero, last 20 rated brews across all coffees):
- Your standard (tight band in every recent brew): dose 18.1-18.3g (mode 18.2g). Keep these inside the band.
- Typical Decent-or-better brews, lighter roasts on this setup (n=13 of 20 rated): ratio 1:1.69–1:1.70 (median 1:1.69), time 24s–30s (median 27s), temp 198°F–201°F (median 198°F).
- Recurring complaints on Bad brews: "bitter" ×2.

IMPORTANT CONSIDERATIONS:
1. Focus on the BASELINE BREW (marked ⭐ BASELINE): Your suggestions should specifically address how to improve THIS brew. Use the brew history to understand what has been tried.
2. Equipment: Consider grinder scale direction (some use lower numbers for finer, others higher), sensitivity (stepless grinders like Niche Zero are highly sensitive ~0.5 adjustments, stepped grinders need 2-3 step adjustments), and brewer characteristics when making suggestions.
3. Anti-repeat escalation: When the same parameter+direction has been suggested in any of the three prior brews on this coffee, you MUST NOT repeat the same magnitude. Either (a) escalate the magnitude meaningfully (~2× the prior step) and explain why, (b) switch to a different parameter from the decision hierarchy, or (c) explicitly recommend holding all parameters and re-tasting to confirm the diagnosis. The minimal-change preference does not apply once a small step in this direction has already been tried without improvement.
   - Hold once: if the baseline is a single bad cup at settings that produced Decent or better before, recommend repeating those settings (Medium or Low confidence) unless the tasting notes name a new defect. If the previous cup at these settings was also bad, move on with (a) or (b). Never hold twice in a row.
4. NO BREW IDs: Do not reference brew numbers (like "Brew #1" or "#3") in your response. When referring to previous brews, use descriptive terms like "previous attempts", "an earlier excellent brew", etc. The user does not have access to brew numbers.
5. Baseline Brew Terminology: When referring to the baseline brew in your summary or suggestions, always use the term "baseline brew". This brew is the starting point for improvement suggestions.
6. Do not infer causes that are not supported by recorded data.
7. Evidence order when sources disagree: the baseline brew, then this coffee's tried settings and history, then the brewer's preferences. Lines marked "low sample" are hints, not targets.
8. Tried settings: mixed outcomes at the same settings mean execution or bean variance, so repeat the settings rather than move the recipe; name a cause only when it is the single recorded difference. Never propose settings listed as consistently Bad.
9. Bean age: days off roast is a freshness signal only for room-temperature beans. For frozen beans, do not attribute taste to age.
10. Keep any parameter listed as the brewer's standard inside its band unless history shows the band causes the problem.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless history strongly suggests otherwise; default to small steps for the first attempt at a parameter, then escalate per rule 3):
   - Grind setting
   - Flow behavior / puck preparation (if flow issues indicate channeling, address distribution, tamping, or pre-infusion before changing core parameters)
   - Final weight / ratio
   - Water temperature
   - Dose

B) Require directional reasoning (no vague advice):
   - Each suggestion must specify the exact direction and a small magnitude that fits the grinder/equipment (example: "Grind finer by ~0.3–0.5 on Niche Zero").
   - Each suggestion must include the expected taste/texture impact in the brewer's own tasting-note words where possible (example: "should fix the lack of sweetness").

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

TONE AND VOICE:
Use a calm, confident, craft-focused tone.
Sound like an experienced specialty barista giving guidance.
```

### Response (saved as `suggestion`)
```json
{
  "concise": {
    "goal": "Confirm balance",
    "action": "Hold and retaste",
    "confidence": "Medium"
  },
  "full": {
    "summary": "The baseline brew is unrated and has no tasting notes, so no flavor defect or quality improvement has been established. Its shorter shot time alone does not establish better sweetness or balance.",
    "primaryIssue": "Unconfirmed extraction balance: the baseline brew lacks a recorded tasting outcome",
    "suggestions": [
      {
        "parameter": "Recipe confirmation",
        "action": "Repeat grind 23.25, dose 18.2g, yield 30.8g, and temperature 199.9°F; record a rating and assess sweetness, roundness, and body",
        "effect": "This will establish whether the baseline brew retains the previous cup’s roundness while resolving its lack of sweetness",
        "reasoning": "The latest coarser adjustment shortened the shot but has no recorded taste result, so confirm its effect before changing another parameter",
        "confidence": "Medium"
      }
    ],
    "basis": [
      "May 1, 2026: baseline brew unrated after coarser adjustment",
      "Apr 30, 2026: Decent, Round, Lacks Sweetness at nearly identical yield"
    ]
  }
}
```

---

## Example 2: La Cabra Alto Naranjal (pour over, first brew)

Generated as of the day before this coffee's first brew, so only earlier coffees can be references.

### System message
```
You are an expert barista helping set up initial brew parameters for a new coffee. Provide specific, actionable starting parameters grounded in this brewer's own results on similar beans.
```

### User prompt
```
You are helping a barista brew a coffee for the first time. Suggest starting parameters with a high probability of a well-balanced brew (≈3/3 stars) on the first attempt, with room for easy adjustment.

COFFEE:
- Name: Alto Naranjal
- Roaster: La Cabra
- Brew Method: pour over
- Region: Colombia, Buesaco, Nariño
- Roast Level: Light
- Flavor Notes: Bright Citrus, Red Berries, Deep Dried Fruit
- Brewing Equipment: Hario V60
- Grinder: Fellow Ode Brew Grinder Gen 2

REFERENCE BEANS (this household's best brews of similar coffees, closest first):
- El Diviso - Java by Greater Goods Coffee Co.  (Light, Colombia; bag notes: Dried Dates, Mint Chocolate Chip, Cardamom Caraway). Best brew May 3, 2026 on Hario V60 + Fellow Ode Brew Grinder Gen 2 (Excellent, 67d off roast, frozen): grind 6.3 | 19.5g → 281.9g (1:14.5) | 2:45 | 202°F | pours 0:45→60.2g, 1:30→221g, 2:45→281.9g | notes: Balanced, Layered, Nutty
- Las Flores - Java by Stereoscope (Light, Colombia; bag notes: Pink Pomelo, Lychee, Sparkling, Star Fruit). Best brew Aug 6, 2026 on Hario V60 + Fellow Ode Brew Grinder Gen 2 (Decent, 16d off roast, room temp): grind 5.2 | 20g → 321.4g (1:16.1) | 3:05 | 202°F | pours 0:45→50.6g, 1:15→150.6g, 1:45→240.1g, 3:05→321.4g | notes: Thin, One-Note, Lacks Sweetness
- Colombia Finca La Secreta Lychee by Willy’s Beans (Medium-Light, Colombia, Antioquia; bag notes: lychee, tropical fruit). Best brew Mar 20, 2026 on Hario V60 + Fellow Ode Brew Grinder Gen 2 (Excellent, 26d off roast, frozen): grind 5.0 | 20.4g → 286g (1:14.0) | 2:45 | 203°F | pours 0:45→60.9g, 1:15→219.2g, 2:45→286g | notes: Rounded, Clean Finish

BREWER PREFERENCES (Tasha Patel, pour over on Hario V60 + Fellow Ode Brew Grinder Gen 2, last 20 rated brews across all coffees):
- Your standard (tight band in every recent brew): water temperature 199-202°F (mode 199°F). Keep these inside the band.
- Typical Decent-or-better brews, lighter roasts on this setup (n=16 of 20 rated): ratio 1:15.7–1:16.1 (median 1:16.0), time 2:55–2:59 (median 2:56), temp 199°F–201.3°F (median 201°F).
- Recurring complaints on Bad brews: "unbalanced" ×2, "hollow" ×2, "bitter" ×2.

GUIDELINES:
- Adapt recommendations to the brew method (espresso, pour-over, immersion, etc.).
- Commit to one primary recommended value per parameter.
- Use narrow ranges only when unavoidable (e.g., brew time).
- Prefer forgiving starting points that avoid stalled flow, over-extraction, or under-extraction.
- Anchor grind, ratio, time and temperature to the closest reference on the same grinder, adjust for roast and age differences, and name the reference in the explanation.
- Grind numbers only transfer between brews on the same grinder.
- Keep any parameter listed as the brewer's standard inside its band. Lines marked "low sample" are hints, not targets.
- Days off roast is a freshness signal only for room-temperature beans; frozen beans don't age meaningfully.
- Provide exactly these parameters, in this order: Grind Setting, Dosage, Water Temperature, Brew Time, Final Weight/Ratio, Pour Structure.

TONE AND VOICE:
Use a calm, confident, craft-focused tone.
Sound like an experienced specialty barista giving guidance.
```

### Response
```json
{
  "introduction": "For your first brew of Alto Naranjal, aim to bring its bright citrus and red berries into balance with the deeper dried-fruit sweetness. Start from your excellent Colombian El Diviso brew, with a slightly longer ratio guided by your recent V60 results.",
  "parameters": [
    {
      "name": "Grind Setting",
      "recommendation": "Start at 6.3 on the Fellow Ode Brew Grinder Gen 2",
      "explanation": "El Diviso’s excellent light-roast Colombian brew used 6.3 on this same grinder, making it a forgiving starting point without assuming an unknown freshness difference."
    },
    {
      "name": "Dosage",
      "recommendation": "20g",
      "explanation": "This stays close to El Diviso’s successful 19.5g dose while providing a familiar bed depth for your V60."
    },
    {
      "name": "Water Temperature",
      "recommendation": "201°F",
      "explanation": "One degree below El Diviso’s 202°F, this matches your recent lighter-roast median and stays within your standard temperature band."
    },
    {
      "name": "Brew Time",
      "recommendation": "2:56 total, including bloom",
      "explanation": "This modest extension from El Diviso’s 2:45 accommodates the additional water and matches your recent successful lighter-roast median."
    },
    {
      "name": "Final Weight/Ratio",
      "recommendation": "314g total brew water (1:15.7 coffee-to-water ratio)",
      "explanation": "This lengthens El Diviso’s concentrated 1:14.5 recipe toward your usual successful range while staying below Las Flores’s 1:16.1 brew, which tasted thin and lacked sweetness."
    },
    {
      "name": "Pour Structure",
      "recommendation": "Bloom with 60g until 0:45; pour to 220g by 1:20, then to 314g by 1:55; let drain until approximately 2:56",
      "explanation": "This adapts El Diviso’s successful three-stage structure to the larger water dose, using gentle pours and minimal agitation to preserve clear fruit flavors and steady flow."
    }
  ],
  "note": "Adjust grind first—slightly finer for sour or hollow flavors with fast flow, slightly coarser for bitterness or slow flow—then adjust ratio for strength, treating brew time as a diagnostic rather than a target to force.",
  "basis": [
    "El Diviso: Excellent on May 3, 2026 with the same V60 and Ode Gen 2, grind 6.3, 1:14.5, 2:45, 202°F",
    "16 recent Decent-or-better lighter-roast brews: median 1:16.0, 2:56, 201°F"
  ]
}
```
