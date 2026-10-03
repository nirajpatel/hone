# Prompt and model eval v2

October 3, 2026. Compares the pre-overhaul guidance (old prompt on gpt-5.4, as in production before this change) against the new context builder (history, tried settings, brewer preferences, similar-bean references) on gpt-5.4, gpt-6.1-sol and gpt-6-astra. Each arm ran twice. Detailed tables are in the linked reports.

## Decisions

| Setting | Choice | Why |
|---|---|---|
| `MODEL` (guidance, bag scan) | `gpt-6.1-sol` | Highest improvement score (97.3, run spread 0.3), the only arms besides Astra that follow hold-once, a fifth of Astra's cost. Astra (96.5) overlaps within the spread, so [blind-review.md](blind-review.md) is open for a final call. Sol also beat gpt-5.4 on new-coffee bag scans (section 4) at ~1s more latency. |
| `LOOKUP_MODEL` | `gpt-5.4`, reasoning `none` | Same answers as Sol (section 5) in about half the time. The form runs up to three lookups at once and waits on the slowest: ~7–9s on gpt-5.4 vs 13–18s on Sol, which only supports `low` and up. |
| Retry | same model | Guidance: on timeout (60s background, 25s on-demand) or error, one retry at `low` with a 30s timeout. Bag scans, lookups and the legacy path: one retry after a network error, 429 or 5xx. Never a second model. |
| History length | 15 rows | 7 vs 15 rows on gpt-5.4 scored 86.6 vs 85.2, inside the noise. 15 is kept per the plan, since the tried-settings list and profile already use the full history. |

Sol latency on real prompts: 10–17s at `low` (on-demand) and 12–27s at `medium` (background), both inside their timeouts.

## 1. Improvement guidance ([prompt-eval-models.md](prompt-eval-models.md))

40 real brews cut from history (20 tuning coffees the rules were derived from, 20 hold-out). Score is the mean pass rate over checks with n ≥ 3.

| Arm | Score | Run spread | Hold once (n=6) | Never hold twice (n=7) | Breaks repeat loop | Avg latency | Cost per 40 |
|---|---|---|---|---|---|---|---|
| old prompt, gpt-5.4 | 79.9 | 4.4 | 0% | 100% | 50–61% | 5s | $0.25 |
| new prompt, gpt-5.4 | 85.2 | 0.9 | 0% | 100% | 82–89% | 44s | $1.59 |
| new prompt, gpt-5.4, 7 rows | 86.6 | 0.2 | 0% | 100% | 86–87% | 43s | $1.55 |
| new prompt, gpt-6.1-sol | **97.3** | 0.3 | 83% | 100% | 100% | 16s | $0.48 |
| new prompt, gpt-6-astra | 96.5 | 1.9 | 83% | 86–100% | 100% | 12s | $2.35 |

- The new prompt fixes the stale-diagnosis and repeat-loop failures on every model. It avoids consistently-Bad settings in 94–100% of cases, against 81–94% for the old prompt.
- Hold-once is model-dependent. gpt-5.4 always nudges a setting after a single Bad cup, even with the rule in the prompt; Sol and Astra repeat the known-good settings.
- Every `basis` date the new prompt cited was in the prompt (pre-filter), so the production filter rarely has anything to drop.
- The first scorer run counted temperature moves, sub-tolerance yield nudges and puck-prep advice as holds. That made "never hold twice" look broken for the new prompt. The scorer was fixed and the saved outputs re-scored (`--rescore`); the numbers above are the corrected ones.

## 2. Replay to best brew ([replay-to-best.md](replay-to-best.md))

The repeatable efficiency test: start each coffee from its real first brew, apply each arm's first suggestion, take the outcome from the nearest real brew at those settings, and count attempts until it reaches settings that produced a brew as good as the best. 7 coffees qualify (best brew not the first, at least 3 brews on one setup).

| Arm | Reached best (2 runs) | Went off-map | Open loop: moved closer to best |
|---|---|---|---|
| old prompt, gpt-5.4 | 0/14 | 13/14 | 25% |
| new prompt, gpt-5.4 | 3/14 | 8/14 | 27% |
| new prompt, gpt-6.1-sol | 2/14 | 12/14 | 18% |
| new prompt, gpt-6-astra | 2/14 | 12/14 | 18% |

- **What it shows:** the new prompt reached a best-quality brew in replay where the old one never did. Sol, Astra and gpt-5.4 all reach Arboretum in 4 attempts vs 3 actual, and gpt-5.4 reached Mazateca Mujeres in 3 vs 5 actual in one of its two runs (the only replay faster than your real path).
- **What it can't show yet:** most runs go off-map. The guidance proposes settings nobody brewed, so the outcome is unknown and the run stops. The old prompt usually goes off-map on its first suggestion. With 7 coffees, the differences between new-prompt models are inside the noise.
- **Why moving closer is low for everyone:** your path to the best brew often involved something the model can't change. Banko Taratu's first Excellent came after switching to frozen beans; both prompts reasonably suggested going coarser after "Burnt, Bitter".
- **Use it going forward** as a regression check when prompts or models change: `node scripts/test-replay-to-best.mjs --arms old:gpt-5.4,new:gpt-6.1-sol --runs 2`. It gets more informative as history grows: more coffees qualify, and more settings have known outcomes.

