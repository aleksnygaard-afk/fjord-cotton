// db-sjekk.mjs — is the database actually in the state the code expects?
//
//   node scripts/db-sjekk.mjs
//
// Reads only. Prints the palette with its Gelato UID patterns, the size run, the
// functions the routes call, and the columns each migration adds — so a missing
// migration shows up here instead of as a 400 on a paid order.
//
// Node 18+. No dependencies.

import { sel, rpc, probe } from './env.mjs';

let mangler = 0;

async function harKolonne(table, column) {
  const res = await probe(`${table}?select=${column}&limit=1`);
  if (res.ok) return true;
  if (res.json?.code === '42703') return false; // undefined_column
  throw new Error(`${table}.${column}: ${res.status} ${res.json?.message ?? ''}`);
}

function linje(ok, label, detail = '') {
  if (!ok) mangler++;
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(38)}${detail}`);
}

// ── Palette and UID patterns ────────────────────────────────────────────────
console.log('— garment_colors —');
const colors = await sel('garment_colors?select=key,name_en,gelato_variant_key,sort_order&order=sort_order');
for (const c of colors) {
  const uid = c.gelato_variant_key;
  const token = uid ? (/_gco_([a-z-]+)_/.exec(uid)?.[1] ?? '?') : null;
  linje(
    Boolean(uid?.includes('{size}')),
    `  ${String(c.sort_order).padStart(2)} ${c.key.padEnd(8)} ${String(c.name_en).padEnd(15)}`,
    uid ? `gco_${token}` : 'MANGLER UID — kjør scripts/seed-gelato-uids.mjs',
  );
}

const sizes = await sel('garment_sizes?select=key,gelato_size_code,sort_order&order=sort_order');
console.log('\n— garment_sizes —');
console.log('  ' + sizes.map((s) => `${s.key}${s.gelato_size_code ? `→${s.gelato_size_code}` : ''}`).join(', '));

// ── Colour restriction ──────────────────────────────────────────────────────
console.log('\n— colors_for_contrast —');
for (const [p, forventet] of [
  ['light_safe', 2],
  ['dark_safe', 4],
  ['neutral', null],
]) {
  const r = await rpc('colors_for_contrast', { p });
  const antall = r.data === null ? null : r.data?.length;
  linje(
    r.ok && antall === forventet,
    `  ${p}`,
    r.ok ? (r.data === null ? 'null = alle seks' : JSON.stringify(r.data)) : `feil ${r.status}`,
  );
}

// ── Functions the routes call ───────────────────────────────────────────────
console.log('\n— funksjoner —');
const NULL_UUID = '00000000-0000-0000-0000-000000000000';
for (const [fn, args] of [
  ['generate_variants', { p_design: NULL_UUID }],
  ['design_colors', { p_design: NULL_UUID }],
  ['claim_gelato_job', { p_order_no: 'FC-FINNES-IKKE' }],
  ['colors_for_contrast', { p: 'neutral' }],
]) {
  const r = await rpc(fn, args);
  // A missing function is 404 / PGRST202. Anything else means it ran — including a
  // complaint about the dummy argument, which is the point: the signature matched.
  const finnes = !(r.status === 404 || r.data?.code === 'PGRST202');
  linje(finnes, `  ${fn}()`, finnes ? '' : 'MANGLER — er migrasjonen kjørt?');
}

// ── Columns, grouped by the migration that adds them ────────────────────────
console.log('\n— kolonner —');
const kolonner = [
  ['0007_fulfillment', 'garment_sizes', 'gelato_size_code'],
  ['0007_fulfillment', 'orders', 'gelato_attempts'],
  ['0007_fulfillment', 'orders', 'gelato_last_error'],
  ['0007_fulfillment', 'orders', 'gelato_submitted_at'],
  ['0007_fulfillment', 'orders', 'gelato_claimed_at'],
  ['0006_orders', 'orders', 'gelato_order_id'],
  ['0006_orders', 'orders', 'tracking_url'],
  ['02e-design-colors', 'designs', 'contrast'],
  ['02e-design-colors', 'designs', 'allowed_colors'],
];
for (const [migrasjon, table, column] of kolonner) {
  const ok = await harKolonne(table, column);
  linje(ok, `  ${table}.${column}`, ok ? '' : `MANGLER — kjør ${migrasjon}`);
}

// ── Contents ────────────────────────────────────────────────────────────────
const designs = await sel('designs?select=slug,status,contrast');
console.log('\n— innhold —');
console.log(`  ${designs.length} design` + (designs.length ? ': ' + designs.map((d) => `${d.slug} (${d.status})`).join(', ') : ''));
console.log(`  temaer: ${(await sel('themes?select=key')).map((t) => t.key).join(', ')}`);
console.log(`  kolleksjoner: ${(await sel('collections?select=key')).map((c) => c.key).join(', ')}`);

console.log(mangler ? `\n${mangler} avvik. Se linjene med ✗ over.` : '\nAlt på plass.');
process.exit(mangler ? 1 : 0);
