// env.mjs — shared plumbing for the scripts in this folder.
//
// Reads .env.local / .env the way Next.js does and wraps the Supabase REST and
// Storage endpoints, so each script is about what it checks rather than how it
// talks to the project. Node 18+. No dependencies.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root — one level up from scripts/. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const loaded = new Set();

function loadFile(name) {
  let text;
  try {
    text = readFileSync(join(ROOT, name), 'utf8');
  } catch {
    return; // absent is fine — the values may come from the environment
  }
  const seenHere = new Set();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match) continue; // comment, blank line, or export syntax we don't need
    const key = match[1];
    let value = match[2].trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);

    if (!loaded.has(key) && process.env[key] !== undefined) continue; // real env wins
    if (loaded.has(key) && !seenHere.has(key)) continue; // an earlier file wins

    seenHere.add(key);
    loaded.add(key);
    process.env[key] = value;
  }
}

/**
 * Same precedence as Next.js: a real environment variable wins over the file,
 * .env.local wins over .env, and within one file the last assignment wins.
 * Returns process.env for convenience; it is also mutated in place.
 */
export function loadEnv() {
  loadFile('.env.local');
  loadFile('.env');
  return process.env;
}

loadEnv();

/** The running app. Override with APP_URL when the dev server is on another port. */
export const APP = process.env.APP_URL ?? 'http://localhost:3000';

/**
 * Resolved on first database call, not at import: seed-gelato-uids.mjs imports this
 * module for the .env reader alone and must not need Supabase credentials.
 *
 * The service-role key bypasses Row Level Security on purpose — these scripts verify
 * and clean up what the admin routes write. Never reuse this in app code.
 */
let db = null;

function supabase() {
  if (db) return db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local.\n' +
        'Service-nøkkelen finnes i Supabase under Settings → API → service_role.',
    );
    process.exit(1);
  }
  db = {
    REST: `${url}/rest/v1`,
    STORAGE: `${url}/storage/v1`,
    HEADERS: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  };
  return db;
}

export const buckets = {
  print: process.env.SUPABASE_PRINT_BUCKET ?? 'print-files',
  mockup: process.env.SUPABASE_MOCKUP_BUCKET ?? 'mockups',
};

/** Raw GET against PostgREST — for callers that need the status, not the rows. */
export async function probe(query) {
  const { REST, HEADERS } = supabase();
  const res = await fetch(`${REST}/${query}`, { headers: HEADERS });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

/** GET from PostgREST. `query` is everything after /rest/v1/, e.g. 'designs?select=id'. */
export async function sel(query) {
  const res = await probe(query);
  if (!res.ok) throw new Error(`${res.status} ${query}: ${res.text.slice(0, 200)}`);
  return res.json;
}

/** Call a database function. Returns { ok, status, data } rather than throwing. */
export async function rpc(fn, args = {}) {
  const { REST, HEADERS } = supabase();
  const res = await fetch(`${REST}/rpc/${fn}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

export async function del(query) {
  const { REST, HEADERS } = supabase();
  const res = await fetch(`${REST}/${query}`, { method: 'DELETE', headers: HEADERS });
  return res.status;
}

/** Objects directly under `prefix`. Folders come back too, without an id. */
export async function listObjects(bucket, prefix = '') {
  const { STORAGE, HEADERS } = supabase();
  const res = await fetch(`${STORAGE}/object/list/${bucket}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ prefix, limit: 200 }),
  });
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json : [];
}

export async function removeObjects(bucket, paths) {
  if (!paths.length) return 200;
  const { STORAGE, HEADERS } = supabase();
  const res = await fetch(`${STORAGE}/object/${bucket}`, {
    method: 'DELETE',
    headers: HEADERS,
    body: JSON.stringify({ prefixes: paths }),
  });
  return res.status;
}
