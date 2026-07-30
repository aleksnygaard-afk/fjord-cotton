# Hva ligger i denne mappen

Alt som er nytt eller endret siden filene du har lokalt (datert 28.07).

## Legg filene her

Repo-roten din er `Fjord&Cotton\design_handoff_fjord_cotton`.

| Fil herfra | Legges i |
|---|---|
| `LANSERINGSPLAN.md` | `Fjord&Cotton\` (ett nivå over repoet) |
| `sql\02c-catalog-facets.sql` | repo-roten |
| `sql\02d-gelato-mockups.sql` | repo-roten |
| `sql\02e-design-colors.sql` | repo-roten |
| `04-gelato-fulfilment.md` | repo-roten — **erstatt** den gamle |
| `05-admin-upload.md` | repo-roten — ny fil |
| `scripts\seed-gelato-uids.mjs` | `repo\scripts\` — lag mappen |
| `design_prompts\*` | `Fjord&Cotton\design_prompts\` |

Merk: din lokale `05-norwegian-compliance.md` er en annen fil enn `05-admin-upload.md`.
Ikke overskriv den. Vil du unngå forvirring, gi den nye navnet `06-admin-upload.md`.

## SQL — kjør i denne rekkefølgen

Supabase → SQL Editor. Har du kjørt 02c før, hopp over den.

```
1. 02-data-model.sql        (har du allerede kjørt)
2. 02b-seed.sql             (har du allerede kjørt)
3. 02c-catalog-facets.sql   ← fikset 500-feilen på forsiden
4. 02d-gelato-mockups.sql   ← mockups fra Gelato
5. 02e-design-colors.sql    ← begrens design til tre farger
```

`02e` skriver om `generate_variants()` fra `02-data-model.sql`. Det er meningen —
kjør den etter, ikke før.

## Skriptet

```powershell
cd <repo>\scripts
$env:GELATO_API_KEY="din_nokkel"
$env:GELATO_TEMPLATE_ID="din_mal"
node seed-gelato-uids.mjs > uids.sql
```

Lim `uids.sql` inn i Supabase SQL Editor.

## Sikkerhet — gjør dette først

`dintero_credentials_P11116836_client_*.xlsx` ligger i repo-mappen din og inneholder
client secret. Legg dette i `.gitignore`:

```
.env
.env.local
*.xlsx
dintero_credentials*
```

Er filen allerede pushet til GitHub, ligger nøkkelen i historikken. Da må du rotere
den hos leverandøren — det er det eneste som faktisk lukker hullet. Sjekk repoet på
github.com før du gjør noe annet.

Butikken bruker nå Stripe, ikke Dintero, men den gamle Dintero-legitimasjonen bør
roteres uansett så lenge den ligger lesbar i historikken.
