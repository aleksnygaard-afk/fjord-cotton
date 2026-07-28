/**
 * Company identity — must appear on the website, every receipt and the order
 * confirmation email (05-norwegian-compliance.md). Single source of truth for
 * the footer, legal pages and receipts.
 */
export const COMPANY = {
  brand: "Fjord & Cotton",
  legalName: "Nygård Multiservice",
  orgNr: "925 714 089",
  email: "hei@fjordcotton.no",
  country: "Norge",
  freeShippingKr: 599,
} as const;

/**
 * Once VAT registration is approved the org.nr carries the MVA suffix
 * (05-norwegian-compliance.md). Until then it is shown without it.
 */
export function orgNrDisplay(vatRegistered: boolean): string {
  return vatRegistered ? `${COMPANY.orgNr} MVA` : COMPANY.orgNr;
}
