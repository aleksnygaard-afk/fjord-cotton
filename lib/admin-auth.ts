import { timingSafeEqual } from "node:crypto";

/**
 * Interim guard for the admin routes until real authentication is added
 * (README build order: admin publishing is service-role work). The client sends
 * the shared secret as `x-admin-token`; we compare it in constant time.
 *
 * Fails closed: if ADMIN_TOKEN is not configured we deny every request rather
 * than throw, so an unconfigured server returns a clean 401 (not a 500 that
 * leaks the misconfiguration).
 *
 * This is deliberately minimal. Before go-live, replace with Supabase Auth +
 * an admin role check.
 */
export function isAuthorizedAdmin(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const provided = request.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
