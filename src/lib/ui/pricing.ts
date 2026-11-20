import type { CreatorInput, Product, Storefront } from "@/lib/ai/schema";
import { AUDIENCE_PHRASE, buildRationale, FORMAT_SINGULAR, priceBand, stepPrice } from "@/lib/ai/validators";

export const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function bandFor(input: CreatorInput, sf: Storefront, p: Product) {
  return priceBand(p.format, input.audience, sf.creator.niche_type);
}

/** Can "Cheaper" (-1) or "More premium" (+1) still move this price? Checked in code, before any model call. */
export function canStep(input: CreatorInput, sf: Storefront, p: Product, dir: 1 | -1): boolean {
  const next = stepPrice(p.price_inr, bandFor(input, sf, p), dir);
  return dir < 0 ? next < p.price_inr : next > p.price_inr;
}

function withArticle(word: string) {
  if (word === "notes") return "notes";
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

export function stepLimitMessage(p: Product, dir: 1 | -1): string {
  const thing = withArticle(FORMAT_SINGULAR[p.format]);
  return dir < 0
    ? `This is already the lowest price we'd suggest for ${thing}. You can still type your own price.`
    : `This is already the highest price we'd suggest for ${thing} at your audience size. You can still type your own price.`;
}

/** A gentle note when the creator's own price is outside our guide. Never blocks them. */
export function priceNote(input: CreatorInput, sf: Storefront, p: Product): string | null {
  const band = bandFor(input, sf, p);
  const range = band.min === band.max ? rs(band.min) : `${rs(band.min)}-${rs(band.max)}`;
  const who = AUDIENCE_PHRASE[input.audience];
  if (p.price_inr < band.min)
    return `Heads up: our guide for ${who} is ${range}. A lower price is fine if it's on purpose, like a launch offer.`;
  if (p.price_inr > band.max)
    return p.price_inr > band.max * 2
      ? `Heads up: this is well above our guide of ${range} for ${who}. Followers may hesitate on a first buy.`
      : `Heads up: this is above our guide of ${range} for ${who}. Fine if your followers already trust you.`;
  return null;
}

/** "Why this price" when the creator set the price: keep the guide sentence, never claim we picked it. */
export function creatorRationale(input: CreatorInput, sf: Storefront, index: number): string {
  const guide = buildRationale(input, sf, index).replace(/\s*We picked .*$/, "");
  return `${guide} You set ${rs(sf.products[index].price_inr)}.`;
}
