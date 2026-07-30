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

const MØNSTER = /^(testdesign|test-|for-liten)/i;
const SLETT = process.argv.includes('--slett');

const designs = await sel('designs?select=id,slug,status,created_at&order=created_at');
const traff = designs.filter((d) => MØNSTER.test(d.slug));

console.log(`${designs.length} design i basen, ${traff.length} matcher testmønsteret.`);
for (const d of designs) {
  console.log(`  ${MØNSTER.test(d.slug) ? '→' : ' '} ${d.slug} (${d.status})`);
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

for (const d of traff) {
  await del(`publish_log?design_id=eq.${d.id}`);
  const status = await del(`designs?id=eq.${d.id}`);
  console.log(`slettet design ${d.slug} (${status})`);
}

for (const bucket of [buckets.print, buckets.mockup]) {
  const paths = foreldreløse.filter(([b]) => b === bucket).map(([, p]) => p);
  if (paths.length) console.log(`slettet ${paths.length} filer i ${bucket} (${await removeObjects(bucket, paths)})`);
}

const etter = await sel('designs?select=slug');
console.log(`\nferdig — ${etter.length} design igjen: ${etter.map((d) => d.slug).join(', ') || '(ingen)'}`);
