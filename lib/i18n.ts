/**
 * Lightweight message catalog with /no and /en routes (01-design-spec.md:
 * "Use next-intl or an equivalent message catalog … do not reproduce the
 * textContent hack"). Norwegian bokmål is the default.
 *
 * Strings are transcribed from the design prototype (Fjord & Cotton.dc.html),
 * keeping the Norwegian and the English (data-en) copy verbatim.
 */

export const locales = ["no", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "no";

export function isLocale(value: string | undefined): value is Locale {
  return value === "no" || value === "en";
}

/** A single message: either fixed per-locale, or a template taking a count. */
type Dict = typeof messages.no;

const messages = {
  no: {
    // Announcement bar
    annFreeShip: "Fri frakt over 599 kr",
    annPrinted: "Trykkes og sendes fra Norge",
    annReturn: "14 dagers angrerett",

    // Header
    navAll: "Alle design",
    navNew: "Nytt i dag",
    navCollections: "Kolleksjoner",
    searchPlaceholder: "Søk i arkivet",
    cart: "Handlekurv",

    // Home — hero
    heroIssue: "Utgave 01 — Sommer 2026",
    heroTitle: "Ti nye t-skjorter. Hver eneste dag.",
    heroBody:
      "Et arkiv som vokser hver dag med originale trykk — presset på tung kammet bomull og sendt i hele Norden på tre dager.",
    heroBrowse: "Se hele arkivet",
    heroToday: "Dagens ti",
    heroCaption: "hero — modell i skjorte, 1200×1500",

    // Home — trust bar
    trustPublished: (n: number) => `${n} design publisert`,
    trustSizes: "XS–3XL",
    trustColours: "6 skjortefarger",
    trustCotton: "Kammet bomull, 220 g",
    trustPay: "Vipps · Klarna · Kort",

    // Home — sections
    newToday: "Nytt i dag",
    allLink: (n: number) => `Alle ${n} →`,
    badgeNew: "Ny",
    valueProps: [
      {
        title: "Trykkes på bestilling",
        body: "Ingenting ligger på lager. Skjorta di presses samme dag du bestiller, så vi overproduserer aldri.",
      },
      {
        title: "Betal som du vil",
        body: "Vipps på to trykk, Klarna på fire delbetalinger, eller kort. Prisene inkluderer 25 % mva.",
      },
      {
        title: "Tre dager, dør til dør",
        body: "Posten og Bring leverer til hentepunkt i hele Norge, Sverige og Danmark.",
      },
    ],
    inSeason: "I sesong nå",
    seasonsHolidays: "Årstider og høytider",
    designCount: (n: number) => `${n} design`,

    // Catalog
    filterCollection: "Kolleksjon",
    filterTheme: "Tema",
    filterColour: "Farge",
    filterSize: "Størrelse",
    clearFilters: "Nullstill filtre",
    catalogArchive: "Arkivet",
    resultCount: (n: number) => `${n} design`,
    loadMore: "Last inn flere",
    emptyLine: "Ingen design i denne kolleksjonen ennå — kommer snart.",
    backToArchive: "Tilbake til arkivet",

    // Product
    breadcrumbArchive: "Arkiv",
    vatLine: "Inkl. 25 % mva · fri frakt over 599 kr",
    sizeGuide: "Størrelsesguide",
    addToCart: (price: string) => `Legg i handlekurv — ${price}`,
    buyVipps: "Hurtigkjøp med Vipps",
    addedToCart: "Lagt i handlekurv",
    productDesc:
      "220 g kammet bomull, unisex passform. Vannbasert DTG-trykk som holder seg mykt etter vask.",
    specDelivery: "Levering",
    specDeliveryValue: "2–4 virkedager",
    specReturns: "Retur",
    specReturnsValue: "14 dager, gratis",
    specPrinted: "Trykkes i",
    specPrintedValue: "Oslo",
    modelFront: "modell forfra",
    printDetail: "trykkdetalj",

    // Footer
    footerTagline:
      "Originale trykk på tung kammet bomull. Nye design publisert hver dag.",
    footerShop: "Butikk",
    footerService: "Kundeservice",
    footerContact: "Kontakt",
    footerSizeGuide: "Størrelsesguide",
    footerGiftCards: "Gavekort",
    footerShipping: "Frakt og levering",
    footerReturns: "Angrerett og retur",
    footerTerms: "Salgsbetingelser",
    footerPrivacy: "Personvern (GDPR)",
    footerHours: "Man–fre 09–16",

    // Cart
    cartTitle: "Handlekurv",
    cartEmpty: "Handlekurven er tom.",
    browseDesigns: "Se design",
    subtotal: "Delsum",
    shipping: "Frakt",
    vatOf: "herav mva (25 %)",
    vatOfShort: "herav mva",
    total: "Totalt",
    toCheckout: "Til kassen",
    remove: "Fjern",
    free: "Gratis",

    // Checkout
    checkoutTitle: "Kassen",
    secContact: "1 — Kontakt",
    secDelivery: "2 — Levering",
    secPayment: "3 — Betaling",
    orderSummary: "Ordre",
    phEmail: "E-post",
    phFirst: "Fornavn",
    phLast: "Etternavn",
    phStreet: "Gateadresse",
    phPostcode: "Postnummer",
    phCity: "Poststed",
    countries: [
      { code: "NO", name: "Norge" },
      { code: "SE", name: "Sverige" },
      { code: "DK", name: "Danmark" },
      { code: "FI", name: "Finland" },
    ],
    consent:
      "Jeg godtar salgsbetingelsene og har lest personvernerklæringen. Som forbruker har du 14 dagers angrerett etter angrerettloven.",
    payLabel: (total: string, method: string) =>
      `Betal ${total} · ${method}`,
    orderNote: "Sikker betaling. Priser inkluderer 25 % norsk mva.",
    formError: "Fyll ut alle feltene og godta vilkårene.",
    shipMethods: {
      pickup: { name: "Hentested — Posten", eta: "2–4 virkedager" },
      home: { name: "Hjem til døra — Bring", eta: "2–3 virkedager" },
      express: { name: "Ekspress — Bring 09:00", eta: "1 virkedag" },
    },
    payMethods: {
      vipps: { name: "Vipps", note: "Betal med telefonnummer", meta: "Anbefalt" },
      klarna: {
        name: "Klarna",
        note: "Del opp i 4 rentefrie betalinger",
        meta: "",
      },
      card: { name: "Kort", note: "Visa · Mastercard", meta: "" },
      wallet: {
        name: "Apple Pay / Google Pay",
        note: "Ett trykk i nettleseren",
        meta: "",
      },
    },

    // Checkout → payment
    payProcessing: "Sender deg til betaling …",
    payError: "Noe gikk galt. Prøv igjen.",

    // Confirmation
    confEyebrow: "Ordre bekreftet",
    confTitle: "Takk skal du ha.",
    confBody:
      "Kvitteringen er på vei til innboksen din. Vi presser skjorta i dag og leverer den til Bring i morgen tidlig.",
    confOrderNo: "Ordrenr. ",
    backToShop: "Tilbake til butikken",
    confProcessingEyebrow: "Behandler betaling",
    confProcessingTitle: "Et lite øyeblikk …",
    confProcessingBody:
      "Vi venter på bekreftelse fra betalingsleverandøren. Denne siden oppdaterer seg automatisk.",
    confNotFound: "Fant ikke ordren.",

    // Mock Dintero checkout (test mode)
    mockEyebrow: "Dintero — testmodus",
    mockTitle: "Simulert betaling",
    mockBody:
      "Ekte Dintero-betaling kobles til med testnøkler. Her kan du simulere resultatet.",
    mockPay: "Betal",
    mockCancel: "Avbryt",
    mockAmount: "Å betale",
  },

  en: {
    annFreeShip: "Free shipping over 599 kr",
    annPrinted: "Printed and shipped from Norway",
    annReturn: "14-day right of return",

    navAll: "All designs",
    navNew: "New today",
    navCollections: "Collections",
    searchPlaceholder: "Search the archive",
    cart: "Cart",

    heroIssue: "Issue 01 — Summer 2026",
    heroTitle: "Ten new shirts. Every single day.",
    heroBody:
      "An ever-growing archive of original prints — pressed on heavy combed cotton and shipped across the Nordics within three days.",
    heroBrowse: "Browse the archive",
    heroToday: "Today's ten",
    heroCaption: "hero — model wearing shirt, 1200×1500",

    trustPublished: (n: number) => `${n} designs published`,
    trustSizes: "XS–3XL",
    trustColours: "6 shirt colours",
    trustCotton: "Combed cotton, 220 g",
    trustPay: "Vipps · Klarna · Card",

    newToday: "New today",
    allLink: (n: number) => `All ${n} →`,
    badgeNew: "New",
    valueProps: [
      {
        title: "Printed on demand",
        body: "Nothing sits in a warehouse. Your shirt is pressed the day you order it, so we never overproduce.",
      },
      {
        title: "Pay the Norwegian way",
        body: "Vipps in two taps, Klarna in four instalments, or card. Prices include 25 % VAT.",
      },
      {
        title: "Three days, door to door",
        body: "Posten and Bring deliver to pick-up points across Norway, Sweden and Denmark.",
      },
    ],
    inSeason: "In season now",
    seasonsHolidays: "Seasons & holidays",
    designCount: (n: number) => `${n} designs`,

    filterCollection: "Collection",
    filterTheme: "Theme",
    filterColour: "Shirt colour",
    filterSize: "Size",
    clearFilters: "Clear all filters",
    catalogArchive: "The archive",
    resultCount: (n: number) => `${n} designs`,
    loadMore: "Load more",
    emptyLine: "No designs in this collection yet — coming soon.",
    backToArchive: "Back to the archive",

    breadcrumbArchive: "Archive",
    vatLine: "Incl. 25 % VAT · free shipping over 599 kr",
    sizeGuide: "Size guide",
    addToCart: (price: string) => `Add to cart — ${price}`,
    buyVipps: "Express checkout with Vipps",
    addedToCart: "Added to cart",
    productDesc:
      "220 g combed cotton, unisex fit. Water-based direct-to-garment print that stays soft after washing.",
    specDelivery: "Delivery",
    specDeliveryValue: "2–4 working days",
    specReturns: "Returns",
    specReturnsValue: "14 days, free",
    specPrinted: "Printed in",
    specPrintedValue: "Oslo",
    modelFront: "model front",
    printDetail: "print detail",

    footerTagline:
      "Original prints on heavy combed cotton. New designs published every day.",
    footerShop: "Shop",
    footerService: "Customer service",
    footerContact: "Contact",
    footerSizeGuide: "Size guide",
    footerGiftCards: "Gift cards",
    footerShipping: "Shipping & delivery",
    footerReturns: "Returns (angrerett)",
    footerTerms: "Terms of sale",
    footerPrivacy: "Privacy (GDPR)",
    footerHours: "Mon–Fri 09–16",

    // Cart
    cartTitle: "Cart",
    cartEmpty: "Your cart is empty.",
    browseDesigns: "Browse designs",
    subtotal: "Subtotal",
    shipping: "Shipping",
    vatOf: "of which VAT (25 %)",
    vatOfShort: "of which VAT",
    total: "Total",
    toCheckout: "Go to checkout",
    remove: "Remove",
    free: "Free",

    // Checkout
    checkoutTitle: "Checkout",
    secContact: "1 — Contact",
    secDelivery: "2 — Delivery",
    secPayment: "3 — Payment",
    orderSummary: "Order",
    phEmail: "Email",
    phFirst: "First name",
    phLast: "Last name",
    phStreet: "Street address",
    phPostcode: "Postcode",
    phCity: "City",
    countries: [
      { code: "NO", name: "Norway" },
      { code: "SE", name: "Sweden" },
      { code: "DK", name: "Denmark" },
      { code: "FI", name: "Finland" },
    ],
    consent:
      "I accept the terms of sale and have read the privacy policy. As a consumer you have a 14-day right of withdrawal under the Norwegian Right of Withdrawal Act.",
    payLabel: (total: string, method: string) => `Pay ${total} · ${method}`,
    orderNote: "Secure payment. Prices include 25 % Norwegian VAT.",
    formError: "Please fill in every field and accept the terms.",
    shipMethods: {
      pickup: { name: "Pick-up point — Posten", eta: "2–4 working days" },
      home: { name: "Home delivery — Bring", eta: "2–3 working days" },
      express: { name: "Express — Bring 09:00", eta: "1 working day" },
    },
    payMethods: {
      vipps: {
        name: "Vipps",
        note: "Pay with your phone number",
        meta: "Recommended",
      },
      klarna: {
        name: "Klarna",
        note: "Split into 4 interest-free payments",
        meta: "",
      },
      card: { name: "Card", note: "Visa · Mastercard", meta: "" },
      wallet: {
        name: "Apple Pay / Google Pay",
        note: "One tap in your browser",
        meta: "",
      },
    },

    // Checkout → payment
    payProcessing: "Taking you to payment …",
    payError: "Something went wrong. Please try again.",

    // Confirmation
    confEyebrow: "Order confirmed",
    confTitle: "Thank you.",
    confBody:
      "A receipt is on its way to your inbox. We press your shirt today and hand it to Bring tomorrow morning.",
    confOrderNo: "Order no. ",
    backToShop: "Back to the shop",
    confProcessingEyebrow: "Processing payment",
    confProcessingTitle: "One moment …",
    confProcessingBody:
      "We're waiting for confirmation from the payment provider. This page updates automatically.",
    confNotFound: "Order not found.",

    // Mock Dintero checkout (test mode)
    mockEyebrow: "Dintero — test mode",
    mockTitle: "Simulated payment",
    mockBody:
      "Real Dintero payment connects with test keys. Here you can simulate the outcome.",
    mockPay: "Pay",
    mockCancel: "Cancel",
    mockAmount: "To pay",
  },
} as const;

export function getDict(locale: Locale): Dict {
  // NO and EN share a structure but differ in string-literal types under
  // `as const`; the cast reconciles the union to the common Dict shape.
  return messages[locale] as unknown as Dict;
}

/** The label shown on the language toggle: the language you'd switch TO. */
export function otherLocaleLabel(locale: Locale): string {
  return locale === "no" ? "EN" : "NO";
}

/** Prefix a path with the active locale, e.g. ("no", "/katalog") → "/no/katalog". */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${clean === "/" ? "" : clean}`;
}
