import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/** Session-aware client for server components and route handlers. */
export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {
            // Called from a server component — Next forbids writing cookies there.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    }
  )
}

/** Service-role client. Bypasses RLS — never import this into a client component. */
export function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/** Throws unless the caller has a valid session. Every /api/admin route calls this. */
export async function requireAdmin() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Response('Unauthorized', { status: 401 })
  return user
}
