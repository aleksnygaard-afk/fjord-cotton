import type { MetadataRoute } from "next";

/**
 * robots.txt. Storefront (home, catalog, product, legal) is crawlable — SSR is
 * there for SEO on thousands of product pages (README). Admin, API and the
 * transactional pages (checkout, payment, order confirmation) are excluded.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/no/kasse",
          "/en/kasse",
          "/no/handlekurv",
          "/en/handlekurv",
          "/no/betaling/",
          "/en/betaling/",
          "/no/ordre/",
          "/en/ordre/",
        ],
      },
    ],
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
