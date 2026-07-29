import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase'

/** Magic-link landing point. Exchanges the code for a session cookie, then redirects. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const neste = req.nextUrl.searchParams.get('neste') ?? '/admin'

  if (!code) return NextResponse.redirect(new URL('/logg-inn', req.url))

  const supabase = await supabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/logg-inn?feil=1', req.url))

  return NextResponse.redirect(new URL(neste, req.url))
}
