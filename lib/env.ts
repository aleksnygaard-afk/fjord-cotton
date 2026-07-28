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

  // ── Dintero (03-api-and-payments.md) ──
  dintero: {
    accountId: process.env.DINTERO_ACCOUNT_ID ?? "",
    clientId: process.env.DINTERO_CLIENT_ID ?? "",
    clientSecret: process.env.DINTERO_CLIENT_SECRET ?? "",
    profileId: process.env.DINTERO_PROFILE_ID ?? "",
    webhookSecret: process.env.DINTERO_WEBHOOK_SECRET ?? "",
  },

  // Mock mode: simulate the Dintero checkout locally (for building steps 4–5
  // before the real agreement/BankID onboarding is finished). Auto-on when the
  // Dintero credentials are absent; can be forced with DINTERO_MOCK=true.
  get dinteroMock(): boolean {
    if (process.env.DINTERO_MOCK === "true") return true;
    if (process.env.DINTERO_MOCK === "false") return false;
    return !(
      process.env.DINTERO_ACCOUNT_ID &&
      process.env.DINTERO_CLIENT_ID &&
      process.env.DINTERO_CLIENT_SECRET &&
      process.env.DINTERO_PROFILE_ID
    );
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
