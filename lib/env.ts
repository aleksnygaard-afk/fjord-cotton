/**
 * Centralised, validated access to server-side environment variables.
 * Throwing here (rather than deep inside a request) gives a clear error the
 * first time a route runs without its configuration.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get adminToken() {
    return required("ADMIN_TOKEN");
  },

  printBucket: process.env.SUPABASE_PRINT_BUCKET ?? "print-files",
  mockupBucket: process.env.SUPABASE_MOCKUP_BUCKET ?? "mockups",

  // VAT registration is pending — off until confirmed (05-norwegian-compliance.md).
  vatRegistered: process.env.VAT_REGISTERED === "true",

  // Launch Norway-only by default (05: simplest and correct). Enable the other
  // Nordic countries only once IOSS / destination VAT is handled.
  checkoutNordics: process.env.CHECKOUT_NORDICS === "true",

  // ── Stripe (03-api-and-payments.md) ──
  // Hosted Stripe Checkout. The secret key selects the environment: sk_test_… is
  // test mode, sk_live_… is live. Which payment methods appear (card, Klarna,
  // Apple/Google Pay) is configured in the Stripe dashboard, not here.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    // From the webhook endpoint in the dashboard (whsec_…). Without it the
    // webhook rejects every call, because an unverified body must never mark an
    // order paid.
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  },

  // Mock mode: simulate the hosted checkout locally, for working on the order →
  // paid → fulfilment flow without Stripe. Auto-on when the secret key is absent;
  // can be forced either way with STRIPE_MOCK.
  get stripeMock(): boolean {
    if (process.env.STRIPE_MOCK === "true") return true;
    if (process.env.STRIPE_MOCK === "false") return false;
    return !process.env.STRIPE_SECRET_KEY;
  },

  // ── Gelato (04-gelato-fulfilment.md) ──
  gelato: {
    apiKey: process.env.GELATO_API_KEY ?? "",
    webhookSecret: process.env.GELATO_WEBHOOK_SECRET ?? "",
  },
  // Mock Gelato: don't call the API; pretend the order was accepted. Auto-on when
  // GELATO_API_KEY is absent, or forced with GELATO_MOCK=true.
  get gelatoMock(): boolean {
    if (process.env.GELATO_MOCK === "true") return true;
    if (process.env.GELATO_MOCK === "false") return false;
    return !process.env.GELATO_API_KEY;
  },

  // Shared secret for the retry cron endpoint (/api/cron/gelato).
  cronSecret: process.env.CRON_SECRET ?? "",

  // ── Email / receipts (05-norwegian-compliance.md, step 6) ──
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    // Resend requires a verified sender domain.
    from: process.env.EMAIL_FROM ?? "Fjord & Cotton <kvittering@fjordcotton.no>",
    // Where Gelato manual-review / ops alerts go.
    opsAlert: process.env.OPS_ALERT_EMAIL ?? "hei@fjordcotton.no",
  },
  // Mock email: log instead of sending. Auto-on when RESEND_API_KEY is absent.
  get emailMock(): boolean {
    if (process.env.EMAIL_MOCK === "true") return true;
    if (process.env.EMAIL_MOCK === "false") return false;
    return !process.env.RESEND_API_KEY;
  },
};
