import { ImageResponse } from "next/og";
import { getPublicStore } from "@/lib/public-store";
import { themeFor } from "@/lib/ui/theme";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A creator store made with First Store";

/** The preview card WhatsApp and Instagram show when the link is shared. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getPublicStore(slug);
  const sf = s?.storefront;
  const t = themeFor(sf ?? null);
  const name = sf?.creator.display_name ?? "First Store";
  const initials = name.replace(/^@/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "★";
  const from = sf ? Math.min(...sf.products.map((p) => p.price_inr)) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: `linear-gradient(135deg, ${t.accent}, ${t.deep})`, padding: 72, color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div style={{ width: 160, height: 160, borderRadius: 80, background: t.tint, color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, fontWeight: 800 }}>{initials}</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
            <div style={{ fontSize: 36, opacity: 0.9, marginTop: 12, maxWidth: 820 }}>{sf?.creator.tagline ?? ""}</div>
          </div>
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {(sf?.products ?? []).slice(0, 3).map((p) => (
            <div key={p.id} style={{ display: "flex", background: "rgba(255,255,255,0.16)", borderRadius: 999, padding: "14px 26px", fontSize: 28 }}>
              {p.title.length > 34 ? `${p.title.slice(0, 33)}…` : p.title}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, fontSize: 28, opacity: 0.85 }}>
          <span>{from ? `${sf!.products.length} products from ₹${from}` : ""}</span>
          <span>First Store</span>
        </div>
      </div>
    ),
    size,
  );
}
