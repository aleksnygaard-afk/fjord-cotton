// test-kasse.mjs — kjører hele kjøpsflyten mot en app som går:
// design → kurv → ordre → betalt → Gelato-innsending → ordreside.
//
//   EMAIL_MOCK=true node node_modules/next/dist/bin/next dev     (i ett vindu)
//   node scripts/test-kasse.mjs                                  (i et annet)
//
// Sett EMAIL_MOCK=true på dev-serveren. Er RESEND_API_KEY satt, sender kvitteringen
// seg ellers for ekte til testadressen i denne fila — en oppdiktet adresse som
// bouncer, og det går ut over omdømmet til sendedomenet.
//
// Krever mock-modus for Dintero (ingen DINTERO_*-nøkler, eller DINTERO_MOCK=true):
// /api/checkout/mock-complete er slått av når ekte nøkler finnes, og kjører ellers
// samme mark_order_paid som webhooken.
//
// Designet lages som 'draft', så ingenting havner i den ekte butikken. Alt som
// opprettes slettes til slutt — ordre, kurv, design og filer i bøttene.
//
// IKKE kjør denne mot produksjonsbasen etter lansering. To grunner: den sletter
// ordreraden sin, og README-DEV sier at ordrer aldri slettes (Bokføringsloven —
// avbestilling og refusjon er statusendringer). Og den bruker opp ordrenumre, så
// den fortløpende serien får hull. Før lansering er begge harmløse; etterpå hører
// testen til i et eget Supabase-prosjekt.
//
// Denne testen har funnet to feil som ingen annen sjekk fanget: create_order som
// ikke fant gen_random_bytes (0009), og gelato_status = NULL som fikk
// claim_gelato_job til å avvise hver eneste betalte ordre i stillhet (0010). Kjør
// den etter endringer i kassen, prisberegningen eller fulfilment.
//
// Exit 0 = alt bestått. Node 18+, bruker sharp fra prosjektet.

import sharp from 'sharp';
import { APP, sel, del, buckets, removeObjects } from './env.mjs';

const KJØPER = {
  email: 'testkasse@example.com',
  firstName: 'Test',
  lastName: 'Kasse',
  phone: '40000000',
  address1: 'Testveien 1',
  postcode: '0150',
  city: 'Oslo',
  country: 'NO',
};
const ANTALL = 2;
const FRI_FRAKT_OVER = 59900; // lib/cart-totals.ts

let bestatt = 0;
let feilet = 0;
function sjekk(ok, label, detail = '') {
  console.log(`${ok ? '✓' : '✗ FEIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  ok ? bestatt++ : feilet++;
  return ok;
}

const spor = { slug: null, orderNo: null, cartId: null };

// ── 1. Et design å kjøpe ────────────────────────────────────────────────────
const motiv = await sharp({ create: { width: 2400, height: 2400, channels: 4, background: '#232f43' } }).png().toBuffer();
const trykkfil = await sharp({ create: { width: 4500, height: 5400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: motiv, gravity: 'centre' }])
  .png()
  .toBuffer();

const [tema] = await sel('themes?select=key&limit=1');
const [kolleksjon] = await sel('collections?select=key&limit=1');

const form = new FormData();
form.set('file', new Blob([trykkfil], { type: 'image/png' }), 'testkasse.png');
form.set('title', 'Testkasse kvittering');
form.set('themeKey', tema.key);
form.set('collectionKey', kolleksjon.key);
form.set('status', 'draft');
form.set('contrast', 'dark_safe');

const opprett = await fetch(`${APP}/api/admin/designs`, {
  method: 'POST',
  body: form,
  headers: { 'x-admin-token': process.env.ADMIN_TOKEN ?? '' },
});
const opprettJson = await opprett.json().catch(() => ({}));
if (!sjekk(opprett.status === 201, `design opprettet (${opprett.status})`, opprettJson.error ?? `${opprettJson.design?.variantCount} varianter`)) {
  process.exit(1);
}
spor.slug = opprettJson.design.slug;

const [design] = await sel(`designs?slug=eq.${spor.slug}&select=id`);
const varianter = await sel(`variants?design_id=eq.${design.id}&select=id,sku,price,active,size:garment_sizes(key),color:garment_colors(key)&limit=60`);
const variant = varianter.find((v) => v.size?.key === 'l' && v.active);
if (!sjekk(Boolean(variant), 'aktiv variant i str L', `${variant?.sku} · ${(variant?.price / 100).toFixed(2)} kr`)) process.exit(1);

// ── 2. Kassen oppretter ordren ──────────────────────────────────────────────
const kasse = await fetch(`${APP}/api/checkout/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ variantId: variant.id, qty: ANTALL }],
    ...KJØPER,
    shippingMethod: 'home',
    paymentMethod: 'vipps',
    consent: true,
    locale: 'no',
  }),
});
const kasseJson = await kasse.json().catch(() => ({}));
if (!sjekk(kasse.status === 200, `checkout/session (${kasse.status})`, kasseJson.error ?? '')) {
  console.log(JSON.stringify(kasseJson, null, 2).slice(0, 600));
  process.exit(1);
}

