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
- **Brewer preferences:** last 20 rated brews on the same brewer (any grinder, since nothing here is a grind number), across all coffees. Covers habit bands, typical Decent-or-better ranges for the roast bucket (n ≥ 5, otherwise labeled low sample), and recurring complaints.
- **Rules:** hold or move (hold only on an Excellent cup or a one-off Bad cup at proven settings; otherwise move toward the best-rated brew; unrated cups are judged from the rated ones and never answered with "rate it"), evidence order, frozen-bean age rule, standard bands, and the brewer's own tasting words.

**First brew (no brews of this bean yet):**
- **Coffees recently brewed on this grinder:** the last 6 coffees on this grinder and method, newest first, rated or not. One line each: roast, origin, bag notes, the middle grind setting and time of its Decent-or-better brews (or of all its brews if none), how many brews that covers, and when it was last brewed. Coffee names are left out so the guidance talks about this coffee, not others.
- **Brewer preferences:** as above, plus the pours of the latest Decent-or-better pour over.
- **Guidelines:** set the grind from the pattern across those coffees (closest roast, time against target, recent ones first), take dose, ratio, time, temperature and pours from the preferences, and explain values without pointing to one past coffee. With no brews on the grinder it falls back to typical ranges.

**Writing style (both prompts):** plain, everyday words and short sentences, no jargon beyond the brewer's own words, no filler, no dashes.

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

GRINDER: Niche Zero: higher numbers are coarser. Stepless dial printed 0–50, with no clicks between marks; write the dial number, allowing fractional settings, e.g. 15.5. Higher numbers mean coarser grinds, and adjustment can extend beyond the printed 50 mark.

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

BREWER PREFERENCES (Niraj Patel, espresso on La Marzocco Linea Mini, last 20 rated brews across all coffees and grinders):
- Your standard (tight band in every recent brew): dose 18.1-18.3g (mode 18.2g). Keep these inside the band.
- Typical Decent-or-better brews, lighter roasts on this brewer (n=13 of 20 rated): ratio 1:1.69–1:1.70 (median 1:1.69), time 24s–30s (median 27s), temp 198°F–201°F (median 198°F).
- Recurring complaints on Bad brews: "bitter" ×2.

IMPORTANT CONSIDERATIONS:
1. Focus on the BASELINE BREW (marked ⭐ BASELINE): Your suggestions should specifically address how to improve THIS brew. Use the brew history to understand what has been tried.
2. Equipment: Consider grinder scale direction (some use lower numbers for finer, others higher), sensitivity (stepless grinders like Niche Zero are highly sensitive ~0.5 adjustments, stepped grinders need 2-3 step adjustments), and brewer characteristics when making suggestions. When a GRINDER line is given, follow its direction and setting format, but write grind settings exactly the way the brew history writes them (same notation and letter case).
3. Hold or move (decide this first; the goal is Excellent, so Decent is not a reason to hold):
   - Hold (repeat the baseline settings) only when the baseline is Excellent, or when it is a single Bad cup at settings that were Decent or better before (similar grind, dose, ratio and time) and its notes name no new defect; then use Medium or Low confidence and don't do it twice in a row. Never hold just to re-taste or collect a rating.
   - Move toward better brews: if an earlier brew of this coffee was rated higher than the baseline, the first suggestion moves toward that brew's settings, starting with the parameter that differs most. Reverting to a proven setting is not repetition. Say which parameters stay unchanged because the best brews share them.
   - Unrated baseline: the cup is gone, so never ask to re-taste or rate it, and don't guess how it tasted. Count every Decent or better brew as rated higher (the most recent one when tied): hold only if the best rated brews used these settings; otherwise move toward the best as above. If the baseline already matches it, or nothing is rated Decent, keep fixing the last recorded defect. You may add one alternative for a different outcome (e.g. "if it turned bitter instead, go back to 5.2").
   - Mixed outcomes at the same settings mean execution or bean variance: name a recipe cause only when it is the single recorded difference, and don't treat the mix as a reason to hold when a better-rated brew used different settings. Never propose settings listed as consistently Bad.
   - No repeated small steps: if the same parameter and direction was suggested in any of the three prior brews without improvement, escalate (~2× the prior step) and say why, or switch to another parameter from the decision hierarchy.
