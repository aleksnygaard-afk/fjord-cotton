// seed-gelato-uids.mjs — read a Gelato product template, print the SQL that seeds
// garment_colors.gelato_variant_key.
//
// Run once, after the template is built in the Gelato dashboard.
//
//   node scripts/seed-gelato-uids.mjs > uids.sql
//
// GELATO_API_KEY and GELATO_TEMPLATE_ID are read from .env.local (falling back to
// .env), the same file the app uses. A real environment variable still wins, so
// this also works:
//
//   GELATO_API_KEY=... GELATO_TEMPLATE_ID=... node scripts/seed-gelato-uids.mjs
//
// Then paste uids.sql into the Supabase SQL Editor.
//
// Node 18+. No dependencies.

// env.mjs leser .env.local / .env og setter process.env. Presedensen ligger der.
import './env.mjs';

const API_KEY = process.env.GELATO_API_KEY;
const TEMPLATE_RAW = process.env.GELATO_TEMPLATE_ID;

if (!API_KEY) {
  console.error(
    'Mangler GELATO_API_KEY. Den står ikke i .env.local.\n' +
      'Hent den i Gelato-dashbordet under Developers → API keys, og legg inn:\n' +
      '  GELATO_API_KEY=...\n' +
      'Nøkkelen brukes bare av dette skriptet og ved ordre — aldri i nettleseren.',
  );
  process.exit(1);
}

if (!TEMPLATE_RAW) {
  console.error('Mangler GELATO_TEMPLATE_ID i .env.local.');
  process.exit(1);
}

/**
 * The template ID is a UUID. It is easy to paste the wrong thing here: the
 * print-file-editor URL from the catalogue looks authoritative but contains a
 * productUid for one single size and colour, and no template at all.
 */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function resolveTemplateId(raw) {
  if (UUID.test(raw)) return UUID.exec(raw)[0]; // bare UUID, or an API URL
  if (/productUid=/.test(raw)) {
    console.error(
      'GELATO_TEMPLATE_ID er en print-file-editor-URL, ikke en mal-ID.\n' +
        'Den inneholder en productUid for én størrelse og én farge, så skriptet\n' +
        'kan ikke lese de andre 41 variantene ut av den.\n\n' +
        'Slik får du riktig verdi:\n' +
        '  1. Bygg malen i Gelato-dashbordet under Templates (alle seks farger,\n' +
        '     størrelse S–4XL aktivert), og lagre den.\n' +
        '  2. Åpne malen. ID-en er UUID-en i adresselinjen.\n' +
        '  3. GELATO_TEMPLATE_ID=<den UUID-en> i .env.local.',
    );
    process.exit(1);
  }
  console.error(
    `GELATO_TEMPLATE_ID ser ikke ut som en mal-ID (forventet en UUID): ${raw.slice(0, 80)}`,
  );
  process.exit(1);
}

const TEMPLATE_ID = resolveTemplateId(TEMPLATE_RAW);

// Gelato names colours and sizes in English. Map them to our keys.
// If the template uses different colour names, the script tells you which ones
// it could not match — fix the map, do not fix the database by hand.
// Gildan 5000, six 100 %-cotton colourways.
const COLOR_MAP = {
  white: 'hvit',
  sand: 'sand',
  natural: 'sand',
  'military green': 'oliven',
  garnet: 'garnet',
  navy: 'marine',
  black: 'sort',
};

// Gelato labels 2XL as '2xl'; our key is 'xxl'.
const SIZE_MAP = {
  s: 's', m: 'm', l: 'l', xl: 'xl',
  '2xl': 'xxl', xxl: 'xxl',
  '3xl': '3xl', '4xl': '4xl',
};

// Our keys, in stock order. No XS — Gildan 5000 does not make one. No 5XL —
// Military Green lacks it, and a size missing in one colour fails silently.
const SIZE_KEYS = ['s', 'm', 'l', 'xl', 'xxl', '3xl', '4xl'];

// The tokens Gelato actually puts in a productUid and variant title.
const GELATO_SIZES = Object.keys(SIZE_MAP);

const res = await fetch(
  `https://ecommerce.gelatoapis.com/v1/templates/${TEMPLATE_ID}`,
  { headers: { 'X-API-KEY': API_KEY } }
);

