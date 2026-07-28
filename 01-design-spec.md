# Design specification

## Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#f7f5f0` | Page background (warm off-white) |
| `--surface` | `#fffdf8` | Cards, inputs, footer, summary panels |
| `--ink` | `#16150f` | Primary text, primary buttons, dark sections |
| `--ink-hover` | `#33301f` | Primary button hover |
| `--body` | `#46422f` | Body copy on light backgrounds |
| `--muted` | `#6d6653` | Secondary text |
| `--faint` | `#8b8574` | Labels, meta, eyebrows |
| `--line` | `#ddd7c9` | Borders, dividers |
| `--line-soft` | `#e6e0d2` | Inner table rows |
| `--line-strong` | `#c9c2b0` | Input/swatch borders |
| `--accent` | `#7a5c2e` | Link hover, tertiary links |
| `--vipps` | `#ff5b24` | Vipps express button only |
| `--on-dark` | `#b8b2a0` | Body copy inside dark sections |

Tile backgrounds cycle through: `#e9e3d4 #ded9cb #e4e0d2 #dfe2dc #e7e0d8 #dcdcd4 #e6e2d0 #e1dcd0`.

Shirt colours: Hvit `#f4f2ec`, Sort `#1a1a18`, Sand `#d8cdb6`, Salvie `#a9b3a1`,
Marine `#2a3446`, Rust `#a75c3c`.

### Typography

- **Display:** Instrument Serif (Google Fonts), regular. Headlines only.
- **UI:** Archivo 400/500/600 (Google Fonts). Everything else.
- **Mono:** `ui-monospace, Menlo, monospace`. Placeholder captions and order numbers only.

| Role | Size / line-height / tracking |
|---|---|
| Hero H1 | Instrument Serif 104px / 0.94 / −0.025em |
| Page H1 | Instrument Serif 52–56px / 1.02 / −0.02em |
| Section H2 | Instrument Serif 44px / −0.02em |
| Product tile title | Instrument Serif 19px / 1.2 |
| Body | Archivo 15–16px / 1.6–1.7 |
| UI default | Archivo 13px |
| Small / meta | Archivo 12px |
| Eyebrow label | Archivo 11px, uppercase, 0.14em tracking, `--faint` |
| Top bar / trust bar | Archivo 11–12px, uppercase, 0.10–0.14em tracking |

### Layout

- Content max width **1360px**, horizontal padding **32px**. Checkout and cart use **1080px**.
- Border radius: **2px** everywhere. Circles only for colour swatches.
- No shadows anywhere. Separation is done with 1px `--line` borders.
- Grids must use `repeat(n, minmax(0,1fr))` — plain `1fr` causes uneven columns because tile
  titles set a min-content floor.
- Buttons: primary `--ink` bg, `--bg` text, 16–19px vertical padding. Secondary is transparent with
  a 1px `--ink` border, hover `#ebe6da`.

## Screens

### 1. Global chrome

**Announcement bar** — `--ink` background, three centred items, 11px uppercase:
"Fri frakt over 599 kr" · "Trykkes og sendes fra Norge" · "14 dagers angrerett".

**Header** — sticky, `rgba(247,245,240,0.94)` + `backdrop-filter: blur(10px)`, 1px bottom border.
Three-column grid: left nav (Alle design / Nytt i dag / Kolleksjoner), centred wordmark
"Fjord & Cotton" in Instrument Serif 30px, right cluster (search field 230px, NO/EN toggle, cart
button with live item count).

**Footer** — `--surface`, 4 columns: brand + company details (Nygård Multiservice, org.nr
925 714 089), Butikk links, Kundeservice links (Frakt og levering, Angrerett og retur,
Salgsbetingelser, Personvern), Kontakt. Bottom row: copyright and payment method names as text.

### 2. Home

- **Hero** — two columns (1.05fr / 0.95fr), bottom-aligned. Eyebrow "Utgave 01 — Sommer 2026",
  H1 "Ti nye t-skjorter. Hver eneste dag.", body paragraph max 460px, two buttons. Right column is
  a 4:5 image slot for a model shot.
- **Trust bar** — full-width band on `--surface` with 1px borders top and bottom. Five items:
  live published count, "XS–3XL", "6 skjortefarger", "Kammet bomull, 220 g", payment methods.
  **The count must be a real query result, not a hardcoded number.**
- **Nytt i dag** — 5-column grid of the newest designs, each tile carrying a black "Ny" badge.
  Section header has an "Alle {n} →" link where n is the real total.
- **Three-column dark band** on `--ink` — numbered 01/02/03 value propositions.
- **I sesong nå** — 3 collection tiles, 16:10, chosen by date (see below).

### 3. Catalog

Two columns: 216px sticky sidebar + results grid.

