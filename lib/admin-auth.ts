import { timingSafeEqual } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Two ways to reach the admin API:
 *
 *   1. A signed-in browser session (Supabase Auth magic link) — the admin UI.
 *   2. The x-admin-token shared secret — scripts and cron.
 *
 * The token path is the original interim guard and stays for automation. The
 * session path is what the README called for before go-live.
 */

/** Shared-secret check. Constant time, fails closed when ADMIN_TOKEN is unset. */
export function isAuthorizedAdmin(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const provided = request.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** True when the request carries a valid Supabase session cookie. */
export async function hasAdminSession(): Promise<boolean> {
  try {
    const store = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => store.getAll(),
          setAll: () => {
            /* read-only here; the middleware refreshes the session */
          },
        },
      },
    );
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) return false;

    // Signups are disabled in Supabase, but an allowlist means a leaked invite
    // still cannot publish to the shop.
    const allowed = (process.env.ADMIN_EMAILS ?? "hei@fjordcotton.no")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return allowed.includes(data.user.email.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Use this in every /api/admin route. Session first (the UI), token second
 * (automation).
 */
export async function isAdmin(request: Request): Promise<boolean> {
  if (await hasAdminSession()) return true;
  return isAuthorizedAdmin(request);
}
