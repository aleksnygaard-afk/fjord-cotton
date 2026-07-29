# Admin og innlogging — kode

Ferdig kode for `/logg-inn` og `/admin`, bygget etter `05-admin-upload.md`.
Legg filene inn i repo-roten din (`design_handoff_fjord_cotton`), samme mappestruktur.

## Filer

```
middleware.ts                                  guard foran /admin
lib/supabase.ts                                klienter + requireAdmin()
lib/slug.ts                                    slug med æøå, tittel fra filnavn
lib/gelato.ts                                  API-kall med backoff
app/logg-inn/page.tsx                          magic-link-innlogging
app/admin/page.tsx                             henter temaer, kolleksjoner, farger
app/admin/AdminQueue.tsx                       køtabellen
app/api/auth/callback/route.ts                 tar imot magic-lenken
app/api/auth/logg-ut/route.ts                  logg ut
app/api/admin/upload-url/route.ts              signerte opplastings-URLer
app/api/admin/designs/route.ts                 oppretter design + Gelato-produkt
app/api/webhooks/gelato/[secret]/route.ts      webhook
app/api/admin/mockups/sync/route.ts            cron: kopierer mockups
02g-admin-support.sql                          tabeller koden trenger
```

**Én mappe må døpes om.** Webhook-ruten ligger her som `-secret-`. Den må hete
`[secret]` med klammeparenteser — det er Next.js-syntaks for en dynamisk rute:

```
app/api/webhooks/gelato/[secret]/route.ts
```

## Før koden virker

**1. Installer avhengigheten**

```bash
npm install @supabase/ssr
```

**2. Kjør SQL-en**

`02g-admin-support.sql` i Supabase SQL Editor. Den må kjøres etter `02f`.

**3. Lag to storage-buckets**

Supabase → Storage:

| Bucket | Public |
|---|---|
| `print-files` | **nei** |
| `mockups` | **ja** |

`mockups` må være public — butikken laster bildene derfra. `print-files` må være privat;
det er produktet ditt.

**4. Slå på innlogging**

Supabase → Authentication → Providers → **Email**. Skru på, og skru **av** «Enable
signups» — ellers kan hvem som helst lage bruker og komme inn i admin.

Authentication → Users → **Add user** → `hei@fjordcotton.no`. Det er den ene brukeren.

Authentication → URL Configuration → legg til under Redirect URLs:

```
https://fjordcotton.no/api/auth/callback
http://localhost:3000/api/auth/callback
```

**5. Nye miljøvariabler**

```
GELATO_WEBHOOK_SECRET=<32 tilfeldige tegn>
CRON_SECRET=<32 tilfeldige tegn>
```

Lag dem med `openssl rand -hex 16` eller bare mask på tastaturet. Legg dem i
`.env.local` og i Vercel.

**6. Registrer webhooken hos Gelato**

API Portal → webhook-URL:

```
https://fjordcotton.no/api/webhooks/gelato/<GELATO_WEBHOOK_SECRET>
```

Gelato signerer ikke payloaden, så hemmeligheten i stien er hele forsvaret. Alt annet
får 404.

**7. Sett opp cron-jobben**

`vercel.json` i repo-roten:

```json
{
  "crons": [
    { "path": "/api/admin/mockups/sync", "schedule": "*/5 * * * *" }
  ]
}
```

Jobben kopierer mockups fra Gelato til din egen bucket. Uten den blir designene
stående som `pending` og vises aldri i butikken.

## Test i denne rekkefølgen

1. `npm run dev` → `/admin` skal sende deg til `/logg-inn`
2. Skriv inn adressen, klikk lenken i e-posten, du skal havne på `/admin`
3. Slipp inn **én** PNG. Sjekk at valideringen sier «Klar»
4. Slipp inn en PNG med hvit bakgrunn — den skal avvises med
   «Bakgrunnen er ikke gjennomsiktig». Virker ikke det, stopp og fiks det først;
   det er den feilen som ellers havner på en skjorte hos en kunde
5. Publiser én. Sjekk i Supabase at raden finnes med `mockup_status = 'pending'`
   og at `variants` har 42 eller 21 rader
6. Vent 5–10 minutter. Sjekk at `mockup_status` blir `ready` og at bildet ligger
   i `mockups`-bucketen
7. Åpne butikken. Designet skal være der

## Ting som er verdt å vite

**Valideringen sjekker åtte punkter langs kanten** for gjennomsiktighet — hjørnene og
midtpunktene. Motivet skal være sentrert, så rammen skal være tom. Er fem av åtte
opake, avvises filen.

**Publisering går sekvensielt, ikke parallelt.** Ti samtidige Create Product-kall gir
429 fra Gelato. Det tar noen sekunder lenger og feiler ikke.

**Feiler en rad, rulles den tilbake** og resten fortsetter. Radene som feilet blir røde
med årsak. En dårlig fil skal ikke velte en batch på ti.

**Webhooken gjør nesten ingenting.** Den lagrer hendelsen og svarer 200. Gelato prøver
bare tre ganger med fem sekunders mellomrom, så en treg handler mister hendelsen. Cron
gjør jobben.

**`generate_variants()` kalles via RPC.** Krever at `02e` og `02f` har kjørt — funksjonen
må lese `allowed_colors`, ellers får hvert design 42 varianter uansett fargevalg.

## Ikke bygget

- Ingen redigering av publiserte design. Bruk Supabase Table Editor til det finnes behov
- Ingen sletting fra admin. Sett `status = 'archived'` i basen i stedet — sletting river
  ordrelinjer med seg
- Ingen fremdriftsindikator per fil under opplasting, bare én samlet status