## 3. First brew ([first-brew-eval.md](first-brew-eval.md))

15 coffees, own brews hidden, references limited to coffees brewed before the coffee's first brew. Lower distance to the actual best brew is better. This is a directional check.

| Arm | Median grind error (grinder tolerances) | Median ratio error | Composite (run 1 / run 2) | Closer than old |
|---|---|---|---|---|
| old prompt, gpt-5.4 | 5.6 / 4.6 | 0.34 | 10.8 / 9.5 | – |
| new prompt, gpt-5.4 | 4.1 / 4.6 | 0.27 | 7.8 / 7.8 | 9/15, 8/15 |
| new prompt, gpt-6.1-sol | 4.5 / 4.5 | 0.55–0.70 | 9.4 / 9.0 | 8/15, 7/15 |
| new prompt, gpt-6-astra | 4.5 / 4.5 | 0.27–0.65 | 8.0 / 8.0 | 11/15, 9/15 |

- References help on every model. The biggest wins are espresso coffees with prior Niche Zero shots: Peru Cajamara went from a 14–16 grind to 19, against an actual best of 19.
- Sol is the weakest of the three new arms here, mostly on ratio: it lengthens the ratio toward the brewer's typical range more than the best brews did. It's still closer than the old prompt. If first brews matter more than dial-in, a separate first-brew model (gpt-5.4 or Astra) is a one-line change.

## 4. Bag scans ([bag-extraction-eval.md](bag-extraction-eval.md))

29 saved coffees with photos, re-signed and replayed with the new extraction prompt (known roasters and coffees, region and roast rules, strict schema).

| Model | Pass | Roaster | Name | Exact saved spelling | False merges | Cost |
|---|---|---|---|---|---|---|
| gpt-5.4 | coffee in known list | 29/29 | 29/29 | 29/29 | – | $0.20 |
| gpt-5.4 | coffee removed | 28/29 | 22/29 | – | 0 | $0.20 |
| gpt-6-luna | coffee in known list | 29/29 | 28/29 | 28/29 | – | $0.05 |
| gpt-6-luna | coffee removed | 22/29 | 20/29 | – | 0 | $0.05 |
| gpt-6.1-sol | coffee in known list | 29/29 | 29/29 | 29/29 | – | $1.04 |
| gpt-6.1-sol | coffee removed | 28/29 | 26/29 | – | 0 | $1.04 |

gpt-5.4 and Sol were re-run together (gpt-5.4 scored 23/29 on names that run); the Luna rows are from the first run. The linked report holds the latest run only.

- No model merged a new coffee into a different known one.
- Sol is the best at new coffees (26/29 names vs 23/29). Its misses are a dropped "(Washed)"-style suffix and an extra "Blend"/"Signature", not wrong coffees. It costs about 3.6¢ per scan vs 0.7¢, with similar latency (~4.5s).
- Roast level scores are low for every model (4–5 of 23) because most saved roast levels came from the web lookup, not the bag; the prompt now returns empty rather than guessing.

## 5. Coffee lookup (web search)

8 saved coffees, region and tasting-notes lookups with the production prompts. Overlap is the share of words matching what you saved.

| Model | Effort | Median latency | Worst | Searches | Region overlap | Notes overlap | Notes UNKNOWN |
|---|---|---|---|---|---|---|---|
| gpt-5.4 | `none` | 4.6–5.9s | 8.9s | 1.5–1.8 | 0.88 | 0.70 | 1/8 |
| gpt-6.1-sol | `low` | 7.2–8.3s | 17.8s | 2.6 | 0.88 | 0.72 | 2/8 |

Same answers on region (both got the decaf blend wrong in the same way); Sol is about 3s slower per lookup, so lookups stay on gpt-5.4.

## Caveats

- The scorers are wording heuristics tuned on gpt-5.4 output, and several checks have n of 6–16.
- Many saved coffee names came from accepted gpt-5.4 scans, which favors gpt-5.4 in the bag eval.
- The replay only knows outcomes where you brewed; off-map is "unknown", not "wrong".

## Re-running

```bash
node scripts/test-brew-prompt.mjs --arms old:gpt-5.4,new:gpt-6.1-sol,new:gpt-6-astra --runs 2
node scripts/test-brew-prompt.mjs --rescore docs/ai-analysis/prompt-eval-models.json   # after changing a scorer
node scripts/test-replay-to-best.mjs --arms old:gpt-5.4,new:gpt-6.1-sol --runs 2
node scripts/test-first-brew.mjs --arms old:gpt-5.4,new:gpt-6.1-sol
node scripts/test-bag-extraction.mjs --models gpt-5.4,gpt-6.1-sol
```