if (!res.ok) {
  console.error(`Gelato svarte ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const tpl = await res.json();
const variants = tpl.variants ?? [];

if (!variants.length) {
  console.error('Malen har ingen varianter. Er den lagret i dashbordet?');
  process.exit(1);
}

// Pull colour and size off each variant. Gelato exposes them as variantOptions
// [{name, value}], but older templates put them in the title — handle both.
function optionsOf(v) {
  const out = {};
  for (const o of v.variantOptions ?? []) {
    out[String(o.name).toLowerCase()] = String(o.value).toLowerCase();
  }
  if (!out.color || !out.size) {
    const parts = String(v.title ?? '').toLowerCase().split(/\s*[-/,]\s*/);
    for (const p of parts) {
      if (GELATO_SIZES.includes(p)) out.size ??= p;
      else if (COLOR_MAP[p]) out.color ??= p;
    }
  }
  return out;
}

// A productUid encodes the size: ..._gsi_m_gco_black_... . We store one UID per
// colour with the size token replaced by {size}, and substitute at order time.
// Storing 42 full UIDs would mean 42 rows to maintain instead of 6.
function templatise(uid, size) {
  const re = new RegExp(`_gsi_${size}(?=_|$)`);
  if (!re.test(uid)) return null;
  return uid.replace(re, '_gsi_{size}');
}

const byColor = new Map();
const unmatched = new Set();
const sizesSeen = new Set();
let noSizeToken = 0;

for (const v of variants) {
  const { color, size } = optionsOf(v);
  const uid = v.productUid;
  if (!uid) continue;

  const key = COLOR_MAP[color];
  if (!key) { unmatched.add(color ?? '(ukjent)'); continue; }

  const sizeKey = size ? SIZE_MAP[size] : null;
  if (sizeKey) sizesSeen.add(sizeKey);

  const pattern = size ? templatise(uid, size) : null;
  if (!pattern) { noSizeToken++; continue; }

  const prev = byColor.get(key);
  if (prev && prev !== pattern) {
    console.error(`ADVARSEL: ${key} gir to ulike UID-mønstre:\n  ${prev}\n  ${pattern}`);
  }
  byColor.set(key, pattern);
}

// ── Report to stderr so stdout stays pure SQL ────────────────────────────────
const err = console.error;
err(`\nVarianter i malen: ${variants.length}`);
err(`Farger matchet:    ${byColor.size} av 6`);
err(`Størrelser funnet: ${[...sizesSeen].join(', ') || 'ingen'}`);

if (unmatched.size) {
  err(`\nUmatchede fargenavn: ${[...unmatched].join(', ')}`);
  err('Legg dem inn i COLOR_MAP øverst i dette skriptet og kjør på nytt.');
}
if (noSizeToken) err(`\n${noSizeToken} varianter manglet _gsi_-token og ble hoppet over.`);

const missingColors = ['hvit','sand','oliven','garnet','marine','sort']
  .filter(k => !byColor.has(k));
if (missingColors.length) {
  err(`\nMANGLER: ${missingColors.join(', ')}`);
  err('Malen må ha alle seks farger aktivert før du seeder. Stopper.');
  process.exit(1);
}

const missingSizes = SIZE_KEYS.filter(s => !sizesSeen.has(s));
if (missingSizes.length) {
  err(`\nMANGLER STØRRELSER: ${missingSizes.join(', ')} — aktiver dem i malen.`);
  process.exit(1);
}

// ── SQL to stdout ───────────────────────────────────────────────────────────
const sql = [];
sql.push('-- Generert av seed-gelato-uids.mjs — ikke rediger for hånd.');
sql.push(`-- Mal: ${TEMPLATE_ID}`);
sql.push(`-- Kjørt: ${new Date().toISOString()}`);
sql.push('');
sql.push('-- {size} erstattes med størrelsesnøkkelen ved ordre. Se resolveGelatoUid().');
sql.push('begin;');
for (const [key, pattern] of byColor) {
  sql.push(`update garment_colors set gelato_variant_key = '${pattern}' where key = '${key}';`);
}
sql.push('');
sql.push('-- Feiler denne, mangler en farge en UID og ville feilet stille ved ordre.');
sql.push(`do $$ begin
  if exists (select 1 from garment_colors where gelato_variant_key is null
             or gelato_variant_key not like '%{size}%') then
    raise exception 'Én eller flere farger mangler et gyldig UID-mønster';
  end if;
end $$;`);
sql.push('commit;');
sql.push('');

console.log(sql.join('\n'));
err('\nFerdig. Lim stdout inn i Supabase SQL Editor.\n');
