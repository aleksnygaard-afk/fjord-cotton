import { supabaseAdmin } from '@/lib/supabase/server'
import AdminQueue from './AdminQueue'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const db = supabaseAdmin()

  const [themes, collections, published, colors] = await Promise.all([
    db.from('themes').select('key,name_no').order('name_no'),
    db.from('collections').select('key,name_no').order('sort_order'),
    db.from('designs').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('garment_colors').select('key,name_no,hex').order('sort_order'),
  ])

  return (
    <AdminQueue
      themes={themes.data ?? []}
      collections={collections.data ?? []}
      publishedCount={published.count ?? 0}
      colors={colors.data ?? []}
    />
  )
}
