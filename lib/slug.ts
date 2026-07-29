/**
 * Slug generation. Slugs are permanent once a design is published (SEO), so we
 * derive them from the title, transliterate Norwegian characters, and append a
 * numeric counter on collision (04-gelato-fulfilment.md).
 */

const NORWEGIAN_MAP: Record<string, string> = {
  æ: "ae",
  ø: "o",
  å: "a",
  Æ: "ae",
  Ø: "o",
  Å: "a",
};

export function slugifyBase(title: string): string {
  const transliterated = title
    .trim()
    .replace(/[æøåÆØÅ]/g, (ch) => NORWEGIAN_MAP[ch] ?? ch);

  const slug = transliterated
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip remaining combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "") // trim hyphens
    .replace(/-{2,}/g, "-"); // collapse repeats

  return slug || "design";
}

/**
 * Given a base slug and a predicate that reports whether a candidate already
 * exists, returns the first free slug: `nordlys`, then `nordlys-2`, `nordlys-3`…
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await exists(base))) return base;
  for (let n = 2; n < 10000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Astronomically unlikely; fail loudly rather than loop forever.
  throw new Error(`Could not allocate a unique slug for "${base}"`);
}