4. NO BREW IDs: Do not reference brew numbers (like "Brew #1" or "#3") in your response. When referring to previous brews, use descriptive terms like "previous attempts", "an earlier excellent brew", etc. The user does not have access to brew numbers.
5. Baseline Brew Terminology: When referring to the baseline brew in your summary or suggestions, always use the term "baseline brew". This brew is the starting point for improvement suggestions.
6. Do not infer causes that are not supported by recorded data.
7. Evidence order when sources disagree: the baseline brew, then this coffee's tried settings and history, then the brewer's preferences. Lines marked "low sample" are hints, not targets.
8. Bean age: days off roast is a freshness signal only for room-temperature beans. For frozen beans, do not attribute taste to age.
9. Keep any parameter listed as the brewer's standard inside its band unless history shows the band causes the problem.

ADDITIONAL RULES TO FOLLOW:
A) Decision hierarchy (use this order unless rule 3 or the history points elsewhere; default to small steps for the first attempt at a parameter, then escalate per rule 3):
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
   - Re-derive this from the baseline brew's recorded outcome alone (for an unrated baseline, from the brews rule 3 points to); do not carry forward the diagnosis from any prior brew. If the same diagnosis recurs across consecutive brews despite parameter changes, treat that as evidence the diagnosis itself is wrong and consider an alternative cause (e.g. dose / ratio rather than grind, or puck preparation).

E) Quality over quantity:
   - If fewer than three high-quality, non-redundant suggestions exist, provide fewer.
   - It is acceptable to provide only 1-2 suggestions if those are the most impactful.
   - Do not suggest adjusting parameters that are already optimal or not contributing to the issue.

WRITING STYLE:
- Write for a home brewer: plain, everyday words and short sentences.
- Avoid jargon. Use the words the brewer already uses in their notes and recipe.
- Sound like a person talking, not a report. Skip filler and stock phrases.
- Use commas and periods, not dashes.
- Every sentence should say what to do or why.
```

### Response (saved as `suggestion`)
```json
{
  "concise": {
    "goal": "Increase sweetness",
    "action": "Grind finer",
    "confidence": "Medium"
  },
  "full": {
    "summary": "The baseline brew is unrated. The closest rated brew was Decent, with a round cup but not enough sweetness.",
    "primaryIssue": "Lack of sweetness in the closest rated recipe",
    "suggestions": [
      {
        "parameter": "Grind setting",
        "action": "Grind finer from 23.25 to 22.75, keeping the dose at 18.2g, final weight at 30.8g, and temperature at 199.9°F",
        "effect": "This should increase sweetness while keeping the cup round",
        "reasoning": "The most recent Decent brew used this finer setting with the same short ratio and temperature, while the longer-yield attempt at this setting tasted watery",
        "confidence": "Medium"
      }
    ],
    "basis": [
      "Apr 30, 2026: 22.75, 18.2g → 30.7g, Decent, round but lacking sweetness",
      "Apr 29, 2026: 22.75, 18.2g → 33.2g, Bad, watery start"
    ]
  }
}
```

---

## Example 2: La Cabra Alto Naranjal (pour over, first brew)

Generated as of the day before this coffee's first brew, so only earlier brews appear.

### System message
```
You are an expert barista helping set up initial brew parameters for a new coffee. Provide specific, actionable starting parameters grounded in this brewer's own past brews on this equipment.
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
- Grinder: Fellow Ode Brew Grinder Gen 2: higher numbers are coarser. Dial printed 1–11, with two intermediate tick marks between integers (three click increments per integer; 31 settings total). Write intermediate settings as .1 or .2 click labels, not decimal fractions: for example, 5.1 is the first click above 5, followed by 5.2 and then 6.

COFFEES RECENTLY BREWED ON THIS GRINDER (pour over, newest first):
- Light roast, Colombia (bag notes: Pink Pomelo, Lychee, Sparkling, Star Fruit): typically grind 5.2, 3:01, from 4 Decent-or-better brews; last brewed Aug 13, 2026.
- Medium-Light roast, Risaralda, Colombia (bag notes: Watermelon Candy, Rose, Kiwi): typically grind 5.3, 2:57, from 5 Decent-or-better brews; last brewed Jul 24, 2026.
- Light roast, Mexico (bag notes: Watermelon, Honey, Soft Floral): typically grind 4.1, 2:55, from 7 Decent-or-better brews; last brewed Jul 7, 2026.
- Medium-Light roast, Colombia (bag notes: Pomegranate, Black Tea, Honey): typically grind 4.5, 3:18, from 4 Bad brews; last brewed Jun 5, 2026.
- Light roast, Sierra Mazateca, Oaxaca, Mexico (bag notes: Rosewater, Berry Jam, Marzipan): typically grind 5.0, 3:30, from 9 Decent-or-better brews; last brewed May 12, 2026.
- Light roast, Colombia (bag notes: Dried Dates, Mint Chocolate Chip, Cardamom Caraway): typically grind 6.3, 2:35, from 3 Decent-or-better brews; last brewed May 3, 2026.

