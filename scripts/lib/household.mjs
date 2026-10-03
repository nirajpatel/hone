/**
 * Shared helpers for the brew-guidance scripts: .env loading, Supabase KV
 * access, household data loading and OpenAI calls.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function loadDotenv() {
  try {
    const raw = await fs.readFile(path.join(REPO_ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}
await loadDotenv();

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || process.env.VITE_SUPABASE_PROJECT_ID;
export const SUPABASE_URL = process.env.SUPABASE_URL || (PROJECT_REF ? `https://${PROJECT_REF}.supabase.co` : null);
export const OPENAI_KEY = process.env.OPENAI_API_KEY;
export const ANALYZE_USER_ID = process.env.ANALYZE_USER_ID || process.env.VITE_LAMARZOCCO_ALLOWED_USER_ID;

export function requireEnv(...names) {
  const values = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY: OPENAI_KEY, ANALYZE_USER_ID };
  const missing = names.filter((n) => !values[n]);
  if (missing.length) {
    console.error(`Missing ${missing.join(", ")} in .env.`);
    process.exit(1);
  }
}

let client;
export function supabase() {
  client ??= createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return client;
}

export async function getByPrefix(prefix) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase()
      .from("kv_store_23508aac")
      .select("key,value")
      .like("key", `${prefix}%`)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return all.map((r) => r.value).filter(Boolean);
}

export async function getKey(key) {
  const { data, error } = await supabase().from("kv_store_23508aac").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value;
}

export async function setKey(key, value) {
  const { error } = await supabase().from("kv_store_23508aac").upsert({ key, value });
  if (error) throw error;
}

/** Household members, their brews, all coffees and alias maps for one user. */
export async function loadHousehold(userId = ANALYZE_USER_ID) {
  const [users, coffees, brews, roasterAliases, coffeeNameAliases, grinderProfiles] = await Promise.all([
    getByPrefix("user:"),
    getByPrefix("coffee:"),
    getByPrefix("brew:"),
    getKey("roaster-aliases"),
    getKey("coffee-name-aliases"),
    getByPrefix("grinder-profile:"),
  ]);
  const me = users.find((u) => u.id === userId);
  if (!me) throw new Error(`User ${userId} not found`);
  const members = me.householdId ? users.filter((u) => u.householdId === me.householdId).map((u) => u.id) : [userId];
  if (!members.includes(userId)) members.push(userId);
  const memberSet = new Set(members);
  const userNames = Object.fromEntries(users.filter((u) => memberSet.has(u.id)).map((u) => [u.id, u.name || u.email]));
  return {
    members,
    userNames,
    coffees: coffees.filter((c) => c?.id),
    householdBrews: brews.filter((b) => b?.id && memberSet.has(b.userId)),
    aliases: { roasterAliases: roasterAliases || {}, coffeeNameAliases: coffeeNameAliases || {} },
    grinderProfiles,
  };
}

/** POST a Chat Completions body; returns content, usage and latency. */
export async function callChat(body) {
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content,
    finishReason: data.choices?.[0]?.finish_reason,
    usage: data.usage,
    elapsedMs: Date.now() - t0,
  };
}

/** Generates one grinder profile with the production prompt; one retry on 429/5xx. Takes a brewPrompts module. */
export async function generateGrinderProfile(P, name, model = P.MODEL) {
  const body = JSON.stringify(P.buildGrinderProfileRequest(name, model));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body,
    });
    if (res.ok) return P.parseGrinderProfileResponse(name, model, await res.json());
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) continue;
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

/** USD per 1M tokens (input, output). */
export const PRICING = {
  "gpt-5.4": [1.25, 10],
  "gpt-6.1-sol": [2, 10],
  "gpt-6-astra": [10, 50],
  "gpt-6-luna": [0.1, 0.5],
};

export function costUsd(model, usage) {
  const [inp, out] = PRICING[model] || [0, 0];
  return ((usage?.prompt_tokens || 0) * inp + (usage?.completion_tokens || 0) * out) / 1e6;
}
