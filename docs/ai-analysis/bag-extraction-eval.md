# Bag extraction eval

Generated 2026-10-03 20:52 UTC · 29 saved coffees with photos · models `gpt-5.4`, `gpt-6.1-sol` · reasoning `low` · strict JSON schema.

Scored after the AddCoffeeForm backstop (aliases plus suffix-insensitive roaster match). *Exact spelling* means it returned the saved spelling character for character.

| Model | Pass | Roaster | Name | Exact spelling | False merges | Roast level | Country | Errors | Cost | Avg latency |
|---|---|---|---|---|---|---|---|---|---|---|
| `gpt-5.4` | coffee in known list | 29/29 | 29/29 | 29/29 | – | 5/23 | 16/25 | 0 | $0.201 | 3.8s |
| `gpt-5.4` | coffee removed | 28/29 | 23/29 | – | 0 | 5/23 | 16/25 | 0 | $0.201 | 3.3s |
| `gpt-6.1-sol` | coffee in known list | 29/29 | 29/29 | 29/29 | – | 5/23 | 16/25 | 0 | $1.039 | 4.5s |
| `gpt-6.1-sol` | coffee removed | 28/29 | 26/29 | – | 0 | 5/23 | 16/25 | 0 | $1.038 | 4.4s |

## Misses (review by hand when models are close)

- `gpt-5.4` (without) saved **Flat Track — Peru Cajamara (Washed)**, got **Flat Track — Peru Cajamara**
- `gpt-5.4` (without) saved **Kirkland — Colombian Supremo**, got **Kirkland Signature — Colombian Supremo**
- `gpt-5.4` (without) saved **Cuvée Coffee — Emporium Medium House Blend**, got **Cuvée Coffee — Emporium**
- `gpt-6.1-sol` (without) saved **Kirkland — Colombian Supremo**, got **Kirkland Signature — Colombian Supremo**
- `gpt-5.4` (without) saved **Palomino Coffee — 1st Rodeo**, got **Palomino Coffee — Strodeo**
- `gpt-6.1-sol` (without) saved **Cuvée Coffee — Emporium Medium House Blend**, got **CUVÉE COFFEE — EMPORIUM**
- `gpt-5.4` (without) saved **Spokesman — Bad Kids**, got **Spokesman Coffee — Texas Bad Kids**
- `gpt-5.4` (without) saved **Cambraia — Brazil Minas Mountains**, got **Cambraia — Brazil Minas Mountains Blend**
- `gpt-6.1-sol` (without) saved **Cambraia — Brazil Minas Mountains**, got **CAMBRAIA — Brazil Minas Mountains Blend**
