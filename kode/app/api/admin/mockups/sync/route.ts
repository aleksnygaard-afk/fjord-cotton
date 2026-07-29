import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getProduct } from '@/lib/gelato'

/**
 * Copies Gelato mockups into our own bucket and flips designs to 'ready'.
 *
 * Two reasons this is a cron job rather than webhook work:
 *   1. Gelato's previewUrl expires after 24 hours, so the bytes must be copied — that is
 *      too slow to do inside a webhook handler.
 *   2. Webhooks get lost. Polling anything still 'pending' is the safety net.
 *
 * Schedule in vercel.json:  { "crons": [{ "path": "/api/admin/mockups/sync", "schedule": "*\/5 * * * *" }] }
 */
export async function GET(req: Request) {
  // Vercel Cron sends this header; a bare browser request must not trigger a sync.
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Not found', { status: 404 })
  }

  const db = supabaseAdmin()

  const { data: pending } = await db
    .from('designs')
    .select('id, slug, gelato_product_id')
    .eq('mockup_status', 'pending')
    .not('gelato_product_id', 'is', null)
    .limit(25)

  const done: string[] = []
  const stillWaiting: string[] = []
  const failed: { slug: string; reason: string }[] = []

  for (const design of pending ?? []) {
    try {
      const product = await getProduct(design.gelato_product_id!)

      if (product.status === 'publishing_error') {
        await db
          .from('designs')
          .update({ mockup_status: 'failed', mockup_error: product.publishingErrorCode })
          .eq('id', design.id)
        failed.push({ slug: design.slug, reason: product.publishingErrorCode ?? 'ukjent' })
        continue
      }

      if (product.status !== 'active' || !product.previewUrl) {
        stillWaiting.push(design.slug)
        continue
      }

      // Copy the bytes out before the signed URL expires.
      const image = await fetch(product.previewUrl)
      if (!image.ok) throw new Error(`previewUrl ga ${image.status}`)
      const bytes = await image.arrayBuffer()

      const primaryColor = await primaryColorFor(db, design.id)
      const path = `${design.slug}/${primaryColor.key}.jpg`

      const { error: uploadError } = await db.storage
        .from('mockups')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw new Error(uploadError.message)

      const { data: pub } = db.storage.from('mockups').getPublicUrl(path)

      await db.from('design_mockups').upsert(
        { design_id: design.id, color_id: primaryColor.id, url: pub.publicUrl, is_primary: true },
        { onConflict: 'design_id,color_id' }
      )

      // The template returns all six colours; make sure the tile shows one we sell.
      await db.rpc('repair_primary_mockup', { p_design: design.id })
      await db.from('designs').update({ mockup_status: 'ready', mockup_sync_due: false }).eq('id', design.id)

      done.push(design.slug)
    } catch (e) {
      stillWaiting.push(design.slug)
      console.error('mockup sync failed for', design.slug, e)
    }
  }

  return NextResponse.json({ done, stillWaiting, failed })
}

/**
 * Lowest sort_order colour this design is actually sold in — the tile image should never
 * be a colour the customer cannot buy.
 */
async function primaryColorFor(db: ReturnType<typeof supabaseAdmin>, designId: string) {
  const { data } = await db.rpc('design_colors', { p_design: designId })
  const first = (data ?? [])[0]
  if (!first) throw new Error('Designet har ingen aktive farger')

  const { data: color } = await db
    .from('garment_colors')
    .select('id,key')
    .eq('key', first.key)
    .single()
  if (!color) throw new Error(`Fant ikke fargen ${first.key}`)
  return color
}
