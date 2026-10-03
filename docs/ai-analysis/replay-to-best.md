# Replay to best brew

Generated 2026-10-03 20:22 UTC · 7 coffees · arms `old:gpt-5.4`, `new:gpt-5.4`, `new:gpt-6.1-sol`, `new:gpt-6-astra` · 2 run(s) · new-prompt effort `medium`. Re-run with `node scripts/test-replay-to-best.mjs`.

## How to read this

- **Attempts (closed loop):** each coffee starts from its real first brew. The arm's first suggestion is applied to get the next settings, and the outcome comes from the nearest real brew at those settings. Attempts counts brews, including the first, until it lands on settings that produced a brew as good as the coffee's best. Not reaching it within actual attempts + 4 counts as cap + 1. Lower is better.
- **Off-map:** the arm proposed settings more than 2× the matching tolerance from anything you brewed, so the outcome is unknown and the run stops as not reached. A high count doesn't prove the advice was bad, only that your history can't confirm it. Read it together with the open-loop columns.
- **Open loop:** at every real brew before the best one, the arm sees your actual history up to that brew. *Closer* means its first suggestion moved the settings toward the best brew, and *lands* means it reached the best brew's settings in one step. No outcome assumptions are involved.
- With this few coffees, a gap smaller than the run-to-run spread is noise.

## All coffees

| Arm | Run | Reached best | Median attempts | Actual median | Saved per coffee | Faster / slower than actual | Off-map | Holds | Open loop: closer | Open loop: farther | Open loop: lands | Cost | Avg latency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `old:gpt-5.4` | 1 | 0/7 | 10.0 | 5.0 | -5.00 | 0 / 7 | 7 | 0 | 23% | 45% | 2/22 | $0.26 | 5.3s |
| `new:gpt-5.4` | 1 | 1/7 | 10.0 | 5.0 | -4.43 | 0 / 7 | 3 | 5 | 32% | 41% | 2/22 | $1.73 | 31.4s |
| `new:gpt-6.1-sol` | 1 | 1/7 | 10.0 | 5.0 | -4.43 | 0 / 7 | 6 | 0 | 14% | 45% | 1/22 | $0.52 | 18.0s |
| `new:gpt-6-astra` | 1 | 1/7 | 10.0 | 5.0 | -4.43 | 0 / 7 | 6 | 0 | 18% | 41% | 1/22 | $2.30 | 11.3s |
| `old:gpt-5.4` | 2 | 0/7 | 10.0 | 5.0 | -5.00 | 0 / 7 | 6 | 0 | 27% | 55% | 4/22 | $0.28 | 5.0s |
| `new:gpt-5.4` | 2 | 2/7 | 8.0 | 5.0 | -3.43 | 1 / 6 | 5 | 0 | 23% | 36% | 0/22 | $1.21 | 30.1s |
| `new:gpt-6.1-sol` | 2 | 1/7 | 10.0 | 5.0 | -4.43 | 0 / 7 | 6 | 0 | 23% | 36% | 3/22 | $0.58 | 14.7s |
| `new:gpt-6-astra` | 2 | 1/7 | 10.0 | 5.0 | -4.43 | 0 / 7 | 6 | 0 | 18% | 45% | 1/22 | $2.33 | 10.7s |

## Tuning set (prompt rules were derived from these)

| Arm | Run | Reached best | Median attempts | Actual median | Saved per coffee | Faster / slower than actual | Off-map | Holds | Open loop: closer | Open loop: farther | Open loop: lands | Cost | Avg latency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `old:gpt-5.4` | 1 | 0/6 | 10.0 | 5.0 | -5.00 | 0 / 6 | 6 | 0 | 15% | 50% | 1/20 | $0.24 | 5.4s |
| `new:gpt-5.4` | 1 | 1/6 | 10.0 | 5.0 | -4.33 | 0 / 6 | 2 | 5 | 30% | 40% | 2/20 | $1.61 | 32.2s |
| `new:gpt-6.1-sol` | 1 | 1/6 | 10.0 | 5.0 | -4.33 | 0 / 6 | 5 | 0 | 10% | 45% | 1/20 | $0.44 | 17.8s |
| `new:gpt-6-astra` | 1 | 1/6 | 10.0 | 5.0 | -4.33 | 0 / 6 | 5 | 0 | 15% | 40% | 1/20 | $1.94 | 11.3s |
| `old:gpt-5.4` | 2 | 0/6 | 10.0 | 5.0 | -5.00 | 0 / 6 | 5 | 0 | 20% | 60% | 3/20 | $0.25 | 5.1s |
| `new:gpt-5.4` | 2 | 2/6 | 8.5 | 5.0 | -3.17 | 1 / 5 | 4 | 0 | 20% | 35% | 0/20 | $1.10 | 31.0s |
| `new:gpt-6.1-sol` | 2 | 1/6 | 10.0 | 5.0 | -4.33 | 0 / 6 | 5 | 0 | 20% | 35% | 3/20 | $0.49 | 14.2s |
| `new:gpt-6-astra` | 2 | 1/6 | 10.0 | 5.0 | -4.33 | 0 / 6 | 5 | 0 | 15% | 45% | 1/20 | $1.96 | 10.6s |

