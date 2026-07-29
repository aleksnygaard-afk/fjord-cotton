import { NextResponse } from 'next/server'
import { requireAdmin, supabaseAdmin } from '@/lib/supabase'
import { slugify } from '@/lib/slug'

/**
 * Returns one signed upload URL per file. The browser uploads straight to Storage —
 * a 20 MB PNG through a Vercel function hits the body-size limit.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch (r) {
    return r as Response
  }

  const { files } = (await req.json()) as { files: { name: string; size: number }[] }
  if (!Array.isArray(files) || files.length === 0 || files.length > 30) {
    return NextResponse.json({ error: 'Send mellom 1 og 30 filer.' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const stamp = new Date().toISOString().slice(0, 10)
  const out = []

  for (const file of files) {
    if (file.size > 40 * 1024 * 1024) {
      return NextResponse.json({ error: `${file.name} er over 40 MB.` }, { status: 400 })
    }
    const path = `${stamp}/${crypto.randomUUID()}-${slugify(file.name.replace(/\.png$/i, ''))}.png`
    const { data, error } = await db.storage.from('print-files').createSignedUploadUrl(path)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    out.push({ name: file.name, path, token: data.token })
  }

  return NextResponse.json({ uploads: out })
}
