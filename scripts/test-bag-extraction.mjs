#!/usr/bin/env node
/**
 * Bag-scan eval: replay saved coffees' bag photos through the extraction prompt and
 * score against what was kept. Checks that MODEL still reads bags as well as the alternatives.
 *
 * Two passes per coffee and model:
 *   with    — the coffee is in knownCoffees: does the scan snap to the saved spelling?
 *   without — the coffee (every bag of it) is removed: does it wrongly merge into a
 *             different known coffee from the same roaster?
 * Scores apply the same client backstop as AddCoffeeForm (aliases + suffix-insensitive roaster).
 *
 * Label bias: many saved names came from an accepted gpt-5.4 scan, which favors gpt-5.4.
 * If another model is within 2 coffees, review its misses by hand (printed below).
 *
 * Usage:
 *   node scripts/test-bag-extraction.mjs                         # gpt-5.4 vs gpt-6-luna
 *   node scripts/test-bag-extraction.mjs --models gpt-5.4,gpt-6-luna --max 5
 *
 * Writes docs/ai-analysis/bag-extraction-eval.md.
 */
import fs from "node:fs/promises";
import path from "node:path";
import * as P from "../supabase/functions/make-server-23508aac/brewPrompts.ts";
import { looseNameKey, looseRoasterKey, resolveCanonicalCoffee } from "../src/utils/coffeeCanonical.ts";
import { REPO_ROOT, callChat, costUsd, getByPrefix, getKey, requireEnv, supabase } from "./lib/household.mjs";
import { argValue, fmt, mapLimit } from "./lib/guidanceArms.mjs";

requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY");

const MODELS = argValue("--models", "gpt-5.4,gpt-6-luna").split(",");
const MAX = parseInt(argValue("--max", "999"), 10);
const CONCURRENCY = parseInt(argValue("--concurrency", "6"), 10);

const [users, allCoffees, roasterAliases, coffeeNameAliases] = await Promise.all([
  getByPrefix("user:"),
  getByPrefix("coffee:"),
  getKey("roaster-aliases"),
  getKey("coffee-name-aliases"),
]);
const aliases = { roasterAliases: roasterAliases || {}, coffeeNameAliases: coffeeNameAliases || {} };
const usersById = new Map(users.map((u) => [u.id, u]));
const householdOf = (userId) => usersById.get(userId)?.householdId ?? userId;
const canon = (roaster, name) => resolveCanonicalCoffee(roaster || "", name || "", aliases);
const beanKey = (c) => {
  const r = canon(c.roaster, c.name);
  return `${looseRoasterKey(r.roaster)}|${looseNameKey(r.coffeeName)}`;
};

const targets = allCoffees.filter((c) => Array.isArray(c.imageUrls) && c.imageUrls.length && c.roaster && c.name).slice(0, MAX);
console.log(`[bag-eval] ${targets.length} coffees with photos · models ${MODELS.join(", ")}\n`);

function storagePath(url) {
  const m = String(url).match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/([^?]+)/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}

async function resign(urls) {
  const out = [];
  for (const url of urls) {
    const loc = storagePath(url);
    if (!loc) {
      out.push(url);
      continue;
    }
    const { data, error } = await supabase().storage.from(loc.bucket).createSignedUrl(loc.path, 3600);
    if (error) throw new Error(`re-sign failed for ${loc.path}: ${error.message}`);
    out.push(data.signedUrl);
  }
  return out;
}

/** Household's known names, alias-resolved and de-duplicated (what AddCoffeeForm sends). */
function knownFor(target, excludeSelf) {
  const hh = householdOf(target.createdByUserId);
  const selfKey = beanKey(target);
  const coffees = new Map();
  for (const c of allCoffees) {
    if (!c.roaster || !c.name || c.id === target.id) continue;
    if (householdOf(c.createdByUserId) !== hh) continue;
    if (excludeSelf && beanKey(c) === selfKey) continue;
    const r = canon(c.roaster, c.name);
    coffees.set(`${r.normalizedRoaster}|${r.normalizedName}`, { roaster: r.roaster.trim(), name: r.coffeeName.trim() });
  }
  if (!excludeSelf) {
    const r = canon(target.roaster, target.name);
    coffees.set(`${r.normalizedRoaster}|${r.normalizedName}`, { roaster: r.roaster.trim(), name: r.coffeeName.trim() });
  }
  const list = [...coffees.values()];
  const roasters = [...new Map(list.map((c) => [looseRoasterKey(c.roaster), c.roaster])).values()];
  return { coffees: list, roasters };
}

/** Mirrors the AddCoffeeForm backstop. */
function backstop(extracted, known) {
  let roaster = (extracted.roaster || "").trim();
  let name = (extracted.name || "").trim();
  if (roaster) {
    const r = canon(roaster, name);
    roaster = r.roaster;
    name = r.coffeeName;
    const k = known.roasters.find((x) => looseRoasterKey(x) === looseRoasterKey(roaster));
    if (k) roaster = k;
  }
  if (name) {
    const k = known.coffees.find((c) => looseRoasterKey(c.roaster) === looseRoasterKey(roaster) && looseNameKey(c.name) === looseNameKey(name));
    if (k) name = k.name;
  }
  return { ...extracted, roaster, name };
}

