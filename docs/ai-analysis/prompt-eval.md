# Brew Prompt Eval — OLD vs NEW on gpt-5.4

Generated 2026-04-29T02:20:41.211Z. Fixtures: scripts/fixtures/brew-sequences.json

## Aggregate scorecard

| Check | OLD | NEW | Δ |
|---|---|---|---|
| A_diagnosisRefreshed | 80% (8/10) | 90% (9/10) | 10pp |
| A_breaksRepeatLoop | 63% (5/8) | 78% (7/9) | 15pp |
| A_hasMagnitude | 92% (11/12) | 100% (12/12) | 8pp |
| B_noHedges | 100% (12/12) | 100% (12/12) | 0pp |
| B_imperative | 100% (12/12) | 100% (12/12) | 0pp |

Token usage:
- OLD: prompt=24454, completion=4945, total=29399
- NEW: prompt=25744, completion=3854, total=29598
- delta: 0.7% total tokens (NEW vs OLD)

Voice/conciseness:
- mean summary words/sentence: OLD=19.6 → NEW=17.9

## Verdict: **SHIP**
- issue-fix gate: pass (NEW pass-rate must meet or beat OLD on every check)
- voice/conciseness gate: pass (NEW pass-rate must be ≥ 95% of OLD on hedge + imperative checks)

---


## Small Planes Coffee — Arboretum

