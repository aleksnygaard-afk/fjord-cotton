import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase'
import { slugify, uniqueSlug } from '@/lib/slug'
import { createProductFromTemplate, GelatoError } from '@/lib/gelato'

type Row = {
  printPath: string
  title: string
  themeKey: string
  collectionKey: string
  price: number
  contrast: 'light_safe' | 'dark_safe' | 'neutral'
  schedule: boolean
}

const TILE_BGS = ['#e9e3d4', '#ded9cb', '#e4e0d2', '#dfe2dc', '#e7e0d8', '#dcdcd4', '#e6e2d0', '#e1dcd0']

export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch (r) {
    return r as Response
  }

  const { rows } = (await req.json()) as { rows: Row[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'Ingen rader.' }, { status: 400 })
  }

  const db = supabaseAdmin()

  const [themes, collections, existing, count] = await Promise.all([
    db.from('themes').select('id,key'),
    db.from('collections').select('id,key'),
    db.from('designs').select('slug'),
    db.from('designs').select('id', { count: 'exact', head: true }),
  ])

  const themeId = new Map((themes.data ?? []).map((t) => [t.key, t.id]))
  const collId = new Map((collections.data ?? []).map((c) => [c.key, c.id]))
  const taken = new Set((existing.data ?? []).map((d) => d.slug))
  let bgIndex = count.count ?? 0

  const created: { id: string; slug: string; title: string }[] = []
  const failed: { title: string; reason: string }[] = []

  // Sequential on purpose: ten parallel Create Product calls is how you meet 429.
  for (const row of rows) {
    let designId: string | null = null
    try {
      if (!themeId.has(row.themeKey)) throw new Error(`Ukjent tema: ${row.themeKey}`)
      if (!collId.has(row.collectionKey)) throw new Error(`Ukjent kolleksjon: ${row.collectionKey}`)

      const slug = uniqueSlug(slugify(row.title), taken)
      taken.add(slug)

      const publishAt = row.schedule ? nextMorningOslo() : new Date().toISOString()

      const { data: colors } = await db.rpc('colors_for_contrast', { p: row.contrast })

      const { data: design, error: insertError } = await db
        .from('designs')
        .insert({
          slug,
          title: row.title.trim(),
          theme_id: themeId.get(row.themeKey),
          collection_id: collId.get(row.collectionKey),
          base_price: Math.round(row.price) * 100, // øre
          tile_bg: TILE_BGS[bgIndex++ % TILE_BGS.length],
          print_file_url: row.printPath,
          contrast: row.contrast,
          allowed_colors: colors,
          status: row.schedule ? 'scheduled' : 'published',
          published_at: publishAt,
          mockup_status: 'pending',
        })
        .select('id,slug')
        .single()

      if (insertError) throw new Error(insertError.message)
      designId = design.id

      const { error: variantError } = await db.rpc('generate_variants', { p_design: design.id })
      if (variantError) throw new Error(`generate_variants: ${variantError.message}`)

      // Gelato has to fetch the file, so it needs a URL — signed, not public.
      const { data: signed, error: signError } = await db.storage
        .from('print-files')
        .createSignedUrl(row.printPath, 60 * 60 * 24)
      if (signError || !signed) throw new Error('Kunne ikke signere trykkfilen')

      const product = await createProductFromTemplate({
        title: row.title.trim(),
        printFileUrl: signed.signedUrl,
        externalId: design.slug, // stable: a retry updates rather than duplicates
      })

      await db.from('designs').update({ gelato_product_id: product.id }).eq('id', design.id)

      created.push({ id: design.id, slug: design.slug, title: row.title })
    } catch (e: unknown) {
      // Roll this row back and keep going — one bad file must not kill a batch of ten.
      if (designId) await db.from('designs').delete().eq('id', designId)
      const reason =
        e instanceof GelatoError
          ? `Gelato ${e.status}${e.retryable ? ' (prøv igjen)' : ' — sjekk filen'}`
          : e instanceof Error
            ? e.message
            : 'Ukjent feil'
      failed.push({ title: row.title, reason })
    }
  }

  return NextResponse.json({ created, failed })
}

/** Tomorrow 08:00 Europe/Oslo, as UTC. */
function nextMorningOslo(): string {
  const now = new Date()
  const oslo = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }))
  const offset = now.getTime() - oslo.getTime()
  oslo.setDate(oslo.getDate() + 1)
  oslo.setHours(8, 0, 0, 0)
  return new Date(oslo.getTime() + offset).toISOString()
}
