#!/usr/bin/env node
/**
 * Pulls the last N coffees a user has brewed (default 10), reconstructs the
 * brew + AI-suggestion timeline for each, and emits:
 *
 *   docs/ai-analysis/brew-failure-modes.md  -- human-readable diagnosis
 *   scripts/fixtures/brew-sequences.json     -- machine-readable fixtures
 *
 * Required env (read from .env if present):
 *   SUPABASE_URL or VITE_SUPABASE_PROJECT_ID
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANALYZE_USER_ID (defaults to VITE_LAMARZOCCO_ALLOWED_USER_ID)
 *
 * Usage: node scripts/analyze-brew-prompts.mjs [--coffees 10]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// --- env loading ---------------------------------------------------------
async function loadDotenv() {
  try {
    const raw = await fs.readFile(path.join(REPO_ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {}
}
await loadDotenv();

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ||
  process.env.VITE_SUPABASE_PROJECT_ID;
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  (PROJECT_REF ? `https://${PROJECT_REF}.supabase.co` : null);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANALYZE_USER_ID =
  process.env.ANALYZE_USER_ID || process.env.VITE_LAMARZOCCO_ALLOWED_USER_ID;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add SUPABASE_SERVICE_ROLE_KEY to .env."
  );
  process.exit(1);
}
if (!ANALYZE_USER_ID) {
  console.error(
    "Missing ANALYZE_USER_ID (and no VITE_LAMARZOCCO_ALLOWED_USER_ID fallback)."
  );
  process.exit(1);
}

// --- args ----------------------------------------------------------------
const args = process.argv.slice(2);
const coffeesIdx = args.indexOf("--coffees");
const TOP_N = coffeesIdx >= 0 ? parseInt(args[coffeesIdx + 1], 10) || 10 : 10;

// --- main ----------------------------------------------------------------
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function getByPrefix(prefix) {
  // page through to avoid hitting default 1000-row limit
  const PAGE = 1000;
  let from = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb
      .from("kv_store_23508aac")
      .select("key,value")
      .like("key", `${prefix}%`)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function getKey(key) {
  const { data, error } = await sb
    .from("kv_store_23508aac")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value;
}

console.log(`[analyze] connecting to ${SUPABASE_URL}`);
console.log(`[analyze] target user: ${ANALYZE_USER_ID}`);

// 1. Resolve household members for the target user
const userRecord = await getKey(`user:${ANALYZE_USER_ID}`);
if (!userRecord) {
  console.error(`User ${ANALYZE_USER_ID} not found in kv_store.`);
  process.exit(1);
}
const householdId = userRecord.householdId;
let householdMemberIds = [ANALYZE_USER_ID];
if (householdId) {
  const allUsers = (await getByPrefix("user:")).map((r) => r.value);
  householdMemberIds = allUsers
    .filter((u) => u && u.id && u.householdId === householdId)
    .map((u) => u.id);
  if (!householdMemberIds.includes(ANALYZE_USER_ID))
    householdMemberIds.push(ANALYZE_USER_ID);
}
console.log(
  `[analyze] household members (${householdMemberIds.length}): ${householdMemberIds.join(", ")}`
);

// 2. Pull all coffees and brews; filter to household
const [coffeeRows, brewRows] = await Promise.all([
  getByPrefix("coffee:"),
  getByPrefix("brew:"),
]);

const allCoffees = coffeeRows.map((r) => r.value).filter(Boolean);
const allBrews = brewRows.map((r) => r.value).filter(Boolean);

const householdSet = new Set(householdMemberIds);
// Coffee ownership is loose (`createdByUserId` only); a coffee is "the user's"
// if anyone in their household has brewed it.
const brews = allBrews.filter((b) => b && householdSet.has(b.userId));
const coffeesById = new Map(allCoffees.filter((c) => c && c.id).map((c) => [c.id, c]));

console.log(
  `[analyze] brews in household: ${brews.length}; coffees in catalog: ${coffeesById.size}`
);

// 3. Group brews by coffeeId, sort coffees by most-recent brew
const brewsByCoffee = new Map();
for (const b of brews) {
  if (!b.coffeeId) continue;
  if (!brewsByCoffee.has(b.coffeeId)) brewsByCoffee.set(b.coffeeId, []);
  brewsByCoffee.get(b.coffeeId).push(b);
}
for (const arr of brewsByCoffee.values()) {
  arr.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ); // chronological
}

const coffeesWithBrews = [...brewsByCoffee.entries()]
  .map(([coffeeId, cb]) => {
    const coffee =
      coffeesById.get(coffeeId) ||
      // fallback: synthesize from brew metadata if coffee record is gone
      {
        id: coffeeId,
        name: cb[0]?.coffeeName || "(unknown)",
        roaster: cb[0]?.roaster || "(unknown)",
        notes: undefined,
        region: undefined,
        roastLevel: undefined,
      };
    const last = cb[cb.length - 1];
    return { coffee, brews: cb, lastBrewAt: new Date(last.createdAt).getTime() };
  })
  .sort((a, b) => b.lastBrewAt - a.lastBrewAt)
  .slice(0, TOP_N);

console.log(`[analyze] selected ${coffeesWithBrews.length} most-recent coffees`);

// --- 4. Build per-brew analysis ------------------------------------------

const PARAM_KEYS = [
  "grindSetting",
  "dosage",
  "waterTemp",
  "brewTime",
  "finalWeight",
  "coffeeTemperature",
];

function paramSnapshot(b) {
  const o = {};
  for (const k of PARAM_KEYS) o[k] = b[k];
  return o;
}

function paramDiff(prev, curr) {
  const changed = {};
  for (const k of PARAM_KEYS) {
    if (prev[k] !== curr[k]) changed[k] = { from: prev[k], to: curr[k] };
  }
  return changed;
}

// normalize a parameter name from the suggestion (free-form) to one of our keys
function normalizeParameter(label) {
  if (!label) return null;
  const s = label.toLowerCase();
  if (s.includes("grind")) return "grindSetting";
  if (s.includes("dose") || s.includes("dosage")) return "dosage";
  if (s.includes("water") && s.includes("temp")) return "waterTemp";
  if (s.includes("temperature")) return "waterTemp";
  if (s.includes("ratio") || s.includes("yield") || s.includes("final weight") || s.includes("output"))
    return "finalWeight";
  if (s.includes("time") || s.includes("steep") || s.includes("extraction time"))
    return "brewTime";
  if (s.includes("bean") && s.includes("temp")) return "coffeeTemperature";
  if (s.includes("pour") || s.includes("bloom")) return "stages";
  return null;
}

// extract direction from action text ("Grind finer", "Increase yield", "Reduce final weight")
function extractDirection(action) {
  if (!action) return null;
  const s = action.toLowerCase();
  if (/(finer|smaller|decrease|reduce|lower|down|less|tight)/.test(s)) return "down";
  if (/(coarser|larger|increase|raise|higher|up|more|loose|extend|longer)/.test(s)) return "up";
  return null;
}

function qualityLabel(q) {
  return q === 3 ? "Excellent" : q === 2 ? "Decent" : q === 1 ? "Bad" : "Unrated";
}

// --- 5. Walk timelines and detect failure modes --------------------------

const failureModes = {
  repeatedGuidance: [], // same (param, direction) suggested across consecutive brews despite being followed
  ignoredHighConfidence: [], // High-confidence top suggestion not adopted in next brew
  followedButRegressed: [], // suggestion followed, next brew quality dropped
  followedNoChange: [], // suggestion followed, next brew quality flat (no improvement)
  staleDiagnosis: [], // primaryIssue identical across consecutive brews despite param changes
  vagueAdvice: [], // suggestion.action lacks any number (no magnitude)
};

const fixtures = [];

const reportLines = [];
reportLines.push("# Brew Failure Mode Analysis");
reportLines.push("");
reportLines.push(
  `Generated ${new Date().toISOString()} from ${coffeesWithBrews.length} coffees / ${brews.length} brews for user \`${ANALYZE_USER_ID}\`.`
);
reportLines.push("");

for (const { coffee, brews: cb } of coffeesWithBrews) {
  reportLines.push(`## ${coffee.roaster || "Unknown"} — ${coffee.name || coffee.id}`);
  reportLines.push("");
  reportLines.push(
    `Brew method: ${cb[0]?.brewMethod || "?"} · brews: ${cb.length} · last brew: ${new Date(cb[cb.length - 1].createdAt).toISOString().slice(0, 10)}`
  );
  reportLines.push("");

  const fixtureSeq = {
    coffeeId: coffee.id,
    coffee: {
      name: coffee.name,
      roaster: coffee.roaster,
      region: coffee.region,
      roastLevel: coffee.roastLevel,
      notes: coffee.notes,
    },
    brews: cb.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      brewMethod: b.brewMethod,
      brewerName: b.brewerName,
      grinderName: b.grinderName,
      coffeeTemperature: b.coffeeTemperature,
      grindSetting: b.grindSetting,
      dosage: b.dosage,
      waterTemp: b.waterTemp,
      brewTime: b.brewTime,
      finalWeight: b.finalWeight,
      stages: b.stages,
      quality: b.quality,
      tastingNotes: b.tastingNotes,
      personalNotes: b.personalNotes || b.notes,
      suggestion: b.suggestion || null,
    })),
  };
  fixtures.push(fixtureSeq);

  // table
  reportLines.push(
    "| # | Date | Quality | Grind | Dose | Yield | Time | WaterT | Top suggestion | Followed? | Δ next quality |"
  );
  reportLines.push(
    "|---|------|---------|-------|------|-------|------|--------|----------------|-----------|----------------|"
  );

  for (let i = 0; i < cb.length; i++) {
    const brew = cb[i];
    const next = cb[i + 1];
    const top = brew.suggestion?.full?.suggestions?.[0];
    const topAction = top?.action || "—";
    const topConf = top?.confidence || "";
    const topParam = normalizeParameter(top?.parameter || top?.action);
    const topDir = extractDirection(top?.action);

    let followed = "";
    let qualityDelta = "";
    if (next) {
      const diff = paramDiff(paramSnapshot(brew), paramSnapshot(next));
      if (topParam && diff[topParam]) {
        const from = Number(diff[topParam].from);
        const to = Number(diff[topParam].to);
        const movedDir = !isFinite(from) || !isFinite(to)
          ? null
          : to < from
          ? "down"
          : to > from
          ? "up"
          : null;
        if (topDir && movedDir && topDir === movedDir) followed = "yes";
        else if (movedDir) followed = "wrong-dir";
        else followed = "no-change";
      } else {
        followed = top ? "no" : "—";
      }

      if (brew.quality && next.quality) {
        if (next.quality > brew.quality) qualityDelta = `+${next.quality - brew.quality}`;
        else if (next.quality < brew.quality) qualityDelta = `${next.quality - brew.quality}`;
        else qualityDelta = "0";
      }
    }

    reportLines.push(
      `| ${i + 1} | ${new Date(brew.createdAt).toISOString().slice(0, 10)} | ${qualityLabel(brew.quality)} | ${brew.grindSetting ?? ""} | ${brew.dosage ?? ""}g | ${brew.finalWeight ?? ""}g | ${brew.brewTime ?? ""}s | ${brew.waterTemp ?? ""} | ${(topAction || "").replace(/\|/g, "\\|").slice(0, 80)} (${topConf}) | ${followed} | ${qualityDelta} |`
    );

    // failure-mode detection (look at this brew's suggestion & next brew's outcome)
    if (top) {
      // vague advice: no number in action
      if (!/\d/.test(top.action || "")) {
        failureModes.vagueAdvice.push({
          coffee: `${coffee.roaster}/${coffee.name}`,
          brewId: brew.id,
          action: top.action,
        });
      }

      if (next) {
        const diff = paramDiff(paramSnapshot(brew), paramSnapshot(next));
        const wasFollowed = topParam && diff[topParam] != null;

        if (wasFollowed && brew.quality && next.quality) {
          if (next.quality < brew.quality) {
            failureModes.followedButRegressed.push({
              coffee: `${coffee.roaster}/${coffee.name}`,
              brewId: brew.id,
              suggestion: top.action,
              from: brew.quality,
              to: next.quality,
            });
          } else if (next.quality === brew.quality && brew.quality < 3) {
            failureModes.followedNoChange.push({
              coffee: `${coffee.roaster}/${coffee.name}`,
              brewId: brew.id,
              suggestion: top.action,
              quality: brew.quality,
            });
          }
        }

        if (top.confidence === "High" && !wasFollowed) {
          failureModes.ignoredHighConfidence.push({
            coffee: `${coffee.roaster}/${coffee.name}`,
            brewId: brew.id,
            suggestion: top.action,
          });
        }

        // repeated guidance: this brew suggested (param, dir); was that the same suggestion the previous brew had AND was that one followed?
        const prev = cb[i - 1];
        const prevTop = prev?.suggestion?.full?.suggestions?.[0];
        const prevParam = normalizeParameter(prevTop?.parameter || prevTop?.action);
        const prevDir = extractDirection(prevTop?.action);
        if (prevTop && prevParam && prevDir && prevParam === topParam && prevDir === topDir) {
          // was prev's suggestion followed (i.e., did current brew change that param in that dir)?
          const prevDiff = paramDiff(paramSnapshot(prev), paramSnapshot(brew));
          let prevFollowed = false;
          if (prevDiff[prevParam]) {
            const from = Number(prevDiff[prevParam].from);
            const to = Number(prevDiff[prevParam].to);
            const moved = !isFinite(from) || !isFinite(to)
              ? null
              : to < from
              ? "down"
              : to > from
              ? "up"
              : null;
            if (moved === prevDir) prevFollowed = true;
          }
          if (prevFollowed) {
            failureModes.repeatedGuidance.push({
              coffee: `${coffee.roaster}/${coffee.name}`,
              prevBrewId: prev.id,
              currBrewId: brew.id,
              parameter: topParam,
              direction: topDir,
              actionPrev: prevTop.action,
              actionCurr: top.action,
            });
          }
        }
      }

      // stale diagnosis: primaryIssue same as previous brew's, despite params changed
      const prev = cb[i - 1];
      const prevPI = prev?.suggestion?.full?.primaryIssue;
      const currPI = brew.suggestion?.full?.primaryIssue;
      if (prev && prevPI && currPI && prevPI === currPI) {
        const diff = paramDiff(paramSnapshot(prev), paramSnapshot(brew));
        if (Object.keys(diff).length > 0) {
          failureModes.staleDiagnosis.push({
            coffee: `${coffee.roaster}/${coffee.name}`,
            prevBrewId: prev.id,
            currBrewId: brew.id,
            primaryIssue: currPI,
            paramsChanged: Object.keys(diff),
          });
        }
      }
    }
  }
  reportLines.push("");
}

// --- 6. Summary section --------------------------------------------------

const headerLines = [
  "# Brew Failure Mode Analysis",
  "",
  `Generated ${new Date().toISOString()} from ${coffeesWithBrews.length} coffees / ${brews.length} brews for user \`${ANALYZE_USER_ID}\`.`,
  "",
  "## Patterns at a glance",
  "",
  `Failure-mode counts (across ${coffeesWithBrews.length} coffees):`,
  "",
  ...Object.entries(failureModes).map(([k, v]) => `- **${k}**: ${v.length}`),
  "",
];
// strip the original (out-of-order) header that was pushed at the start
const origHeaderIdx = reportLines.findIndex((l) => l.startsWith("# Brew Failure Mode Analysis"));
if (origHeaderIdx >= 0) reportLines.splice(0, origHeaderIdx + 3); // header + blank + "Generated..." line
reportLines.unshift(...headerLines);

// detailed diagnosis section
reportLines.push("---");
reportLines.push("");
reportLines.push("## Diagnosis");
reportLines.push("");
reportLines.push(
  "Each subsection lists every occurrence found. Step 4 will derive prompt edits **only** from non-empty modes here."
);
reportLines.push("");

for (const [mode, items] of Object.entries(failureModes)) {
  reportLines.push(`### ${mode} (${items.length})`);
  reportLines.push("");
  if (items.length === 0) {
    reportLines.push("_No occurrences in dataset — no prompt change needed for this mode._");
    reportLines.push("");
    continue;
  }
  for (const it of items.slice(0, 20)) {
    reportLines.push("- " + JSON.stringify(it));
  }
  if (items.length > 20)
    reportLines.push(`- _…and ${items.length - 20} more_`);
  reportLines.push("");
}

// --- 7. Write outputs ----------------------------------------------------

const outDir = path.join(REPO_ROOT, "docs", "ai-analysis");
await fs.mkdir(outDir, { recursive: true });
const reportPath = path.join(outDir, "brew-failure-modes.md");
await fs.writeFile(reportPath, reportLines.join("\n"));

const fixturesDir = path.join(REPO_ROOT, "scripts", "fixtures");
await fs.mkdir(fixturesDir, { recursive: true });
const fixturesPath = path.join(fixturesDir, "brew-sequences.json");
await fs.writeFile(fixturesPath, JSON.stringify(fixtures, null, 2));

console.log(`[analyze] wrote ${reportPath}`);
console.log(`[analyze] wrote ${fixturesPath}`);
console.log("[analyze] failure-mode counts:");
for (const [k, v] of Object.entries(failureModes)) {
  console.log(`  - ${k}: ${v.length}`);
}