### Brew 3 (2026-04-15, quality=Decent)
Prev top suggestion: `Grind finer by ~0.3–0.5 on the Niche Zero (from 22 to ~21.5–21.7) and keep yield at 31g` (Medium); params changed since prev: `brewTime, finalWeight`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was decent but tasted dry, sweet, and short, missing finish and roundness. Later attempts at the same ratio became either bitter or watery/unbalanced, so the target is a slightly fuller, more even extraction without pushing into harshness.",
  "primaryIssue": "under-extracted due to slightly fast flow at the baseline grind setting",
  "suggestions": [
    {
      "parameter": "Grind",
      "action": "Grind finer by ~0.2 to 0.3 on the Niche Zero from the baseline brew",
      "effect": "This should increase body, extend the finish, and improve balance without pushing the shot into the bitterness seen at clearly finer settings",
      "reasoning": "The baseline brew ran 30s at 201°F and tasted dry with a short finish, while moving much finer repeatedly produced bitter shots and moving coarser led to watery or unbalanced cups, so the best next step is a very small move finer from baseline",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Keep dose at 18.2g and reduce yield slightly to 31.5 to 32g instead of ~33g",
      "effect": "This will add concentration and texture, helping the chocolate and nut notes feel rounder and less dry",
      "reasoning": "Across the history the ratio stayed near 1:1.8 and never improved beyond decent, so a small reduction in yield is the cleanest non-redundant way to build sweetness and finish from the baseline brew",
      "confidence": "Medium"
    },
    {
      "parameter": "Water temperature",
      "action": "Keep temperature at 201°F for the next dial-in shot",
      "effect": "This will avoid adding bitterness while you tighten extraction through grind or yield",
      "reasoning": "Higher-temperature attempts at 203°F did not produce a clearly better result and included both bitter and watery outcomes, so temperature is not the lever to move first",
      "confidence": "High"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was decent but tasted dry, sweet, and short-finished, so it had some sweetness but lacked roundness, body, and a longer balanced finish. The cup was missing fuller extraction and texture.",
  "primaryIssue": "under-extracted due to slightly fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by about 0.3 on the Niche Zero, moving from 22 to around 21.7",
      "effect": "This should increase body, extend the finish, and make the sweetness feel more integrated rather than dry",
      "reasoning": "The baseline brew ran 30s at a standard ratio yet finished short and dry, and nearby attempts show this coffee responds noticeably to small grind changes on this grinder",
      "confidence": "Medium"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Keep the dose at 18.2g and reduce the yield slightly to 31.5-32g instead of 33.1g",
      "effect": "This will add concentration and texture, helping the shot feel more rounded and less thin at the finish",
      "reasoning": "The baseline brew already had sweetness, so a slightly shorter ratio is a direct way to build body without pushing extraction too far",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=true → new=true
- A_breaksRepeatLoop: old=false → new=false
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=20.0 → new=16.5

### Brew 4 (2026-04-16, quality=Decent)
Prev top suggestion: `Increase final weight to 36–38g while keeping grind at 22 and aiming for 30–33s` (Medium); params changed since prev: `waterTemp, brewTime, finalWeight`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was decent but thin, sweet, and dry, so it had some sweetness but lacked body and balance. Later attempts at similar ratio and temperature swung between bitter and watery, which points to unstable extraction around the same target yield rather than a simple temperature problem.",
  "primaryIssue": "uneven extraction from puck flow instability",
  "suggestions": [
    {
      "parameter": "Puck preparation",
      "action": "Keep the baseline recipe unchanged and add a stricter prep routine: thorough WDT, level the bed, tamp straight and consistently, and use the same puck screen or no puck screen every time",
      "effect": "This should reduce watery-bitter imbalance and give a fuller, more even cup with better sweetness and less dryness",
      "reasoning": "At nearly the same dose, yield, and temperature, previous attempts ranged from fast and watery to bitter and slow, which is stronger evidence of puck inconsistency than of a core recipe issue",
      "confidence": "High"
    },
    {
      "parameter": "Grind setting",
      "action": "After improving puck prep, grind finer by about 0.2 to 0.3 on the Niche Zero from the baseline setting",
      "effect": "This should add body and improve balance by increasing extraction slightly without pushing as far into bitterness as the clearly finer settings did",
      "reasoning": "The baseline brew was thin and dry, while moving much finer produced bitter shots and moving coarser produced faster, weaker shots, so only a very small move finer is justified",
      "confidence": "Medium"
    },
    {
      "parameter": "Final weight",
      "action": "If the shot is still thin after the small grind change, lower the yield from 33g to 31.5 to 32g while keeping the dose at 18.2g",
      "effect": "This will increase concentration and body, helping the milk chocolate and toasted nut notes come forward with less watery finish",
      "reasoning": "The baseline and later attempts all stayed near the same yield, so a small reduction is the cleanest next lever to improve texture without repeating larger grind changes that already failed",
      "confidence": "Medium"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was decent but thin, sweet, and dry, so it had some sweetness but lacked body and balance. The cup needs more concentration and a rounder texture.",
  "primaryIssue": "under-extracted due to excessive yield",
  "suggestions": [
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce the yield from 33g to 30-31g while keeping dose at 18.2g",
      "effect": "This will increase body, improve balance, and reduce the thin, dry finish",
      "reasoning": "The baseline brew and nearly all later attempts stayed around the same 33g output, while grind changes alone did not move the coffee past decent and the most recent shot became watery at the same ratio",
      "confidence": "High"
    },
    {
      "parameter": "Grind setting",
      "action": "After shortening the yield, hold the shot near 30-31g and grind finer by about 0.3 on the Niche Zero from the baseline brew",
      "effect": "This should add texture and sweetness while improving extraction enough to support the ripe fruit without turning bitter",
      "reasoning": "A slightly finer setting than the baseline produced a similarly rated but slower shot, while much coarser settings led to faster and more watery results, so a modest move finer is the cleanest next adjustment",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=true → new=true
- A_breaksRepeatLoop: old=undefined → new=true
- A_hasMagnitude: old=false → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=24.0 → new=14.5

### Brew 5 (2026-04-18, quality=Bad)
Prev top suggestion: `Grind coarser by ~0.5–1.0 on the Niche Zero to target ~28–32s for the same 33g yield` (High); params changed since prev: `grindSetting, brewTime`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was rated bad and came across thin and unbalanced. It was missing body and cohesion, with extraction landing too low for a balanced espresso.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by ~0.2 to 0.3 on the Niche Zero from the baseline brew, moving from 22.25 to about 22.0-21.95",
      "effect": "This will slow the shot slightly, increase extraction, and add more body and sweetness while reducing the watery character",
      "reasoning": "A slightly finer setting than the baseline already produced slower shots, and the frozen-bean attempts at coarser settings trended even thinner and less balanced",
      "confidence": "High"
    },
    {
      "parameter": "Final weight",
      "action": "Keep dose at 18.2g and reduce yield slightly to 31-32g out instead of 33g",
      "effect": "This should improve concentration and texture, making the cup feel fuller and more integrated",
      "reasoning": "Across the history the ratio stayed near the same 33g target, so tightening the yield is the cleanest untried way to address the baseline brew's watery finish without making a large change",
      "confidence": "Medium"
    },
    {
      "parameter": "Water temperature",
      "action": "Keep water temperature at 203°F unchanged",
      "effect": "This will preserve the current balance of sweetness and fruit while you correct extraction through flow and ratio first",
      "reasoning": "Temperature has been stable across all attempts, so the history does not support it as the main lever for fixing the baseline brew",
      "confidence": "High"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was rated bad and came across flat and unconvincing, with the shot running on the fast side for this dose and yield. It was missing sweetness, body, and balance.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by about 0.5 on the Niche Zero, moving from 22.25 to around 21.75",
      "effect": "This will slow the shot, increase extraction, and add more body and sweetness while reducing the thin, uneven cup profile",
      "reasoning": "The baseline brew was the fastest room-temperature shot at the same dose and yield, and later finer settings produced longer extractions with at least some improvement in cup quality",
      "confidence": "High"
    },
    {
      "parameter": "Flow behavior / puck preparation",
      "action": "Keep the same dose and yield, but tighten puck prep by using a thorough WDT, level distribution, and a firm consistent tamp before pulling the shot",
      "effect": "This should improve flow uniformity and make the cup taste more integrated, with less hollowness and better balance",
      "reasoning": "A watery and unbalanced result later at the same grind and ratio points to flow inconsistency, so improving puck prep addresses the same failure mode without repeating another small grind move",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=true → new=true
- A_breaksRepeatLoop: old=true → new=true
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=13.5 → new=16.0

### Brew 6 (2026-04-19, quality=Bad)
Prev top suggestion: `Grind finer by ~0.5–1.0 on the Niche Zero (from 22.25 to ~21.25–21.75)` (High); params changed since prev: `grindSetting, brewTime, finalWeight`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was rated bad and tasted bitter, with a short 28s shot at roughly 1:1.8 that still drank harsh instead of balanced. Across the history, tighter ratios and slower shots did not produce a rounded cup, and the latest frozen-bean attempt turned watery and unbalanced, so the coffee is missing sweetness and cohesion.",
  "primaryIssue": "over-extracted due to too much extraction intensity at the current ratio and temperature",
  "suggestions": [
    {
      "parameter": "Final weight / ratio",
      "action": "Increase the yield slightly to 35-36g from 18.2g dose while keeping the shot in roughly the same 28-30s range",
      "effect": "This should reduce bitterness, open up the ripe fruit, and make the cup feel more balanced rather than dense and harsh",
      "reasoning": "Multiple earlier attempts stayed very tight around 32.6-33.4g and never produced an excellent result, so moving slightly longer is the cleanest new adjustment from the baseline brew",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "Lower brew temperature by 1-2°F to 201-202°F",
      "effect": "This will soften roast-driven bitterness and help the chocolate and nut notes present with more sweetness",
      "reasoning": "Every recorded shot used 203°F, including the bitter baseline brew and the other non-excellent attempts, so temperature is a stable variable worth nudging after ratio",
      "confidence": "High"
    },
    {
      "parameter": "Grind setting",
      "action": "If the longer yield runs too fast, grind finer by about 0.2-0.3 on the Niche Zero to hold the shot near 28-30s",
      "effect": "This will preserve body and prevent the cup from turning watery while still allowing the slightly longer ratio to taste cleaner",
      "reasoning": "The frozen-bean shot at the same general yield became watery when flow sped up, so only a very small grind correction is warranted to support the ratio change rather than repeat a larger grind move",
      "confidence": "Medium"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was bad, tasting bitter and lacking balance. It needs less extraction to bring back sweetness, cleaner structure, and a more rounded finish.",
  "primaryIssue": "over-extracted due to too-fine grind",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind coarser by ~0.8 to 1.0 on the Niche Zero from the baseline brew",
      "effect": "This should reduce bitterness, improve balance, and bring back more chocolate and nut sweetness with a cleaner finish",
      "reasoning": "A small move coarser from the baseline was already tried in later attempts, and the best result in the history came from going meaningfully coarser than the baseline",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Keep the dose at 18.2g and increase yield slightly to 34 to 35g",
      "effect": "This will lighten the finish, reduce harshness, and make the cup feel less heavy and more even",
      "reasoning": "Your espresso has stayed very tight around a short ratio across attempts, so a modestly longer yield is the cleanest non-grind way to ease bitterness without changing the coffee dose",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=true → new=true
- A_breaksRepeatLoop: old=true → new=true
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=18.7 → new=12.5

### Brew 7 (2026-04-19, quality=Bad)

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was rated bad and tasted bitter, showing a shot that extracted too harshly without balance. Previous attempts then moved coarser and even became watery and unbalanced, so the target is a small reduction in extraction rather than a large shift.",
  "primaryIssue": "over-extracted due to slightly too fine a grind at the current ratio",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind coarser by ~0.1 to 0.2 on the Niche Zero from the baseline brew",
      "effect": "This should reduce bitterness and harshness while keeping enough body and sweetness for a more balanced shot",
      "reasoning": "The baseline brew was bitter at 22.1, while moving much coarser into the 22.5 to 23.5 range did not produce a clearly better result and eventually became watery, so only a very small coarsening is warranted",
      "confidence": "High"
    },
    {
      "parameter": "Final weight",
      "action": "Keep dose at 18.2g and stop the shot slightly shorter at 31.5 to 32g out",
      "effect": "This will increase concentration and body while trimming some of the bitter finish",
      "reasoning": "All attempts stayed clustered around 33g out, so a small yield reduction is the cleanest untried way to pull the baseline brew back toward more sweetness and texture without changing the overall recipe dramatically",
      "confidence": "Medium"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was rated bad and tasted bitter, so the cup was missing balance and sweetness. At a similar ratio and temperature, later frozen-bean shots ran both slower and faster without improving quality, which points away from grind alone and toward too much extraction for this coffee at the current yield.",
  "primaryIssue": "over-extracted due to excessive yield",
  "suggestions": [
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce the shot to 29.5-31g out from 18.2g in, keeping all other baseline brew parameters the same",
      "effect": "This will cut bitterness, increase sweetness and body, and bring the milk chocolate and toasted nut notes into better balance",
      "reasoning": "The baseline brew was bitter at about 1:1.84, and nearby grind changes around the same yield did not produce a clearly better result, so the next clean move is a meaningfully shorter ratio",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "If the shorter yield is still bitter, lower brew temperature by 2°F to 201°F while keeping the shorter shot target",
      "effect": "This should soften harshness and make the ripe fruit note clearer without thinning the espresso",
      "reasoning": "Temperature has not been tested yet, and with a medium-light blend showing bitterness across multiple attempts, a small drop is the next non-redundant lever after ratio",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=21.5 → new=26.0

### Brew 8 (2026-04-20, quality=Decent)
Prev top suggestion: `Reduce final weight to 30–31g (keep 18.2g dose) and stop the shot at that yield even if time stays ~27–30s` (High); params changed since prev: `grindSetting, brewTime, finalWeight, coffeeTemperature`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was decent but still lacked balance, and later attempts at a coarser setting turned watery and unbalanced. The cup is missing concentration and cohesion, with flow drifting too fast once the grind moved away from the tighter baseline.",
  "primaryIssue": "under-extracted due to slightly fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by ~0.3 to 0.5 on the Niche Zero from the baseline brew, targeting about 22.0 to 22.2",
      "effect": "This should increase body, improve sweetness, and make the shot more balanced and integrated",
      "reasoning": "The baseline brew was the strongest result, and moving coarser from there repeatedly led to faster shots and a watery, unbalanced cup",
      "confidence": "High"
    },
    {
      "parameter": "Final weight",
      "action": "Keep dose and temperature unchanged, but reduce yield slightly to 31.5 to 32g out from 18.2g in",
      "effect": "This will raise concentration and help the milk chocolate and toasted nut notes come through with more weight",
      "reasoning": "Recent shots stayed around 33g out and the poorest result tasted watery, so a small ratio reduction is a cleaner next step than repeating broader grind changes",
      "confidence": "Medium"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was decent but ran heavy and slow, leaving the cup short on balance and clarity rather than fully rounded. What was missing was a cleaner, sweeter center with better integration of body and fruit.",
  "primaryIssue": "over-extracted due to too fine a grind",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind coarser by 0.5 on the Niche Zero, moving from 22.5 to about 23.0",
      "effect": "This should reduce harsh extraction, improve balance, and bring back more sweetness and clearer fruit while keeping enough body",
      "reasoning": "The baseline brew was the slowest shot in the set, and nearby coarser settings brought extraction time down substantially, so the first move is to open the grind slightly from the baseline brew",
      "confidence": "High"
    },
    {
      "parameter": "Final weight",
      "action": "If the shot still tastes heavy at the coarser grind, increase yield slightly to 34.5-35g while keeping the same dose",
      "effect": "This will lighten the cup structure a touch and improve balance and clarity without making it thin",
      "reasoning": "The baseline brew was already a relatively tight ratio, so a small yield increase is the next clean way to round out the cup after correcting the slow flow",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=true → new=true
- A_breaksRepeatLoop: old=true → new=true
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=20.5 → new=18.5

### Brew 11 (2026-04-28, quality=Bad)

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was bad, tasting watery and unbalanced, with too little body and cohesion in the cup. The shot ran on the fast side for this coffee at the current ratio, leaving extraction too low to develop sweetness and structure.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by ~0.3 on the Niche Zero, moving from 23.25 to about 22.95",
      "effect": "This should slow the shot slightly, increase body, and bring more chocolate sweetness and balance",
      "reasoning": "At the same dose, temperature, and yield, the baseline brew ran faster than earlier frozen-bean attempts, while a finer frozen setting produced a slower and better-balanced result",
      "confidence": "High"
    },
    {
      "parameter": "Final weight",
      "action": "Keep the finer grind change and reduce yield slightly to 31.5-32g out from 18.2g in",
      "effect": "This will increase concentration and texture, reducing the watery character while keeping ripe fruit from getting washed out",
      "reasoning": "The baseline brew was thin at roughly the same 1:1.8 ratio used throughout, so a small cut in yield is a cleaner next step than repeating temperature or dose changes",
      "confidence": "Medium"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was rated bad and tasted watery and unbalanced; it lacked body and cohesion because the shot ran too quickly at the current ratio for this coffee.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by about 0.5 on the Niche Zero, moving from 23.25 to around 22.75",
      "effect": "This should slow the shot, increase body, and bring the milk chocolate and nut sweetness forward so the cup tastes more balanced",
      "reasoning": "At the same dose, temperature, and yield, a slightly finer setting previously pushed shot time notably longer, and the coarser baseline landed at a thin 30-second extraction with watery flavor",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "If the finer grind still tastes thin, reduce the yield to 31-32g from the same 18.2g dose",
      "effect": "This will increase concentration and texture, making the espresso feel less watery and more rounded",
      "reasoning": "The baseline problem is weak body rather than bitterness, and a slightly shorter ratio is the next clean way to add strength without changing multiple core variables at once",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=20.5 → new=29.0

## Small Planes Coffee — Mazateca Mujeres

### Brew 3 (2026-04-03, quality=Bad)
Prev top suggestion: `Grind finer by 0.5 on the Ode Gen 2 (from 5.0 to 4.5)` (High); params changed since prev: `grindSetting, dosage, brewTime, finalWeight`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was rated bad with an unbalanced, mild cup that was not sweet. Across later attempts, changing grind and pour structure alone never moved the coffee past decent and repeatedly left it thin or one-note.",
  "primaryIssue": "under-extracted due to insufficient extraction strength",
  "suggestions": [
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce final beverage weight from 282g to 260-265g while keeping the 20g dose the same",
      "effect": "This will increase strength, improve sweetness, and give the cup more body and a longer finish",
      "reasoning": "Multiple later brews stayed around 278-285g and still tasted thin, mild, or one-note, so the clearest untried move is to tighten the ratio rather than keep chasing grind alone",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "Raise water temperature from 204°F to 206°F",
      "effect": "This should increase extraction slightly and help bring out more jammy sweetness and marzipan depth without a major change in structure",
      "reasoning": "Later brews at 201-204°F did not produce sweetness or balance, and this light roast can handle a small temperature increase better than another large grind shift",
      "confidence": "Medium"
    },
    {
      "parameter": "Grind / flow behavior",
      "action": "Keep the grinder near 4.7-5.0 and do not go coarser than 5.3 on the Ode Gen 2",
      "effect": "This will preserve contact time and avoid making the cup even thinner or flatter",
      "reasoning": "Coarser settings in later brews did not improve quality and one of the coarsest attempts was explicitly thin and one-note, so grind is already near the useful range and should stay stable while you adjust ratio first",
      "confidence": "High"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was rated bad and tasted unbalanced, not sweet, and mild; it lacked both sweetness and structure. The cup points to under-extraction from a brew that moved too quickly and too gently for this coffee.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by about 0.4 to 4.1 on the Ode Gen 2",
      "effect": "This should increase sweetness, improve intensity, and give the cup a longer, more balanced finish",
      "reasoning": "The baseline brew was coarse and mild, and later attempts at slightly coarser settings repeatedly stayed thin and one-note rather than improving balance",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce final yield from about 282g to 270g while keeping the same 20g dose",
      "effect": "This will raise concentration, add body, and help the berry jam and marzipan notes read as fuller and sweeter",
      "reasoning": "Across the history the brews clustered around a relatively high yield for the dose while the recurring complaints were thinness, short finish, and lack of sweetness",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "Keep the finer grind and shorter yield, then raise water temperature from 204°F to 206°F if the cup is still mild",
      "effect": "This should improve extraction of sweetness and floral-fruit complexity without changing the brew structure",
      "reasoning": "Higher temperature has not yet been meaningfully tested on this coffee, while lower-temperature attempts did not solve the lack of sweetness",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=true → new=true
- A_breaksRepeatLoop: old=true → new=true
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=18.5 → new=18.5

### Brew 4 (2026-04-06, quality=Bad)
Prev top suggestion: `Grind finer by 0.3–0.5 on the Ode Gen 2 (from 4.5 to ~4.0–4.2)` (High); params changed since prev: `brewTime, finalWeight`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was bad: sweet and acidic but astringent, so it had some attractive top notes but lacked balance and structure. Across later attempts, moving coarser and cooler removed the harshness but repeatedly produced thin, one-note cups, showing the coffee still needs more extraction without the baseline brew’s uneven finish.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by about 0.2-0.4 from the recent 5.3 setting, targeting around 4.9-5.1 on the Ode Gen 2",
      "effect": "This should increase sweetness, body, and finish while keeping more clarity than the baseline brew",
      "reasoning": "Multiple coarser attempts around 5.3-6.0 stayed thin and one-note, while the much finer baseline brew showed more intensity but became astringent, so the best next move is a small step finer rather than another large change",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "Keep water at 203°F",
      "effect": "This will preserve enough extraction for a light roast without pushing the cup back toward the baseline brew’s harsher edge",
      "reasoning": "Later brews at 203°F were cleaner than the cooler 201°F attempts, and the hotter 204°F baseline brew was the one that turned astringent",
      "confidence": "High"
    },
    {
      "parameter": "Pour structure / final weight",
      "action": "Use the simpler 3-pour structure and stop at 270-275g instead of 280g",
      "effect": "This should add concentration and mid-palate weight, reducing the thin, short finish",
      "reasoning": "Both multi-pour and 3-pour approaches have been tried at similar yields, but the recurring thinness points to slightly too much dilution, so a small reduction in final weight is a cleaner adjustment than changing dose",
      "confidence": "Medium"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was bad: sweet and acidic but astringent, which left the cup unbalanced instead of rounded and integrated. What was missing was cleaner sweetness and a fuller, more cohesive finish.",
  "primaryIssue": "over-extracted due to excessive agitation at a fine grind",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind coarser by about 0.8 to 1.0 on the Ode Gen 2, moving from 4.5 to around 5.3-5.5",
      "effect": "This should reduce astringency, soften the sharp acidity, and improve clarity without stripping out sweetness",
      "reasoning": "The baseline brew was the finest setting used and the only one explicitly described as astringent, while multiple later attempts at coarser settings removed that harshness even if they became too thin",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce final beverage weight from about 278g to 270g total",
      "effect": "This will increase concentration and body, helping the cup feel less thin and giving the berry jam and marzipan notes more presence",
      "reasoning": "Later coarser brews repeatedly drifted toward thin, one-note cups at roughly the same yield, so pairing a coarser grind with a slightly shorter ratio is the cleanest way to keep balance",
      "confidence": "High"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=false → new=true
- A_breaksRepeatLoop: old=false → new=true
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=25.5 → new=16.0

### Brew 5 (2026-04-07, quality=Decent)
Prev top suggestion: `Keep the same weights but switch to a gentler 4-pour: 0:00 bloom to 60g (light swirl), 0:45 to 160g, 1:15 to 220g, 1:45 ` (Medium); params changed since prev: `grindSetting, dosage, waterTemp, brewTime, finalWeight, coffeeTemperature`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was rated Decent with a short finish, muted cup, and lack of sweetness. The cup was under-extracted from a brew structure that kept producing thin, one-note results across nearby settings.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by 0.2-0.3 on the Ode Gen 2 from the baseline brew, moving from 5.0 to about 4.7-4.8",
      "effect": "This should increase sweetness, improve finish length, and give the cup more berry jam and marzipan depth",
      "reasoning": "The baseline brew tasted muted and short, and multiple nearby brews at coarser settings stayed thin and one-note, so a small move finer is the clearest way to raise extraction without changing the whole recipe",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce final beverage weight by 8-12g from the baseline brew, targeting about 270-273g instead of 281.5g",
      "effect": "This will add body, improve concentration, and make sweetness feel more present without pushing bitterness",
      "reasoning": "Thinness and short finish persisted across several attempts near the same dose, so a slightly tighter ratio is a minimal change that directly addresses dilution",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "Keep water temperature essentially unchanged at 201-202°F",
      "effect": "This will preserve clarity while letting grind and ratio do the work of improving balance",
      "reasoning": "Previous attempts already explored both 201°F and 203-204°F without a clear quality jump, so temperature does not appear to be the limiting variable here",
      "confidence": "Medium"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was rated Decent and tasted muted, lacking sweetness, with a short finish. The cup was missing concentration and depth, leaving the floral-fruit profile flat instead of balanced and rounded.",
  "primaryIssue": "under-extracted due to insufficient concentration",
  "suggestions": [
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce final weight from ~281g to 265-270g while keeping dose and pour structure the same",
      "effect": "This will increase sweetness, body, and finish length while making the rosewater, berry, and marzipan notes feel more integrated",
      "reasoning": "The baseline brew and several later attempts all stayed near the same yield yet remained thin, muted, or one-note, so changing concentration is the clearest next move instead of repeating another small grind tweak",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "Increase water temperature from 201°F to 203°F",
      "effect": "This should improve extraction of sugars and aromatics, giving a rounder cup with better sweetness and less muted character",
      "reasoning": "A later move to higher temperature was already explored alongside other changes, so this is best used here as a supporting adjustment with moderate confidence rather than the main fix",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=true → new=true
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=16.5 → new=16.0

### Brew 6 (2026-04-08, quality=Decent)
Prev top suggestion: `Grind finer by 0.3–0.5 on the Ode Gen 2 (from 5.0 to ~4.5–4.7) while keeping the same pour structure` (Medium); params changed since prev: `grindSetting, brewTime, finalWeight`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was rated Decent with one-note, thin, short-finish flavors, and it was missing sweetness, depth, and persistence in the cup. Across later attempts, both coarser grinding and a more segmented pulse structure failed to fix that flatness.",
  "primaryIssue": "under-extracted due to insufficient extraction strength and contact time",
  "suggestions": [
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce final beverage weight from ~283g to 270-275g while keeping the 20.1g dose the same",
      "effect": "This will increase concentration, improve body, and give the cup a sweeter, longer finish",
      "reasoning": "The baseline brew and later attempts all ran a relatively high yield for the dose, and the repeated thin, one-note result shows the cup needs more strength before changing more variables",
      "confidence": "High"
    },
    {
      "parameter": "Grind setting",
      "action": "Grind slightly finer from 4.7 to about 4.5 on the Ode Gen 2",
      "effect": "This should raise extraction enough to bring out more berry jam and marzipan sweetness while reducing the hollow, short finish",
      "reasoning": "Moving coarser to 5.7-6.0 did not improve the cup, and the baseline flavor notes point to needing a small move finer rather than another larger structural change",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "Keep water temperature essentially unchanged at 201-202°F",
      "effect": "This will preserve clarity and florals while letting the grind and ratio changes do the work",
      "reasoning": "Previous attempts already explored higher temperatures up to 203-204°F without resolving the thin, one-note profile, so temperature does not appear to be the limiting factor",
      "confidence": "High"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was rated Decent and tasted one-note, thin, with a short finish. It was missing sweetness, body, and length because extraction was too low for a balanced cup.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by 0.6 on the Ode Gen 2, moving from 4.7 to about 4.1",
      "effect": "This should increase sweetness, body, and finish while giving the berry jam and marzipan notes more depth",
      "reasoning": "The baseline brew was thin and short, and a later small move coarser made the cup thin and one-note again, so the next useful test is a meaningful move finer rather than another minor adjustment",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Reduce final beverage weight from about 283g to 270g while keeping the same dose and pour structure",
      "effect": "This will raise concentration and make the cup feel rounder and less watery without changing the brew method",
      "reasoning": "Across multiple attempts the coffee has repeatedly read as thin or lacking sweetness, so tightening the ratio is the clearest non-grind way to add body and intensity",
      "confidence": "High"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=true → new=false
- A_breaksRepeatLoop: old=true → new=false
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=19.5 → new=15.0

### Brew 7 (2026-04-09, quality=Decent)
Prev top suggestion: `Grind finer by 0.2–0.3 (from 4.7 to ~4.4–4.5 on the Ode Gen 2)` (Medium); params changed since prev: `brewTime, finalWeight`

**OLD prompt output:**
```json
{
  "summary": "The baseline brew was rated Decent, and nearby attempts repeatedly tasted thin, one-note, and short on sweetness. The cup was missing depth and finish because extraction stayed too low for this coffee.",
  "primaryIssue": "under-extracted due to fast flow",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by 0.3 to 0.4 on the Ode Gen 2 from the baseline brew, moving from 4.7 to about 4.3-4.4",
      "effect": "This should increase sweetness, improve body, and give the cup a longer, more layered finish",
      "reasoning": "Coarser attempts moved further toward thin and one-note, while the tighter end of your range has been the better starting point, so a small step finer is the clearest next move",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Keep the baseline pour structure but stop the brew at 270-272g instead of about 278g",
      "effect": "This will raise concentration slightly and make the cup feel rounder and less thin without changing the overall profile dramatically",
      "reasoning": "Multiple brews finished around 278-285g and still read as thin, so trimming yield is a cleaner way to add body than repeating broader recipe changes already tried",
      "confidence": "High"
    },
    {
      "parameter": "Water temperature",
      "action": "Keep temperature essentially unchanged, staying at 201-202°F",
      "effect": "This will preserve the floral and berry character while letting grind and yield do the work of improving balance",
      "reasoning": "Higher-temperature attempts did not produce a clearly better result, so temperature already appears close to optimal and should remain stable",
      "confidence": "Medium"
    }
  ]
}
```

**NEW prompt output:**
```json
{
  "summary": "The baseline brew was rated Decent and the cup lacked depth, reading as one-note with limited sweetness and structure. The cup was missing concentration and layered extraction, leaving it thin rather than balanced.",
  "primaryIssue": "under-extracted due to overly coarse grind",
  "suggestions": [
    {
      "parameter": "Grind setting",
      "action": "Grind finer by 0.6 on the Ode Gen 2, moving from 4.7 to about 4.1",
      "effect": "This should increase sweetness, body, and finish while giving the berry jam and marzipan notes more definition",
      "reasoning": "The baseline brew was thin and one-note, and moving coarser in later attempts did not improve that profile, so a meaningfully finer step is the clearest next move",
      "confidence": "High"
    },
    {
      "parameter": "Final weight / ratio",
      "action": "Keep the same dose and lower final beverage weight to 270g",
      "effect": "This will raise concentration and make the cup feel rounder and less dilute",
      "reasoning": "Across multiple attempts the brew ratio stayed near 1:14 and the cup still read thin, so a modest yield reduction directly targets the lack of body without changing the overall brew structure",
      "confidence": "Medium"
    }
  ]
}
```

Score deltas:
- A_diagnosisRefreshed: old=false → new=true
- A_breaksRepeatLoop: old=false → new=true
- A_hasMagnitude: old=true → new=true
- B_noHedges: old=true → new=true
- B_imperative: old=true → new=true
- summary mean wps: old=16.0 → new=16.5
