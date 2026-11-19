import { describe, expect, it } from "vitest";
import type { CreatorInput, Storefront } from "./schema";
import { inventedNumbers, numbersInInput, priceBand, snapPrice, validateStorefront } from "./validators";

const input = (over: Partial<CreatorInput> = {}): CreatorInput => ({
  description: "I share 15 minute home workouts for busy moms",
  audience: "5k_25k",
  language: "en",
  ...over,
});

const page = (): Storefront => ({
  creator: {
    display_name: "Riya",
    niche: "Home fitness for moms",
    niche_type: "lifestyle",
    tagline: "Short home workouts that fit a mom's day",
    bio: "I am Riya. I share short home workouts for busy moms who have no time for the gym. Everything I post can be done in the living room with no equipment, and I keep it simple and kind.",
    language: "en",
  },
  products: [
    { id: "p1", format: "checklist", tier: "starter", title: "Weekly workout checklist", description: "A one-page weekly plan you can stick on the fridge and tick off as you go through the week.", whats_inside: ["A 5-day plan", "Warm-up list", "Rest day tips"], price_inr: 149, price_rationale: "A small first price so followers can try my style", effort_to_create: "weekend" },
    { id: "p2", format: "ebook_guide", tier: "core", title: "Home workout guide", description: "A short guide with the routines I use myself, with pictures and easy swaps for bad knees.", whats_inside: ["12 routines", "Swaps for knees", "A simple meal list"], price_inr: 399, price_rationale: "Priced like a book, for people who want the full plan", effort_to_create: "one_week" },
    { id: "p3", format: "call_package", tier: "premium", title: "Three check-in calls", description: "Three calls over a month where we set a plan that fits your day and adjust it as you go.", whats_inside: ["3 calls of 30 min", "A plan made for you", "WhatsApp check-ins"], price_inr: 1999, price_rationale: "Personal time with me, so it is the top of the range", effort_to_create: "weekend" },
  ],
});

describe("price bands", () => {
  it("snaps to the nearest allowed price point", () => {
    expect(snapPrice(520, { min: 99, max: 999 })).toBe(499);
    expect(snapPrice(5, { min: 99, max: 499 })).toBe(99);
    expect(snapPrice(100000, { min: 1499, max: 4999 })).toBe(4999);
  });

  it("caps a lifestyle ebook under 25K at 499", () => {
    expect(priceBand("ebook_guide", "5k_25k", "lifestyle").max).toBeLessThanOrEqual(499);
  });

  it("puts just-starting creators in the lower half and 25K+ in the upper half", () => {
    expect(priceBand("short_course", "just_starting", "expert").max).toBeLessThan(2999);
    expect(priceBand("short_course", "25k_100k_plus", "expert").min).toBeGreaterThan(499);
  });

  it("gives career_exam niches the upper half one step earlier", () => {
    expect(priceBand("ebook_guide", "5k_25k", "career_exam").min).toBeGreaterThan(priceBand("ebook_guide", "5k_25k", "expert").min);
  });
});

describe("validateStorefront", () => {
  it("passes a clean page", () => {
    const r = validateStorefront(input(), page());
    expect(r.errors).toEqual([]);
  });

  it("fixes an out-of-band price in enforce mode but only reports it in report mode", () => {
    const p = page();
    p.products[1].price_inr = 2500;
    expect(validateStorefront(input(), p, "report").finalChecks.price_in_band).toBe(false);
    const r = validateStorefront(input(), p, "enforce");
    expect(r.modelChecks.price_in_band).toBe(false);
    expect(r.finalChecks.price_in_band).toBe(true);
    expect(r.storefront.products[1].price_inr).toBe(499);
  });

  it("fixes tier order by re-pricing", () => {
    const p = page();
    p.products[0] = { ...p.products[0], format: "call_1on1", price_inr: 999 };
    const r = validateStorefront(input({ audience: "25k_100k_plus" }), p);
    const [starter, core, premium] = r.storefront.products;
    expect(starter.price_inr).toBeLessThan(core.price_inr);
    expect(core.price_inr).toBeLessThan(premium.price_inr);
    expect(r.finalChecks.tier_order).toBe(true);
  });

  it("rejects a single call as Premium", () => {
    const p = page();
    p.products[2].format = "call_1on1";
    expect(validateStorefront(input(), p).finalChecks.ladder).toBe(false);
  });

  it("flags repeated formats", () => {
    const p = page();
    p.products[1].format = "checklist";
    p.products[1].tier = "starter";
    expect(validateStorefront(input(), p).finalChecks.distinct_formats).toBe(false);
  });

  it("flags hype words and unsafe claims", () => {
    const p = page();
    p.creator.tagline = "The ultimate plan to cure diabetes";
    const r = validateStorefront(input(), p);
    expect(r.finalChecks.hype_words).toBe(false);
    expect(r.finalChecks.safe_claims).toBe(false);
  });

  it("flags a rupee amount or number in the price rationale", () => {
    const p = page();
    p.products[0].price_rationale = "At ₹149 it is cheaper than a coffee";
    expect(validateStorefront(input(), p).finalChecks.rationale).toBe(false);
  });

  it("flags Devanagari in the output", () => {
    const p = page();
    p.creator.tagline = "घर पर वर्कआउट for busy moms";
    expect(validateStorefront(input(), p).finalChecks.script).toBe(false);
  });
});

describe("invented numbers", () => {
  const allowed = numbersInInput(input());
  it("flags an invented claim", () => {
    expect(inventedNumbers("Join 10,000+ students who changed their life", allowed)).toHaveLength(1);
    expect(inventedNumbers("Trusted by 2 lakh followers", allowed)).toHaveLength(1);
    expect(inventedNumbers("I have 8 years of experience", allowed)).toHaveLength(1);
    expect(inventedNumbers("95% of my clients lost weight", allowed)).toHaveLength(1);
  });
  it("allows product-shape counts and numbers from the input", () => {
    expect(inventedNumbers("3 calls of 30 min each", allowed)).toEqual([]);
    expect(inventedNumbers("A 7-day plan with 5 workouts", allowed)).toEqual([]);
    expect(inventedNumbers("A 30-day plan", allowed)).toEqual([]);
    expect(inventedNumbers("My 15 minute workouts", allowed)).toEqual([]);
    expect(inventedNumbers("Three 30‑minute calls", allowed)).toEqual([]);
  });
  it("still flags a claim with describing words in between", () => {
    expect(inventedNumbers("Loved by 10,000 happy students", allowed)).toHaveLength(1);
    expect(inventedNumbers("Over 500 satisfied clients", allowed)).toHaveLength(1);
  });
  it("flags content counts the creator never promised", () => {
    expect(inventedNumbers("50+ maths tricks with solved examples", allowed)).toHaveLength(1);
    expect(inventedNumbers("20 full-body yoga sequences", allowed)).toHaveLength(1);
  });
});