Sidebar filter groups, in order: **Kolleksjon** (seasonal, with counts), **Tema** (with counts),
**Farge** (26px circular swatches, 2px outline when selected), **Størrelse** (chips), and a
"Nullstill filtre" text link.

Results: header row with the active filter name as H1 and "{n} design" on the right, then a
4-column grid, then "Last inn flere" (12 more per click). **Hide the button when everything is
shown.** When a filter returns nothing, show the empty state card instead of a blank grid:
"Ingen design i denne kolleksjonen ennå — kommer snart." with a button back to the archive.

Filters compose (collection AND theme AND search). All counts are computed from the dataset.

### 4. Product

Left: 2-column image grid — one full-width square hero, then two half-width squares
(model front, print detail). Right column is sticky at `top: 110px`.

Right column order: theme eyebrow → title (Instrument Serif 56px) → price → "Inkl. 25 % mva · fri
frakt over 599 kr" → colour swatches (32px) → size row (6-column grid, "Størrelsesguide" link) →
"Legg i handlekurv — {price}" (primary) → "Hurtigkjøp med Vipps" (`--vipps`, adds to cart and jumps
straight to checkout) → spec block with a description paragraph and three label/value rows
(Levering 2–4 virkedager, Retur 14 dager gratis, Trykkes i Oslo).

### 5. Cart

1080px, two columns (1fr / 340px). Each line: 86px thumbnail, title + variant string
("Sand · M") + Fjern link, and on the right the line total with a −/qty/+ stepper. Summary panel:
Delsum, Frakt, "herav mva (25 %)", Totalt, "Til kassen" button, payment names.
Empty state is a bordered card with a link to the catalog.

### 6. Checkout

Same 1080px two-column layout, right column is a sticky order summary.

Three numbered sections:
1. **Kontakt** — email (full width), first/last name, street, postcode, city, country select
   (Norge/Sverige/Danmark/Finland).
2. **Levering** — three selectable cards: Hentested Posten (0 kr, 2–4 virkedager), Hjem til døra
   Bring (59 kr, 2–3), Ekspress Bring 09:00 (149 kr, 1). Selection = 1px `--ink` border.
   Free when subtotal ≥ 599 kr.
3. **Betaling** — four selectable cards, each with a 34×20px colour chip: Vipps `#ff5b24`
   (Anbefalt), Klarna `#ffb3c7`, Kort `#2a3446`, Apple Pay / Google Pay `#c9c2b0`.

Then a required consent checkbox referencing angrerettloven, and a pay button reading
"Betal {total} · {method}".

### 7. Confirmation

Centred, 640px. Eyebrow, H1 "Takk skal du ha.", paragraph, order number in a monospace bordered
box (`FC-2026-######`), button back to the shop.

## Behaviour

**Language.** A NO/EN toggle in the header. In the prototype this is done by swapping `textContent`
against `data-en` attributes — **do not reproduce that hack.** Use next-intl or an equivalent
message catalog with `/no` and `/en` routes. Norwegian bokmål is the default. Note that placeholders
and `<option>` labels must be translated too.

**Seasonal merchandising.** Collections are seasons and holidays: Sommer (Jun–Aug), Høst (Sep–Oct),
Halloween (Oct–Nov), Jul (Nov–Dec), Nyttår (Dec–Jan), Vinterferie (Jan–Feb), Påske (Mar–Apr),
17. mai (Apr–May). The home row shows the three collections whose next occurrence is soonest,
**excluding any collection with zero products**. Score by `(month - currentMonth + 12) % 12` so a
holiday that has just passed is never featured.

**Price and VAT.** Prices are stored and displayed VAT-inclusive in NOK. VAT shown in summaries is
`round(total * 0.20)` — that is the 25 % component of a gross figure. Format with `nb-NO` locale
(non-breaking space thousands separator) and the suffix " kr".

**Hover states.** Primary buttons darken to `#33301f`; secondary buttons fill `#ebe6da`; collection
tiles `filter: brightness(0.97)`; links go to `--accent`.

**Responsive.** The prototype is desktop-only. Mobile is required for launch — most Norwegian
traffic is mobile and Vipps is a phone-first payment method. Suggested: hero stacks, catalog grid
goes 2-up with filters in a bottom sheet, product page stacks with the buy panel becoming a sticky
bottom bar, checkout single-column with the summary collapsed into an expandable row.

## State

Client: `lang`, `query`, `collection`, `theme`, `color`, `size`, `limit`, cart lines
(`{variantId, qty}`), selected shipping and payment method. Cart belongs in localStorage plus a
server-side cart row so it survives the redirect to Vipps and back.

Server: designs, variants, collections, orders, and the Gelato job status per order line.
