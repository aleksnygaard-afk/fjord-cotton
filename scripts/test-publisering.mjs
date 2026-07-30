// test-publisering.mjs — kjører testlisten for publiseringsflyten mot en app som går.
//
//   node node_modules/next/dist/bin/next dev          (i ett vindu)
//   node scripts/test-publisering.mjs                 (i et annet)
//
// Bruker port 3000. Kjører dev-serveren et annet sted:
//
//   APP_URL=http://localhost:3100 node scripts/test-publisering.mjs
//
// Dekker: middleware-guarden på /admin, autentisering på admin-API-et, avvisning av
// trykkfiler som ville blitt trykket feil, publiseringen med fargebegrensning, og at
// butikkfronten holder kladder skjult.
//
// Alt den oppretter blir slettet igjen til slutt — men den skriver til den basen
// .env.local peker på, så ikke kjør den mot produksjon med design i.
//
// Designene lages med status 'draft'. En publisert testskjorte ville vært synlig i
// den ekte butikken, og det er ikke noe et testskript skal bestemme.
//
// Exit 0 = alt bestått. Node 18+, bruker sharp fra prosjektet.

import sharp from 'sharp';
import { APP, sel, rpc, del, buckets, listObjects, removeObjects } from './env.mjs';

const W = 4500;
const H = 5400;
const TOKEN = { 'x-admin-token': process.env.ADMIN_TOKEN ?? '' };
const PREFIKS = 'testdesign';

let bestatt = 0;
let feilet = 0;
const opprettet = [];

