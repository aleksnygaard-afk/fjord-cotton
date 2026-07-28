/**
 * Money. All amounts are integer øre, VAT-inclusive gross (02-data-model.sql).
 * Never use floats for money.
 */

/** 34900 → "349 kr" / 129900 → "1 299 kr" (nb-NO, non-breaking thin space). */
export function formatKr(ore: number): string {
  const kroner = Math.round(ore / 100);
  return `${kroner.toLocaleString("nb-NO")} kr`;
}

/** Convert whole kroner (as entered by an admin) to øre. */
export function kronerToOre(kroner: number): number {
  return Math.round(kroner * 100);
}

/**
 * The 25 % VAT component of a gross figure is round(total * 0.20)
 * (01-design-spec.md, 03-api-and-payments.md).
 */
export function vatOfGross(grossOre: number): number {
  return Math.round(grossOre * 0.2);
}
