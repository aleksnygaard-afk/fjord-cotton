// rydd-testdata.mjs — fjern testdesign som ble stående igjen.
//
//   node scripts/rydd-testdata.mjs            viser hva som ville blitt slettet
//   node scripts/rydd-testdata.mjs --slett    sletter
//
// test-publisering.mjs rydder etter seg selv, men en avbrutt kjøring eller en feil
// midt i publiseringen kan etterlate en designrad og filer i bøttene. Denne finner
// dem på slug-prefiks.
//
// Sletter BARE slugger som matcher testmønsteret under. Et ekte design heter ikke
// 'testdesign-…', men les listen før du kjører med --slett uansett.
//
// Node 18+. No dependencies.

import { sel, del, buckets, listObjects, removeObjects } from './env.mjs';

// Alt som starter med «test», pluss 'for-liten' fra dimensjonstesten. Bredt nok å
// fange 'testkasse-…' og 'testdesign-…' uten å røre et ekte design.
const MØNSTER = /^(test|for-liten)/i;
const SLETT = process.argv.includes('--slett');

const designs = await sel('designs?select=id,slug,status,created_at&order=created_at');
const traff = designs.filter((d) => MØNSTER.test(d.slug));

console.log(`${designs.length} design i basen, ${traff.length} matcher testmønsteret.`);
for (const d of designs) {
  console.log(`  ${MØNSTER.test(d.slug) ? '→' : ' '} ${d.slug} (${d.status})`);
}

// cart_lines.variant_id og order_lines.variant_id har ingen on delete-regel (0001
// linje 111 og 163) — med vilje, slik at en kvittering alltid kan slås opp. Derfor
// blokkerer en gammel kurv eller testordre slettingen av designet med 409, og de
// må ryddes først.
const variantIder = [];
for (const d of traff) {
  const vs = await sel(`variants?design_id=eq.${d.id}&select=id`);
  variantIder.push(...vs.map((v) => v.id));
}

const iListe = (ider) => `(${ider.join(',')})`;
const kurvlinjer = variantIder.length ? await sel(`cart_lines?variant_id=in.${iListe(variantIder)}&select=id,cart_id`) : [];
const ordrelinjer = variantIder.length ? await sel(`order_lines?variant_id=in.${iListe(variantIder)}&select=id,order_id,sku`) : [];

const ordreIder = [...new Set(ordrelinjer.map((l) => l.order_id))];
const ordrer = ordreIder.length ? await sel(`orders?id=in.${iListe(ordreIder)}&select=id,order_no,status,email,total`) : [];

if (kurvlinjer.length || ordrer.length) {
  console.log(`\nReferanser som blokkerer slettingen:`);
  if (kurvlinjer.length) console.log(`  → ${kurvlinjer.length} kurvlinjer i ${new Set(kurvlinjer.map((l) => l.cart_id)).size} kurver`);
  for (const o of ordrer) {
    console.log(`  → ordre ${o.order_no} (${o.status}, ${o.email}, ${(o.total / 100).toFixed(2)} kr) — les denne linjen før --slett`);
  }
}

// Foreldreløse mapper i bøttene: et design kan være slettet uten at filene ble det.
const foreldreløse = [];
for (const bucket of [buckets.print, buckets.mockup]) {
  for (const mappe of await listObjects(bucket)) {
    if (mappe.id) continue; // en fil på toppnivå, ikke en mappe
    const kjent = designs.some((d) => d.slug === mappe.name);
    if (MØNSTER.test(mappe.name) || !kjent) {
      const filer = (await listObjects(bucket, `${mappe.name}/`)).filter((f) => f.id);
      for (const f of filer) foreldreløse.push([bucket, `${mappe.name}/${f.name}`, kjent]);
    }
  }
}

if (foreldreløse.length) {
  console.log(`\n${foreldreløse.length} filer i bøttene uten et design som matcher, eller fra testdata:`);
  for (const [bucket, path, kjent] of foreldreløse) {
    console.log(`  → ${bucket}/${path}${kjent ? ' (designet finnes, men slugen matcher testmønsteret)' : ' (ingen designrad)'}`);
  }
}

if (!SLETT) {
  console.log(traff.length || foreldreløse.length ? '\nKjør på nytt med --slett for å fjerne dette.' : '\nIngenting å rydde.');
  process.exit(0);
}

// Rekkefølgen er tvunget av fremmednøklene: kurv- og ordrelinjer, så ordrene og de
// tomme kurvene, og først da designet — variants følger med via on delete cascade.
if (kurvlinjer.length) {
  const kurver = [...new Set(kurvlinjer.map((l) => l.cart_id))];
  console.log(`slettet ${kurvlinjer.length} kurvlinjer (${await del(`cart_lines?variant_id=in.${iListe(variantIder)}`)})`);
  console.log(`slettet ${kurver.length} kurver (${await del(`carts?id=in.${iListe(kurver)}`)})`);
}

if (ordrelinjer.length) {
  console.log(`slettet ${ordrelinjer.length} ordrelinjer (${await del(`order_lines?variant_id=in.${iListe(variantIder)}`)})`);
  for (const o of ordrer) {
    const rest = await sel(`order_lines?order_id=eq.${o.id}&select=id`);
    if (rest.length === 0) {
      console.log(`slettet ordre ${o.order_no} (${await del(`orders?id=eq.${o.id}`)})`);
    } else {
      console.log(`beholdt ordre ${o.order_no} — den har ${rest.length} linjer mot andre design`);
    }
  }
}

for (const d of traff) {
  await del(`publish_log?design_id=eq.${d.id}`);
  const status = await del(`designs?id=eq.${d.id}`);
  console.log(`slettet design ${d.slug} (${status})${status === 409 ? ' — noe refererer den fortsatt' : ''}`);
}

for (const bucket of [buckets.print, buckets.mockup]) {
  const paths = foreldreløse.filter(([b]) => b === bucket).map(([, p]) => p);
  if (paths.length) console.log(`slettet ${paths.length} filer i ${bucket} (${await removeObjects(bucket, paths)})`);
}

const etter = await sel('designs?select=slug');
console.log(`\nferdig — ${etter.length} design igjen: ${etter.map((d) => d.slug).join(', ') || '(ingen)'}`);
