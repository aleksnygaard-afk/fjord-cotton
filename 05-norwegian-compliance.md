# Norwegian compliance

Nothing here is optional for a Norwegian consumer webshop. Most of it is small to build but
impossible to retrofit after your first dispute.

## Company and VAT

**Nygård Multiservice, org.nr 925 714 089.** Must appear on the website, on every receipt and in
the order confirmation email.

VAT registration is required once turnover passes **50 000 kr** in a 12-month period. Registration
is pending, so:

- The site already shows "inkl. 25 % mva" — keep it, it will be correct once registered.
- **Do not charge or display VAT before the registration is approved.** Charging VAT while
  unregistered is an offence. Until the confirmation arrives, either hold the launch or hide the
  VAT lines behind a config flag (`VAT_REGISTERED=false`) that removes the VAT rows from the cart,
  the checkout summary and the receipt.
- Once registered, the org.nr is written with the MVA suffix: `925 714 089 MVA`.

Rate: 25 % standard rate on clothing. Books and food have other rates; irrelevant here.

**Sales to Sweden, Denmark and Finland.** The design offers those countries at checkout. Cross-border
B2C sales into the EU are not Norwegian VAT — they are subject to the destination country's VAT and
the EU **IOSS** scheme for consignments under €150. Two honest options:

1. **Launch Norway-only.** Remove the other countries from the select. Simplest and correct.
2. Register for IOSS through an intermediary and charge destination VAT per country.

Recommendation: start with option 1 and open the Nordics once volume justifies the accounting.

## Right of withdrawal (angrerett)

Governed by *angrerettloven*. For distance selling to consumers:

- **14 days** from receipt of the goods, no reason required.
- You must supply the **standardised withdrawal form** (Angrerettskjema) — the official form from
  Forbrukertilsynet, as a downloadable PDF or attached to the order confirmation email.
- Information about the right must be given **before** the purchase is completed. The consent
  checkbox at checkout satisfies this if it links to the terms.
- If you fail to inform properly, the withdrawal period extends to **12 months**.
- Refunds within 14 days of receiving the return, including the original standard shipping cost.

**Print-on-demand caveat, and it matters:** the exemption for custom-made goods does **not** apply
here. Your products are made to order but they are not personalised by the customer — they pick
from a fixed catalog. Full 14-day withdrawal applies. Budget for returns you cannot resell, and
factor that into pricing.

## Complaints (reklamasjon)

Separate from and additional to angrerett: **2 years** for ordinary goods under *forbrukerkjøpsloven*
for defects present at delivery. Cracked prints and seam failures are your problem, not Gelato's,
from the customer's point of view.

## Required pages

| Page | Must contain |
|---|---|
| Salgsbetingelser | Company name, org.nr, address, email; prices incl. VAT; delivery times; payment methods; angrerett; complaints; dispute resolution via Forbrukerrådet |
| Angrerett og retur | The 14-day rules, how to return, who pays return postage, the withdrawal form |
| Personvern (GDPR) | Data collected, purpose, legal basis, processors, retention, user rights, contact |
| Frakt og levering | Prices, carriers, delivery times, free-shipping threshold |
| Cookies | Only if you use analytics or marketing cookies |

The footer already links all of these. Forbrukertilsynet publishes a free standard sales-terms
template for Norwegian webshops — start from it rather than writing your own.

## GDPR

- **Consent banner** is only required for non-essential cookies. If you skip analytics at launch,
  you can skip the banner. Cart and session cookies are essential and exempt.
- **Processors** you will be sharing customer data with: Dintero (payment), Gelato (name and
  address for shipping), your email provider, your host. List each by name in the privacy policy.
- **Retention:** order data must be kept **5 years** for bookkeeping. That obligation overrides a
  deletion request for the order itself; you may delete marketing data.
- Keep customer data inside the EU/EEA where you can. Supabase and Vercel both offer EU regions —
  choose them at project creation, it cannot be changed later.

## Bookkeeping

*Bokføringsloven* applies from the first sale.

- Every order needs a sequential, gap-free order number. `FC-2026-######` with a random suffix
  is **not** compliant as an invoice number — use a sequence.
- Keep records for **5 years**.
- Do not hard-delete orders. Cancellations and refunds are new rows or status changes.
- Export to **Fiken** or **Tripletex** — both are standard for small Norwegian companies and have
  APIs. Build a nightly CSV or API push of paid orders with date, order number, net, VAT and gross.
  Doing this from day one is a few hours; doing it retroactively at year end is a weekend.

## Pre-launch checklist

- [ ] VAT registration approved, org.nr shown with MVA suffix
- [ ] Dintero agreement signed, production keys installed
- [ ] Salgsbetingelser, angrerett, personvern and frakt pages published with real content
- [ ] Withdrawal form PDF downloadable and attached to confirmation emails
- [ ] Receipt email shows org.nr, VAT amount and order number
- [ ] Supabase and Vercel projects in an EU region
- [ ] Non-Norwegian countries removed from checkout, or IOSS registered
- [ ] Bookkeeping export tested against Fiken or Tripletex
- [ ] A test order completed end to end: Vipps → paid → Gelato → tracking → receipt
