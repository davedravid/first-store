import { describe, expect, it } from "vitest";
import type { Storefront } from "@/lib/ai/schema";
import { contrast, THEMES, themeFor } from "./theme";

const sf = (niche: string, safety_topic: Storefront["creator"]["safety_topic"] = "none") =>
  ({ creator: { niche, safety_topic }, products: [], disclaimer: null }) as unknown as Storefront;
const input = (description: string) => ({ description, audience: "under_5k", language: "en" }) as const;

describe("accent colours", () => {
  it("every accent passes WCAG AA for white text, and accent text on its tint", () => {
    for (const t of Object.values(THEMES)) {
      expect(contrast("#ffffff", t.accent), `${t.name} white on accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accent, t.tint), `${t.name} accent on tint`).toBeGreaterThanOrEqual(4.5);
      expect(contrast("#ffffff", t.deep), `${t.name} white on deep`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses the model's topic and niche first, words only as backup", () => {
    expect(themeFor(sf("Budget college fashion"), input("Budget outfits and money saving thrift picks for college")).name).toBe("fashion");
    expect(themeFor(sf("Personal finance for freshers", "finance")).name).toBe("finance");
    expect(themeFor(sf("Tarot readings", "astrology")).name).toBe("astrology");
    expect(themeFor(sf("Home yoga for new moms", "health")).name).toBe("fitness");
    expect(themeFor(sf("Eggless kadai baking")).name).toBe("cooking");
    expect(themeFor(sf("UPSC answer writing")).name).toBe("exam");
    expect(themeFor(sf("Canva templates for shops")).name).toBe("design");
    expect(themeFor(sf("Life lessons"), input("I share life lessons")).name).toBe("default");
  });

  it("falls back to the creator's words before a store exists (loading screen)", () => {
    expect(themeFor(null, input("Main ghar pe eggless cakes banana sikhati hoon")).name).toBe("cooking");
    expect(themeFor(null, input("I post 15 minute home workouts for new moms")).name).toBe("fitness");
  });
});