BREWER PREFERENCES (Tasha Patel, pour over on Hario V60, last 20 rated brews across all coffees and grinders):
- Your standard (tight band in every recent brew): water temperature 199-202°F (mode 199°F). Keep these inside the band.
- Typical Decent-or-better brews, lighter roasts on this brewer (n=16 of 20 rated): ratio 1:15.7–1:16.1 (median 1:16.0), time 2:55–2:59 (median 2:56), temp 199°F–201.3°F (median 201°F).
- Recurring complaints on Bad brews: "unbalanced" ×2, "hollow" ×2, "bitter" ×2.
- Pours in the latest Decent-or-better brew (Aug 6, 2026, 20g → 321.4g): 0:45→50.6g, 1:15→150.6g, 1:45→240.1g, 3:05→321.4g.

GUIDELINES:
- Adapt recommendations to the brew method (espresso, pour-over, immersion, etc.).
- Commit to one primary recommended value per parameter.
- Use narrow ranges only when unavoidable (e.g., brew time).
- Prefer forgiving starting points that avoid stalled flow, over-extraction, or under-extraction.
- Set the grind from the pattern across this grinder's coffees, not from any single one: different coffees land at different settings. Weigh coffees closest in roast to this one, correct for whether their brews ran slower or faster than the time you're targeting, and favor recent coffees, since they show where the dial sits now.
- Take dose, ratio, time, temperature and any pour pattern from the brewer's preferences when given.
- Past brews of other coffees are evidence, not the story. Explain each value in terms of this coffee and the brewer's brews as a whole, without pointing to one particular past coffee.
- Keep any parameter listed as the brewer's standard inside its band. Lines marked "low sample" are hints, not targets.
- Days off roast is a freshness signal only for room-temperature beans; frozen beans don't age meaningfully.
- Provide exactly these parameters, in this order: Grind Setting, Dosage, Water Temperature, Brew Time, Final Weight/Ratio, Pour Structure.

WRITING STYLE:
- Write for a home brewer: plain, everyday words and short sentences.
- Avoid jargon. Use the words the brewer already uses in their notes and recipe.
- Sound like a person talking, not a report. Skip filler and stock phrases.
- Use commas and periods, not dashes.
- Every sentence should say what to do or why.
```

### Response
```json
{
  "introduction": "Alto Naranjal pairs bright citrus and red berries with deeper dried-fruit sweetness. Start with your usual light-roast recipe to keep that brightness sweet rather than sharp.",
  "parameters": [
    {
      "name": "Grind Setting",
      "recommendation": "5.2",
      "explanation": "Your recent light-roast brews point to this as a forgiving starting grind for clear fruit and steady flow."
    },
    {
      "name": "Dosage",
      "recommendation": "20 g",
      "explanation": "Your familiar dose keeps the V60 setup consistent while you learn this coffee."
    },
    {
      "name": "Water Temperature",
      "recommendation": "201°F",
      "explanation": "This matches your successful light-roast brews and should bring out sweetness alongside the citrus."
    },
    {
      "name": "Brew Time",
      "recommendation": "2:56",
      "explanation": "Your usual successful finish time is a useful target for balancing bright fruit with dried-fruit depth."
    },
    {
      "name": "Final Weight/Ratio",
      "recommendation": "320 g water, 1:16",
      "explanation": "Your usual ratio gives the fruit room to show without making the cup hollow."
    },
    {
      "name": "Pour Structure",
      "recommendation": "4 pours, cumulative totals: 50 g bloom until 0:45, 150 g by 1:15, 240 g by 1:45, 320 g by 2:05.",
      "explanation": "This follows your successful staged-pour pattern, with the final pour early enough to allow drainage toward 2:56."
    }
  ],
  "note": "Adjust grind first, one click finer if sour and fast or coarser if bitter and slow, then adjust ratio or pour timing only if the cup still needs balancing.",
  "basis": [
    "Your recent Ode Gen 2 pour-over brews and rated Hario V60 light-roast recipes."
  ]
}
```
