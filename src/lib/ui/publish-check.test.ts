import { describe, expect, it } from "vitest";
import fx from "../../../tests/ui/fixture.json";
import type { CreatorInput, Storefront } from "../ai/schema";
import { publishWarnings } from "./publish-check";

const input = fx.input as CreatorInput;
const store = () => structuredClone(fx.storefront) as Storefront;

describe("publish warnings for the creator's own edits", () => {
  it("is quiet for a clean page", () => {
    const s = store();
    s.products[1].whats_inside = s.products[1].whats_inside.map((w) => w.replace(" with photos", ""));
    expect(publishWarnings(input, s)).toEqual([]);
  });
  it("warns on hype, unsafe claims and a price far outside the guide, never blocks", () => {
    const s = store();
    s.creator.tagline = "The ultimate yoga plan";
    s.products[0].description = "Guaranteed weight loss in a week for new moms.";
    s.products[1].price_inr = 4999;
    const w = publishWarnings(input, s);
    expect(w.some((x) => x.startsWith("Your tagline") && x.includes("ultimate"))).toBe(true);
    expect(w.some((x) => x.includes("promise or advice"))).toBe(true);
    expect(w.some((x) => x.includes("₹4,999") && x.includes("outside our guide"))).toBe(true);
  });
  it("allows any price inside the guide, even one we would not pick", () => {
    const s = store();
    s.products[1].price_inr = 350; // inside 199-499, not on our price-point list
    s.products[1].whats_inside = s.products[1].whats_inside.map((w) => w.replace(" with photos", ""));
    expect(publishWarnings(input, s)).toEqual([]);
  });
});
