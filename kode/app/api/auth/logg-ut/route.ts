import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

export async function GET(req: Request) {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', req.url))
}
