import Link from "next/link";
import { formatKr } from "@/lib/money";
import { localePath, type Locale } from "@/lib/i18n";
import { pickName, pickTitle, type DesignCard } from "@/lib/catalog-format";

/**
 * A catalog / home product tile (01-design-spec.md §2–3). Isomorphic: no hooks,
 * so it renders from both server pages and the client "Last inn flere" list.
 * Shows the generated mockup when present, else the prototype's striped
 * placeholder with the slug caption.
 */
export function ProductTile({
  card,
  locale,
  newBadge,
}: {
  card: DesignCard;
  locale: Locale;
  newBadge?: string;
}) {
  const title = pickTitle(card, locale);
  const theme = pickName(card.theme, locale);

  return (
    <Link
      href={localePath(locale, `/design/${card.slug}`)}
      style={{ display: "block", cursor: "pointer" }}
    >
      <div
        style={{
          aspectRatio: "4 / 5",
          background: card.tileBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {card.mockupUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.mockupUrl}
            alt={title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "52%",
              aspectRatio: "1",
              background:
                "repeating-linear-gradient(45deg,rgba(22,21,15,0.13) 0 7px,transparent 7px 14px)",
              border: "1px solid rgba(22,21,15,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "#4a4535",
              }}
            >
              {card.slug}
            </span>
          </div>
        )}
        {newBadge && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: "var(--ink)",
              color: "var(--bg)",
              padding: "4px 8px",
            }}
          >
            {newBadge}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          marginTop: 12,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 19,
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        <span
          style={{ color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap" }}
        >
          {formatKr(card.basePrice)}
        </span>
      </div>
      {theme && (
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--faint)",
            marginTop: 4,
          }}
        >
          {theme}
        </div>
      )}
    </Link>
  );
}
