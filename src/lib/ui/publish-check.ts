import type { CreatorInput, Storefront } from "../ai/schema";
import { priceBand, validateStorefront, type Category } from "../ai/validators";

/**
 * Gentle checks at publish time, for the creator's OWN edits. Same rules the AI's copy has to pass,
 * but here they only warn: it is the creator's page and the creator decides.
 * Not checked: numbers and names (the creator may add real facts about themself).
 */
const WARN: Partial<Record<Category, string>> = {
  hype_words: "sounds like hype or rules language",
  safe_claims: "reads like a promise or advice we cannot back up",
};

function place(where: string, sf: Storefront): string {
  const m = where.match(/^products\[(\d+)\](?:\.(\w+))?/);
  if (m) {
    const p = sf.products[Number(m[1])];
    const field = m[2] === "title" ? "title" : m[2] === "description" ? "description" : m[2] === "whats_inside" ? "points" : m[2] === "price_inr" ? "price" : "";
    return `${p ? `"${p.title}"` : "A product"}${field ? ` (${field})` : ""}`;
  }
  return { bio: "Your bio", tagline: "Your tagline", display_name: "Your name" }[where] ?? "Your page";
}

export function publishWarnings(input: CreatorInput, sf: Storefront): string[] {
  const { errors } = validateStorefront(input, sf, "report", { setName: false });
  const out = new Set<string>();
  for (const e of errors) {
    const what = WARN[e.category];
    if (!what) continue;
    const words = e.message.match(/(?:hype words: |\()([^)]+?)(?:\)|\. )/)?.[1];
    out.add(`${place(e.where, sf)} ${what}${words ? `: "${words}"` : ""}.`);
  }
  // Prices: only warn when outside the guide (any price inside it is fine, even off our price-point list).
  sf.products.forEach((p) => {
    const band = priceBand(p.format, input.audience, sf.creator.niche_type);
    if (p.price_inr < band.min || p.price_inr > band.max)
      out.add(`"${p.title}" is priced at ₹${p.price_inr.toLocaleString("en-IN")}, outside our guide of ₹${band.min.toLocaleString("en-IN")}-₹${band.max.toLocaleString("en-IN")}.`);
  });
  return [...out].slice(0, 6);
}