spor.orderNo = kasseJson.orderNo;
const token = new URL(kasseJson.redirectUrl).searchParams.get('t');
sjekk(Boolean(spor.orderNo && token), `ordre ${spor.orderNo}, access_token utdelt`);
sjekk(String(kasseJson.redirectUrl).includes('/betaling/'), 'mock-modus omdirigerer til /betaling/');

const [ordre] = await sel(`orders?order_no=eq.${spor.orderNo}&select=id,status,total,subtotal,shipping,vat_amount,vat_rate,currency,gelato_status`);
sjekk(ordre?.status === 'pending', 'ordren er pending', String(ordre?.status));
// Etter 0010 skal en fersk rad få 'pending' av seg selv. Er den NULL, avviser
// claim_gelato_job hver innsending i stillhet — det var feilen 0010 fikset.
sjekk(ordre?.gelato_status === 'pending', `gelato_status ${ordre?.gelato_status} på en ny ordre`, ordre?.gelato_status === null ? 'NULL — kjør 0010' : '');
sjekk(ordre?.subtotal === variant.price * ANTALL, `subtotal ${(ordre?.subtotal / 100).toFixed(2)} kr = ${ANTALL} × ${(variant.price / 100).toFixed(2)}`);
sjekk(
  ordre?.subtotal >= FRI_FRAKT_OVER ? ordre?.shipping === 0 : ordre?.shipping > 0,
  `frakt ${(ordre?.shipping / 100).toFixed(2)} kr`,
  ordre?.subtotal >= FRI_FRAKT_OVER ? 'fri frakt over 599 kr' : 'under terskelen',
);
sjekk(ordre?.total === ordre?.subtotal + ordre?.shipping, `total ${(ordre?.total / 100).toFixed(2)} kr = subtotal + frakt`);
sjekk(ordre?.vat_amount === 0 && Number(ordre?.vat_rate) === 0, 'ingen mva — VAT_REGISTERED=false');
sjekk(ordre?.currency === 'NOK', `valuta ${ordre?.currency}`);

const linjer = await sel(`order_lines?order_id=eq.${ordre.id}&select=sku,qty,unit_price,line_total,print_file_url,size_label,color_name`);
sjekk(linjer.length === 1 && linjer[0].qty === ANTALL, `1 ordrelinje, qty ${ANTALL}`, linjer[0]?.sku ?? '');
sjekk(linjer[0]?.unit_price === variant.price && linjer[0]?.line_total === variant.price * ANTALL, `linjebeløp ${(linjer[0]?.line_total / 100).toFixed(2)} kr`);
sjekk(Boolean(linjer[0]?.print_file_url), 'trykkfil-sti kopiert til linjen', linjer[0]?.print_file_url ?? '');
sjekk(Boolean(linjer[0]?.size_label && linjer[0]?.color_name), 'farge og størrelse frosset på linjen', `${linjer[0]?.color_name} · ${linjer[0]?.size_label}`);

// orders har ingen cart_id — kurven spores via variantreferansen.
const kurvlinjer = await sel(`cart_lines?variant_id=eq.${variant.id}&select=cart_id`);
spor.cartId = kurvlinjer[0]?.cart_id ?? null;

