import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Gelato does not sign webhook payloads, so the only defence is a secret in the path.
 * Anything that does not match gets a 404 — not a 401, which would confirm the path exists.
 *
 * Respond 2xx fast. Gelato retries 3 times, 5 seconds apart, then drops the event forever.
 * So: record it, return 200, let the cron job do the work.
 */
export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  if (!process.env.GELATO_WEBHOOK_SECRET || secret !== process.env.GELATO_WEBHOOK_SECRET) {
    return new NextResponse('Not found', { status: 404 })
  }

  let event: any
  try {
    event = await req.json()
  } catch {
    return NextResponse.json({ ok: true }) // malformed body: swallow, do not make Gelato retry
  }

  const db = supabaseAdmin()

  // Events are unordered and can duplicate. The event id is the idempotency key.
  const { error: dupe } = await db
    .from('gelato_events')
    .insert({ event_id: event.id, event_type: event.event, payload: event })
  if (dupe?.code === '23505') return NextResponse.json({ ok: true, duplicate: true })

  try {
    switch (event.event) {
      case 'store_product_updated':
      case 'store_product_created':
        // Mark it for the sync job. We do not download the image here — a slow handler
        // burns Gelato's three attempts and the event is lost.
        if (event.storeProductId) {
          await db
            .from('designs')
            .update({ mockup_sync_due: true })
            .eq('gelato_product_id', event.storeProductId)
        }
        break

      case 'order_status_updated':
        await db
          .from('orders')
          .update({ gelato_status: event.fulfillmentStatus })
          .eq('order_no', event.orderReferenceId)
        break

      case 'order_item_tracking_code_updated':
        await db
          .from('orders')
          .update({
            tracking_code: event.trackingCode,
            tracking_url: event.trackingUrl,
            gelato_status: 'shipped',
          })
          .eq('order_no', event.orderReferenceId)
        break

      case 'order_item_status_updated':
        // 'failed' or a rejection comment means a paid order will never be printed.
        if (event.status === 'failed' || event.status === 'canceled') {
          await db
            .from('orders')
            .update({ needs_review: true, review_note: event.comment ?? event.status })
            .eq('order_no', event.orderReferenceId)
        }
        break
    }
  } catch (e) {
    // Never fail the response: the row is stored, the cron job can pick it up.
    console.error('gelato webhook handling failed', e)
  }

  return NextResponse.json({ ok: true })
}
