# First-brew eval

Generated 2026-10-03 20:18 UTC · 15 coffees · 2 run(s) · new-prompt effort `low`. Directional check, not a ship gate: the best brew is only roughly the right start.

Median absolute distance from each coffee's best brew. Grind is in grinder tolerances (5% of that grinder's range across your brews). Lower is better.

| Arm | Run | Grind (tol) | Ratio | Time (s) | Temp (°F) | Composite | Closer than old | Errors |
|---|---|---|---|---|---|---|---|---|
| `old:gpt-5.4` | 1 | 5.6 | 0.34 | 5.0 | 1.1 | 10.8 | – | 0 |
| `new:gpt-5.4` | 1 | 4.1 | 0.27 | 5.0 | 1.9 | 7.8 | 9/15 | 0 |
| `new:gpt-6.1-sol` | 1 | 4.5 | 0.70 | 10.0 | 2.0 | 9.4 | 8/15 | 0 |
| `new:gpt-6-astra` | 1 | 4.5 | 0.27 | 10.0 | 1.5 | 8.0 | 11/15 | 0 |
| `old:gpt-5.4` | 2 | 4.6 | 0.34 | 5.0 | 1.1 | 9.5 | – | 0 |
| `new:gpt-5.4` | 2 | 4.6 | 0.27 | 10.0 | 1.9 | 7.8 | 8/15 | 0 |
| `new:gpt-6.1-sol` | 2 | 4.5 | 0.55 | 10.0 | 2.0 | 9.0 | 7/15 | 0 |
| `new:gpt-6-astra` | 2 | 4.5 | 0.65 | 10.0 | 1.9 | 8.0 | 9/15 | 0 |

## Per coffee (grind suggested vs best)

| Coffee | Set | Best grind | `old:gpt-5.4` | `new:gpt-5.4` | `new:gpt-6.1-sol` | `new:gpt-6-astra` |
|---|---|---|---|---|---|---|
| Maru Coffee — Ethiopia Wuri (pour over) | tuning | 6.3 | 5.20 / 5.20 | 5.20 / 5.20 | 5.00 / 5.00 | 5.00 / 5.00 |
| Glitch Coffee & Roasters — El Paraiso (Lychee) (pour over) | hold-out | 6.0 | 6.20 / 6.20 | 7.75 / 7.75 | 7.50 / 7.50 | 7.00 / 7.00 |
| Desnudo Coffee — Colombia (espresso) | hold-out | 18.25 | 16.00 / 17.00 | 20.40 / 20.40 | 20.10 / 20.10 | 20.10 / 20.10 |
| Maru Coffee — Santo Blend (espresso) | hold-out | 18 | 18.00 / 18.00 | 18.50 / 18.50 | 18.25 / 18.25 | 18.25 / 18.25 |
| Flat Track — Peru Cajamara (Washed) (espresso) | tuning | 19 | 14.00 / 16.00 | 19.00 / 18.80 | 20.10 / 20.10 | 20.10 / 20.10 |
| Flat Track — Banko Taratu (pour over) | tuning | 5.7 | 5.20 / 5.20 | 6.80 / 6.80 | 6.00 / 6.50 | 6.00 / 6.00 |
| Frame Coffee Roasters — 4" x 6" Espresso Blend (espresso) | tuning | 24 | 16.00 / 18.00 | 18.80 / 18.40 | 18.60 / 19.00 | 18.60 / 18.60 |
| Palomino Coffee — 1st Rodeo (espresso) | tuning | 20.1 | 14.00 / 17.00 | 14.00 / 16.00 | 15.00 / 15.00 | 15.00 / 15.00 |
| Willy’s Beans — Colombia Finca La Secreta Lychee (pour over) | tuning | 5.0 | 6.20 / 5.20 | 5.80 / 5.80 | 5.70 / 5.70 | 5.70 / 5.70 |
| Greater Goods Coffee Co. — El Diviso - Java (pour over) | tuning | 6.3 | 5.20 / 5.20 | 5.80 / 5.80 | 5.70 / 5.70 | 5.70 / 5.70 |
| Small Planes Coffee — Mazateca Mujeres (pour over) | tuning | 5.0 | 5.20 / 5.20 | 5.40 / 5.40 | 5.00 / 5.00 | 5.00 / 5.00 |
| Small Planes Coffee — Arboretum (espresso) | tuning | 22 | 17.00 / 16.00 | 20.50 / 20.50 | 20.00 / 20.00 | 19.50 / 19.50 |
| Flat Track — Xilontla Geisha (pour over) | hold-out | 4.3 | 6.20 / 6.20 | 6.40 / 6.20 | 6.30 / 6.30 | 6.30 / 6.30 |
| Ondo Coffee Co — Suica 3.0 (pour over) | hold-out | 5.3 | 6.20 / 6.20 | 5.20 / 5.20 | 5.70 / 5.70 | 5.30 / 5.30 |
| Stereoscope — Las Flores - Java (pour over) | hold-out | 5.2 | 5.20 / 5.20 | 5.80 / 6.10 | 6.30 / 6.30 | 6.30 / 6.30 |
