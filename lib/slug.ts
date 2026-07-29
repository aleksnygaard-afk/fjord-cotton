const MAP: Record<string, string> = {
  æ: 'ae', ø: 'o', å: 'aa', ä: 'a', ö: 'o', ü: 'u', é: 'e', è: 'e', ê: 'e', ç: 'c', ñ: 'n',
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[æøåäöüéèêçñ]/g, (c) => MAP[c] ?? c)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'design'
}

/**
 * Slugs are permanent once published (SEO), so collisions get a counter rather than
 * a timestamp. taken = slugs already in the database with this stem.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; n < 500; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

/** Filename → suggested title. 'host-01-graa-mandag.png' → 'Graa Mandag' */
export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^[a-z]{2,6}[-_]?\d{1,3}[-_]/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Uten tittel'
}
