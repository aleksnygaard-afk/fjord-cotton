import "server-only";
import { env } from "@/lib/env";

/**
 * Minimal Dintero Checkout client (03-api-and-payments.md). Test and production
 * share the host; the account id (test ids look like `T12345678`) selects the
 * environment. Onboarding needs org.nr, BankID and a live terms/privacy page —
 * until that is done, run in mock mode (see lib/env.ts `dinteroMock`).
 *
 * NOTE: the exact request/response shapes should be reconfirmed against the
 * current Dintero API docs during onboarding; the flow and fields here follow
 * the handoff. Untested against the live API in this build environment.
 */

const BASE = "https://checkout.dintero.com/v1";

let tokenCache: { token: string; expiresAt: number } | null = null;

export function dinteroConfigured(): boolean {
  const d = env.dintero;
  return Boolean(d.accountId && d.clientId && d.clientSecret && d.profileId);
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) {
    return tokenCache.token;
  }
  const { accountId, clientId, clientSecret } = env.dintero;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${BASE}/accounts/${accountId}/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      audience: `${BASE}/accounts/${accountId}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Dintero auth failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 600) * 1000,
  };
  return json.access_token;
}

export type DinteroSession = { id: string; url: string };

export async function createSession(
  // The session `order`/`url`/`configuration` payload, built by the route.
  payload: Record<string, unknown>,
): Promise<DinteroSession> {
  const token = await getToken();
  const res = await fetch(`${BASE}/sessions-profile`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, profile_id: env.dintero.profileId }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Dintero session failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as DinteroSession;
  return json;
}

export type DinteroTransaction = {
  id: string;
  amount: number;
  status: string;
  merchant_reference?: string;
};

/**
 * Fetch a transaction to confirm status/amount authoritatively, rather than
 * trusting the webhook body. Used by the webhook in real mode.
 */
export async function getTransaction(id: string): Promise<DinteroTransaction> {
  const token = await getToken();
  const res = await fetch(
    `${BASE}/accounts/${env.dintero.accountId}/transactions/${id}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(
      `Dintero transaction fetch failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as DinteroTransaction;
}

/** Map our internal payment method to a Dintero `default_payment_type`. */
export function dinteroPaymentType(method: string): string | undefined {
  switch (method) {
    case "vipps":
      return "vipps";
    case "klarna":
      return "klarna";
    case "card":
      return "payex.creditcard";
    case "wallet":
      // Apple/Google Pay ride along with the card option.
      return "payex.creditcard";
    default:
      return undefined;
  }
}
