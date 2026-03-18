/**
 * Shared logic for normalizing and canonicalizing coffee (roaster + name) for
 * grouping, cache keys, and API calls. Used by CoffeeBagImageFlow, CoffeesShelvesView,
 * and brew nav so "same coffee" is consistent across aliases and case/whitespace.
 */

export interface CoffeeAliases {
  roasterAliases: Record<string, string>;
  coffeeNameAliases: Record<string, string>;
}

export interface ResolvedCoffee {
  /** Canonical roaster (original case) — for display */
  roaster: string;
  /** Canonical coffee name (original case) — for display */
  coffeeName: string;
  /** Normalized roaster — for cache keys and API */
  normalizedRoaster: string;
  /** Normalized coffee name — for cache keys and API */
  normalizedName: string;
}

/** Case- and whitespace-insensitive string for matching and keys. */
export function normalizeCoffeeKey(s: string): string {
  return (s || '').trim().toLowerCase();
}

/**
 * Resolve (roaster, name) to canonical values using alias maps, then normalize for keys.
 * Alias lookups are case- and whitespace-insensitive.
 */
export function resolveCanonicalCoffee(
  roaster: string,
  name: string,
  aliases: CoffeeAliases
): ResolvedCoffee {
  const norm = normalizeCoffeeKey;
  const ra = aliases.roasterAliases;
  const cna = aliases.coffeeNameAliases;
  const normR = norm(roaster);
  let canonicalRoaster = roaster;
  for (const [variant, canonical] of Object.entries(ra)) {
    if (norm(variant) === normR) {
      canonicalRoaster = canonical;
      break;
    }
  }
  const normCoffeeKeyStr = `${norm(canonicalRoaster)}|${norm(name)}`;
  let canonicalCoffeeName = name;
  for (const [variantKey, canonicalValue] of Object.entries(cna)) {
    const [kr, kn] = variantKey.split('|');
    if (`${norm(kr)}|${norm(kn)}` === normCoffeeKeyStr) {
      canonicalCoffeeName = canonicalValue.split('|')[1] ?? name;
      break;
    }
  }
  return {
    roaster: canonicalRoaster,
    coffeeName: canonicalCoffeeName,
    normalizedRoaster: norm(canonicalRoaster),
    normalizedName: norm(canonicalCoffeeName),
  };
}

/** Stable key for grouping / cache: normalized canonical roaster and coffee name. */
export function canonicalCoffeeKey(
  roaster: string,
  name: string,
  aliases: CoffeeAliases
): string {
  const r = resolveCanonicalCoffee(roaster, name, aliases);
  return `${r.normalizedRoaster}|${r.normalizedName}`;
}
