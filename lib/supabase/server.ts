import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Service-role Supabase client for server-only use (API routes, jobs).
 * Bypasses Row Level Security, so it must NEVER be imported into client code.
 * All catalog writes and order access go through this client (02/03).
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Session-aware client for the admin login flow (magic link). Reads and writes
 * the Supabase auth cookies, so it must not be cached across requests — unlike
 * supabaseAdmin() above, which is stateless.
 *
 * Runs with the anon key and Row Level Security, so it is only for auth: use
 * supabaseAdmin() for catalog and order work.
 */
export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(
    env.supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            // Called from a server component — Next forbids writing cookies
            // there. The middleware refreshes the session, so this is safe.
          }
        },
      },
    },
  );
}