## Hold-out set

| Arm | Run | Reached best | Median attempts | Actual median | Saved per coffee | Faster / slower than actual | Off-map | Holds | Open loop: closer | Open loop: farther | Open loop: lands | Cost | Avg latency |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `old:gpt-5.4` | 1 | 0/1 | 8.0 | 3.0 | -5.00 | 0 / 1 | 1 | 0 | 100% | 0% | 1/2 | $0.02 | 5.2s |
| `new:gpt-5.4` | 1 | 0/1 | 8.0 | 3.0 | -5.00 | 0 / 1 | 1 | 0 | 50% | 50% | 0/2 | $0.12 | 26.6s |
| `new:gpt-6.1-sol` | 1 | 0/1 | 8.0 | 3.0 | -5.00 | 0 / 1 | 1 | 0 | 50% | 50% | 0/2 | $0.08 | 19.0s |
| `new:gpt-6-astra` | 1 | 0/1 | 8.0 | 3.0 | -5.00 | 0 / 1 | 1 | 0 | 50% | 50% | 0/2 | $0.36 | 11.2s |
| `old:gpt-5.4` | 2 | 0/1 | 8.0 | 3.0 | -5.00 | 0 / 1 | 1 | 0 | 100% | 0% | 1/2 | $0.03 | 5.0s |
| `new:gpt-5.4` | 2 | 0/1 | 8.0 | 3.0 | -5.00 | 0 / 1 | 1 | 0 | 50% | 50% | 0/2 | $0.11 | 24.8s |
| `new:gpt-6.1-sol` | 2 | 0/1 | 8.0 | 3.0 | -5.00 | 0 / 1 | 1 | 0 | 50% | 50% | 0/2 | $0.08 | 17.9s |
| `new:gpt-6-astra` | 2 | 0/1 | 8.0 | 3.0 | -5.00 | 0 / 1 | 1 | 0 | 50% | 50% | 0/2 | $0.37 | 11.7s |

## Per coffee (closed-loop attempts)

| Coffee | Set | Best | Actual | `old:gpt-5.4` | `new:gpt-5.4` | `new:gpt-6.1-sol` | `new:gpt-6-astra` |
|---|---|---|---|---|---|---|---|
| Flat Track — Banko Taratu (pour over) | tuning | Excellent | 5 | off-map / off-map | off-map / off-map | off-map / off-map | off-map / off-map |
| Frame Coffee Roasters — 4" x 6" Espresso Blend (espresso) | tuning | Decent | 2 | off-map / off-map | >6 / off-map | off-map / off-map | off-map / off-map |
| Willy’s Beans — Colombia Finca La Secreta Lychee (pour over) | tuning | Excellent | 6 | off-map / off-map | >10 / off-map | off-map / off-map | off-map / off-map |
| Greater Goods Coffee Co. — El Diviso - Java (pour over) | tuning | Excellent | 5 | off-map / off-map | off-map / off-map | off-map / off-map | off-map / off-map |
| Small Planes Coffee — Mazateca Mujeres (pour over) | tuning | Decent | 5 | off-map / off-map | >9 / 3 | off-map / off-map | off-map / off-map |
| Small Planes Coffee — Arboretum (espresso) | tuning | Decent | 3 | off-map / >7 | 4 / 4 | 4 / 4 | 4 / 4 |
| Flat Track — Xilontla Geisha (pour over) | hold-out | Decent | 3 | off-map / off-map | off-map / off-map | off-map / off-map | off-map / off-map |

Multiple runs are separated by " / ".