// ── 3. Betaling ─────────────────────────────────────────────────────────────
// mock-complete kjører samme mark_order_paid som Dintero-webhooken, og de samme
// after()-jobbene: innsending til Gelato og kvittering.
async function betal() {
  const res = await fetch(`${APP}/api/checkout/mock-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNo: spor.orderNo, t: token }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const betaling = await betal();
sjekk(betaling.status === 200, `mock-complete (${betaling.status})`, betaling.json.error ?? '');

// Jobbene kjører i after(), altså etter svaret.
await new Promise((r) => setTimeout(r, 5000));

const [etter] = await sel(`orders?order_no=eq.${spor.orderNo}&select=status,paid_at,dintero_transaction_id,gelato_status,gelato_order_id,gelato_attempts,gelato_last_error`);
sjekk(etter?.status === 'paid', 'ordren er paid', String(etter?.status));
sjekk(Boolean(etter?.paid_at), 'paid_at satt');
sjekk(Boolean(etter?.dintero_transaction_id), 'transaksjons-ID lagret', etter?.dintero_transaction_id ?? '');
sjekk(etter?.gelato_status === 'submitted', `gelato_status ${etter?.gelato_status}`, etter?.gelato_last_error ?? (etter?.gelato_status === 'pending' ? 'claimet gikk ikke gjennom' : ''));
sjekk(String(etter?.gelato_order_id ?? '').startsWith('mock-'), 'innsendt som mock-ordre', etter?.gelato_order_id ?? '');

const retry = await betal();
sjekk(retry.status === 200 && retry.json.result?.status === 'already_paid', 'retry betaler ikke på nytt', retry.json.result?.status ?? '');

// ── 4. Kundens sider ────────────────────────────────────────────────────────
const side = await fetch(`${APP}/no/ordre/${spor.orderNo}?t=${token}`);
sjekk(side.status === 200, `/no/ordre/… med token (${side.status})`);

// Siden henter ingen ordredata på serveren — den rendrer <OrderStatus>, som poller
// det token-beskyttede API-et. 200 uten token er riktig; det som betyr noe er at
// HTML-en er tom for kundedata.
const utenToken = await fetch(`${APP}/no/ordre/${spor.orderNo}`);
const html = await utenToken.text();
sjekk(!html.includes(KJØPER.email) && !html.includes(KJØPER.address1), `siden uten token lekker ingen kundedata (${utenToken.status})`);

const api = await fetch(`${APP}/api/orders/${spor.orderNo}?t=${token}`);
sjekk(api.status === 200, `/api/orders/… med token (${api.status})`);
const apiUten = await fetch(`${APP}/api/orders/${spor.orderNo}`);
sjekk([401, 403, 404].includes(apiUten.status), `/api/orders/… uten token avvist (${apiUten.status})`);

// ── 5. Opprydding ───────────────────────────────────────────────────────────
// Rekkefølgen er tvunget av fremmednøklene: cart_lines og order_lines peker på
// variants uten on delete-regel (0001:111 og :163), så de må vekk før designet.
console.log('\nRydder …');
const [o] = await sel(`orders?order_no=eq.${spor.orderNo}&select=id`);
if (o) {
  await del(`order_lines?order_id=eq.${o.id}`);
  await del(`orders?id=eq.${o.id}`);
}
if (spor.cartId) {
  await del(`cart_lines?cart_id=eq.${spor.cartId}`);
  await del(`carts?id=eq.${spor.cartId}`);
}
const [d] = await sel(`designs?slug=eq.${spor.slug}&select=id`);
if (d) {
  await del(`publish_log?design_id=eq.${d.id}`);
  await del(`designs?id=eq.${d.id}`);
}
await removeObjects(buckets.print, [`${spor.slug}/print.png`]);
await removeObjects(buckets.mockup, [`${spor.slug}/mockup.webp`, `${spor.slug}/detail.webp`]);

const restOrdre = await sel(`orders?order_no=eq.${spor.orderNo}&select=order_no`);
const restDesign = await sel(`designs?slug=eq.${spor.slug}&select=slug`);
sjekk(restOrdre.length === 0 && restDesign.length === 0, 'ordre, kurv og design slettet');

console.log(`\n─────────────\n${bestatt} bestått, ${feilet} feilet`);
if (feilet) console.log('Står noe igjen? node scripts/rydd-testdata.mjs');
process.exit(feilet ? 1 : 0);