const country = (region) => (region || "").split(/[(,]/)[0].trim().toLowerCase();

async function scan(model, target, images, known) {
  const body = P.buildChatBody(
    model,
    [
      {
        role: "user",
        content: [
          { type: "text", text: P.buildBagExtractionPrompt({ today: new Date().toISOString().slice(0, 10), knownRoasters: known.roasters, knownCoffees: known.coffees }) },
          ...images.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      },
    ],
    "low",
    { name: "coffee_bag", schema: P.BAG_EXTRACTION_SCHEMA },
  );
  const res = await callChat(body);
  return { out: backstop(JSON.parse(res.content), known), costUsd: costUsd(model, res.usage), elapsedMs: res.elapsedMs };
}

function score(target, out, known, pass) {
  const saved = canon(target.roaster, target.name);
  const got = canon(out.roaster, out.name);
  const roasterOk = looseRoasterKey(got.roaster) === looseRoasterKey(saved.roaster);
  const nameOk = roasterOk && looseNameKey(got.coffeeName) === looseNameKey(saved.coffeeName);
  const exactSpelling = out.roaster === saved.roaster.trim() && out.name === saved.coffeeName.trim();
  const falseMerge =
    pass === "without" &&
    !nameOk &&
    known.coffees.some((c) => looseRoasterKey(c.roaster) === looseRoasterKey(out.roaster) && looseNameKey(c.name) === looseNameKey(out.name));
  return {
    roasterOk,
    nameOk,
    exactSpelling,
    falseMerge,
    roastOk: target.roastLevel ? out.roastLevel === target.roastLevel : null,
    // Older saved regions put the country anywhere ("Oaxaca, Mexico"), so check containment.
    countryOk: target.region ? !!country(out.region) && target.region.toLowerCase().includes(country(out.region)) : null,
  };
}

const rows = [];
await mapLimit(targets, CONCURRENCY, async (target) => {
  let images;
  try {
    images = await resign(target.imageUrls);
  } catch (e) {
    console.error(`  skip ${target.roaster} — ${target.name}: ${e.message}`);
    return;
  }
  for (const pass of ["with", "without"]) {
    const known = knownFor(target, pass === "without");
    for (const model of MODELS) {
      try {
        const r = await scan(model, target, images, known);
        rows.push({ model, pass, coffee: `${target.roaster} — ${target.name}`, saved: target, out: r.out, ...score(target, r.out, known, pass), costUsd: r.costUsd, elapsedMs: r.elapsedMs });
      } catch (e) {
        console.error(`  ${model} ${pass} ${target.name}: ${e.message.slice(0, 200)}`);
        rows.push({ model, pass, coffee: `${target.roaster} — ${target.name}`, error: e.message });
      }
    }
  }
});

const pctOf = (xs, key) => {
  const vals = xs.map((x) => x[key]).filter((v) => v !== null && v !== undefined);
  return vals.length ? `${vals.filter(Boolean).length}/${vals.length}` : "–";
};

const lines = ["# Bag extraction eval", ""];
lines.push(
  `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${targets.length} saved coffees with photos · models ${MODELS.map((m) => `\`${m}\``).join(", ")} · reasoning \`low\` · strict JSON schema.`,
);
lines.push("");
lines.push("Scored after the AddCoffeeForm backstop (aliases plus suffix-insensitive roaster match). *Exact spelling* means it returned the saved spelling character for character.");
lines.push("");
lines.push("| Model | Pass | Roaster | Name | Exact spelling | False merges | Roast level | Country | Errors | Cost | Avg latency |");
lines.push("|---|---|---|---|---|---|---|---|---|---|---|");
for (const model of MODELS) {
  for (const pass of ["with", "without"]) {
    const xs = rows.filter((r) => r.model === model && r.pass === pass);
    const ok = xs.filter((r) => !r.error);
    lines.push(
      `| \`${model}\` | ${pass === "with" ? "coffee in known list" : "coffee removed"} | ${pctOf(ok, "roasterOk")} | ${pctOf(ok, "nameOk")} | ${pass === "with" ? pctOf(ok, "exactSpelling") : "–"} | ${pass === "without" ? ok.filter((r) => r.falseMerge).length : "–"} | ${pctOf(ok, "roastOk")} | ${pctOf(ok, "countryOk")} | ${xs.length - ok.length} | $${fmt(ok.reduce((a, r) => a + r.costUsd, 0), 3)} | ${fmt(ok.reduce((a, r) => a + r.elapsedMs, 0) / Math.max(ok.length, 1) / 1000, 1)}s |`,
    );
  }
}
lines.push("");
lines.push("## Misses (review by hand when models are close)");
lines.push("");
for (const r of rows.filter((r) => !r.error && (!r.roasterOk || !r.nameOk || r.falseMerge))) {
  lines.push(`- \`${r.model}\` (${r.pass}) saved **${r.saved.roaster} — ${r.saved.name}**, got **${r.out.roaster} — ${r.out.name}**${r.falseMerge ? " ⚠️ merged into another known coffee" : ""}`);
}
lines.push("");

const outPath = path.join(REPO_ROOT, "docs/ai-analysis/bag-extraction-eval.md");
await fs.writeFile(outPath, lines.join("\n"));
console.log(lines.filter((l) => l.startsWith("| ")).join("\n"));
console.log(`\n[bag-eval] wrote docs/ai-analysis/bag-extraction-eval.md`);