function sjekk(ok, label, detail = '') {
  console.log(`${ok ? '✓' : '✗ FEIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  ok ? bestatt++ : feilet++;
  return ok;
}

// ── Trykkfiler ──────────────────────────────────────────────────────────────
// Fire filer, én per feilmodus vi bryr oss om. Den viktige er 'hvitBakgrunn': den
// HAR alfakanal, men kantene er dekket — altså et hvitt rektangel på en svart skjorte.
async function flate(w, h, channels, background) {
  return sharp({ create: { width: w, height: h, channels, background } }).png().toBuffer();
}

console.log('Lager testfiler …');
const motiv = await flate(2400, 2400, 4, '#6e2632');
const utenAlfa = await flate(W, H, 3, '#ffffff');
const hvitBakgrunn = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite([{ input: motiv, gravity: 'centre' }])
  .png()
  .toBuffer();
const riktig = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: motiv, gravity: 'centre' }])
  .png()
  .toBuffer();
const forLiten = await flate(1200, 1400, 4, { r: 0, g: 0, b: 0, alpha: 0 });

const themes = await sel('themes?select=key&limit=1');
const collections = await sel('collections?select=key&limit=1');
const felles = {
  themeKey: themes[0]?.key ?? '',
  collectionKey: collections[0]?.key ?? '',
  priceOverrideKr: '349',
};

async function post(buffer, filnavn, felt, headers = {}) {
  const body = new FormData();
  body.set('file', new Blob([buffer], { type: 'image/png' }), filnavn);
  for (const [k, v] of Object.entries(felt)) body.set(k, v);
  const res = await fetch(`${APP}/api/admin/designs`, { method: 'POST', body, headers });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// ── 1. Middleware ───────────────────────────────────────────────────────────
console.log('\n1. Middleware: /admin uten sesjon');
{
  const res = await fetch(`${APP}/admin`, { redirect: 'manual' });
  const loc = res.headers.get('location') ?? '';
  sjekk([301, 302, 303, 307, 308].includes(res.status), `omdirigerer (${res.status})`);
  sjekk(loc.includes('/logg-inn'), 'til /logg-inn', loc.replace(APP, '') || '(ingen location)');
  sjekk(/neste=(%2F|\/)admin/.test(loc), 'med ?neste=/admin');

  const upload = await fetch(`${APP}/admin/upload`, { redirect: 'manual' });
  sjekk([301, 302, 303, 307, 308].includes(upload.status), `/admin/upload er også bak guarden (${upload.status})`);

  const login = await fetch(`${APP}/logg-inn`);
  sjekk(login.status === 200, `/logg-inn svarer 200 (${login.status})`);
}

// ── 2. Autentisering ────────────────────────────────────────────────────────
console.log('\n2. POST /api/admin/designs uten legitimasjon');
{
  const uten = await post(riktig, 'uten-token.png', { ...felles, title: `${PREFIKS} uten token`, status: 'draft' });
  sjekk(uten.status === 401, `uten token → 401 (${uten.status})`, uten.json.error ?? '');

  const feil = await post(riktig, 'feil-token.png', { ...felles, title: `${PREFIKS} feil token`, status: 'draft' }, { 'x-admin-token': 'feil-hemmelighet' });
  sjekk(feil.status === 401, `feil token → 401 (${feil.status})`);
}

// ── 3. Avvisning ────────────────────────────────────────────────────────────
console.log('\n3. Avvisning av dårlige trykkfiler');
{
  const a = await post(utenAlfa, 'uten-alfa.png', { ...felles, title: `${PREFIKS} uten alfa`, status: 'draft' }, TOKEN);
  sjekk(a.status === 422 && /alpha channel/.test(a.json.error ?? ''), `uten alfakanal → 422 (${a.status})`, a.json.error ?? '');

  const b = await post(hvitBakgrunn, 'hvit-bakgrunn.png', { ...felles, title: `${PREFIKS} hvit bakgrunn`, status: 'draft' }, TOKEN);
  sjekk(b.status === 422 && /not transparent/.test(b.json.error ?? ''), `opak hvit bakgrunn → 422 (${b.status})`, b.json.error ?? '');

  const c = await post(Buffer.from('dette er ikke et bilde'), 'tull.txt', { ...felles, title: `${PREFIKS} tull`, status: 'draft' }, TOKEN);
  sjekk(c.status === 422, `ulesbar fil → 422 (${c.status})`, c.json.error ?? '');

  // For små mål er en advarsel, ikke en avvisning: klienten stopper dem, serveren
  // godtar dem slik at et skript kan laste opp noe med vilje.
  const d = await post(forLiten, 'for-liten.png', { ...felles, title: `${PREFIKS} for liten`, status: 'draft' }, TOKEN);
  if (d.status === 201) opprettet.push(d.json.design.slug);
  sjekk(d.status === 201 && (d.json.warnings ?? []).length > 0, `for små mål → 201 med advarsel (${d.status})`, (d.json.warnings ?? []).join(' · ') || (d.json.error ?? ''));
}

// ── 4. Publisering og fargebegrensning ──────────────────────────────────────
// Titlene deler de åtte første tegnene med vilje. SKU-en ble en gang bygget av
// left(slug, 8), og da kolliderte det andre designet mot variants_sku_key.
console.log('\n4. Publisering og fargebegrensning');
const forventet = { neutral: 6, dark_safe: 4, light_safe: 2 };
for (const contrast of ['neutral', 'dark_safe', 'light_safe']) {
  const r = await post(riktig, `${PREFIKS}-${contrast}.png`, { ...felles, title: `${PREFIKS} ${contrast}`, status: 'draft', contrast }, TOKEN);
  if (!sjekk(r.status === 201, `${contrast}: opprettet (${r.status})`, r.json.error ?? '')) continue;

  const d = r.json.design;
  opprettet.push(d.slug);

  const [rad] = await sel(`designs?slug=eq.${d.slug}&select=id,contrast,allowed_colors,mockup_url`);
  sjekk(rad?.contrast === contrast, `${contrast}: contrast lagret`, String(rad?.contrast));

  const farger = rad?.allowed_colors;
  const antall = farger === null ? 6 : (farger?.length ?? 0);
  sjekk(antall === forventet[contrast], `${contrast}: ${antall} farger tillatt`, farger === null ? 'null = alle seks' : JSON.stringify(farger));
  sjekk(d.variantCount === forventet[contrast] * 7, `${contrast}: ${d.variantCount} varianter (${forventet[contrast]}×7)`);
  sjekk(Boolean(rad?.mockup_url), `${contrast}: mockup lagret`, rad?.mockup_url?.split('/').slice(-2).join('/') ?? '');

  const dc = await rpc('design_colors', { p_design: rad.id });
  sjekk(dc.ok && dc.data?.length === forventet[contrast], `${contrast}: design_colors() gir ${dc.data?.length ?? '?'} farger`);

  const varianter = await sel(`variants?design_id=eq.${rad.id}&select=sku`);
  const unike = new Set(varianter.map((v) => v.sku)).size;
  sjekk(unike === varianter.length, `${contrast}: ${unike} unike SKU-er av ${varianter.length}`, varianter[0]?.sku ?? '');
}

// ── 5. Butikkfronten ────────────────────────────────────────────────────────
console.log('\n5. Butikkfronten');
{
  const katalog = await fetch(`${APP}/no/katalog`);
  const html = await katalog.text();
  sjekk(katalog.status === 200, `/no/katalog svarer 200 (${katalog.status})`);
  sjekk(!opprettet.some((slug) => html.includes(slug)), 'kladdene vises IKKE i katalogen');

  const forside = await fetch(`${APP}/no`);
  sjekk(forside.status === 200, `/no svarer 200 (${forside.status})`);

  if (opprettet.length) {
    const side = await fetch(`${APP}/no/design/${opprettet.at(-1)}`);
    sjekk(side.status === 404, `kladdens produktside gir 404 (${side.status})`, side.status === 200 ? 'synlig — sjekk statusfilteret' : 'skjult, som forventet');
  }

  const api = await fetch(`${APP}/api/designs`);
  const json = await api.json().catch(() => ({}));
  const antall = Array.isArray(json) ? json.length : (json.designs?.length ?? 0);
  sjekk(api.status === 200, `/api/designs svarer 200 (${api.status})`, `${antall} publiserte design`);
}

// ── 6. Opprydding ───────────────────────────────────────────────────────────
// Sletter designraden (variants følger med via on delete cascade) og filene i bøttene.
console.log('\n6. Rydder bort testdataene');
for (const slug of opprettet) {
  const [rad] = await sel(`designs?slug=eq.${slug}&select=id`);
  if (rad) {
    await del(`publish_log?design_id=eq.${rad.id}`);
    await del(`designs?id=eq.${rad.id}`);
  }
  await removeObjects(buckets.print, [`${slug}/print.png`]);
  await removeObjects(buckets.mockup, [`${slug}/mockup.webp`, `${slug}/detail.webp`]);
}

const igjen = await sel('designs?select=slug');
sjekk(!igjen.some((d) => opprettet.includes(d.slug)), `slettet ${opprettet.length} testdesign`, `${igjen.length} design igjen i basen`);

for (const bucket of [buckets.print, buckets.mockup]) {
  const rester = (await listObjects(bucket)).map((i) => i.name).filter((n) => n.startsWith(PREFIKS) || n === 'for-liten');
  sjekk(rester.length === 0, `bøtta ${bucket} er ryddet`, rester.join(', ') || 'ingen testfiler igjen');
}

console.log(`\n─────────────\n${bestatt} bestått, ${feilet} feilet`);
if (feilet) console.log('Står noe igjen etter en feil? node scripts/rydd-testdata.mjs');
process.exit(feilet ? 1 : 0);
