import { describe, expect, it } from "vitest";
import { precheck } from "./precheck";
import type { CreatorInput, Draft } from "./schema";
import { inventedNumbers, numbersInInput, priceBand, snapPrice, validateStorefront } from "./validators";

const input = (over: Partial<CreatorInput> = {}): CreatorInput => ({
  description: "I share 15 minute home workouts for busy moms",
  audience: "5k_25k",
  language: "en",
  ...over,
});

const page = (): Draft => ({
  creator: {
    display_name: "Home Workouts for Moms",
    niche: "Home fitness for moms",
    niche_type: "lifestyle",
    safety_topic: "health",
    tagline: "Short home workouts that fit a mom's day",
    bio: "I share short home workouts for busy moms who have no time for the gym. Everything I post can be done in the living room with no equipment, and I keep it simple and kind.",
    language: "en",
  },
  products: [
    { id: "p1", format: "checklist", tier: "starter", title: "Weekly workout checklist", description: "A one-page weekly plan you can stick on the fridge and tick off as you go through the week.", whats_inside: ["A 5-day plan", "Warm-up list", "Rest day tips"], price_inr: 149, effort_to_create: "weekend" },
    { id: "p2", format: "ebook_guide", tier: "core", title: "Home workout guide", description: "A short guide with the routines I use myself, with easy swaps for bad knees.", whats_inside: ["12 routines", "Swaps for knees", "A simple meal list"], price_inr: 399, effort_to_create: "one_week" },
    { id: "p3", format: "call_package", tier: "premium", title: "Three check-in calls", description: "Three calls over a month where we set a plan that fits your day and adjust it as you go.", whats_inside: ["3 calls of 30 min", "A plan made for you", "Adjustments each call"], price_inr: 1999, effort_to_create: "weekend" },
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
    expect(validateStorefront(input(), page()).errors).toEqual([]);
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

  it("flags compliance language in the copy", () => {
    const p = page();
    p.creator.bio += " All of it without any regulatory claims.";
    expect(validateStorefront(input(), p).finalChecks.hype_words).toBe(false);
  });

  it("flags Devanagari in the output", () => {
    const p = page();
    p.creator.tagline = "घर पर वर्कआउट for busy moms";
    expect(validateStorefront(input(), p).finalChecks.script).toBe(false);
  });
});

describe("code-written price rationale and disclaimer", () => {
  it("builds the rationale from the FINAL price, the band and the starter price", () => {
    const p = page();
    p.products[1].price_inr = 2500; // code snaps this to 499
    const core = validateStorefront(input(), p).storefront.products[1];
    expect(core.price_rationale).toBe(
      "Our price guide puts ebooks and guides from creators with 5-25K followers at ₹199-₹499. We picked ₹499 so it's a step up from your ₹149 starter.",
    );
  });

  it("adds the right disclaimer per topic, and none for other topics", () => {
    expect(validateStorefront(input(), page()).storefront.disclaimer).toBe("Not medical advice.");
    const fin = page();
    fin.creator.safety_topic = "finance";
    expect(validateStorefront(input(), fin).storefront.disclaimer).toBe("Educational content only. Not investment advice.");
    const astro = page();
    astro.creator.safety_topic = "astrology";
    expect(validateStorefront(input(), astro).storefront.disclaimer).toBe("For guidance only; no guaranteed outcomes.");
    const other = page();
    other.creator.safety_topic = "none";
    other.creator.niche = "Budget college fashion";
    expect(validateStorefront(input({ description: "Budget outfits and thrift picks for college students" }), other).storefront.disclaimer).toBeNull();
  });

  it("catches a finance topic the model missed, from the creator's own words", () => {
    const p = page();
    p.creator.safety_topic = "none";
    const r = validateStorefront(input({ description: "I trade options daily and teach intraday basics" }), p);
    expect(r.storefront.disclaimer).toBe("Educational content only. Not investment advice.");
  });
});

describe("finance advice", () => {
  it("flags personalised trading advice on finance pages", () => {
    const p = page();
    p.creator.safety_topic = "finance";
    p.products[0].description = "Send me your chart and I will DM a concise analysis of your setup and your next move.";
    expect(validateStorefront(input(), p).finalChecks.safe_claims).toBe(false);
  });
  it("flags reworded personalised advice that the phrase list misses", () => {
    const p = page();
    p.creator.safety_topic = "finance";
    p.products[2].whats_inside = ["One-on-one review of your current approach", "Tailored suggestions for strategy improvement", "Actionable steps"];
    expect(validateStorefront(input(), p).finalChecks.safe_claims).toBe(false);
  });
  it("flags daily trade ideas and reviews of the buyer's own trades", () => {
    for (const text of ["A daily heads-up on market setups and the logic behind them", "Live review of your recent trades", "One-line summary of the day's key options setup"]) {
      const p = page();
      p.creator.safety_topic = "finance";
      p.products[0].description = text + " for learners.";
      expect(validateStorefront(input(), p).finalChecks.safe_claims).toBe(false);
    }
  });
  it("allows plain finance education", () => {
    const p = page();
    p.creator.safety_topic = "finance";
    p.products[0].description = "A guide to how options pricing works, the Greeks and how to size risk, with worked examples.";
    expect(validateStorefront(input(), p).finalChecks.safe_claims).toBe(true);
  });
  it("flags 'No financial advice' as rule language", () => {
    const p = page();
    p.creator.bio += " No financial advice, just clear education.";
    expect(validateStorefront(input(), p).finalChecks.hype_words).toBe(false);
  });
  it("does not flag 'picks' on a non-finance page", () => {
    const p = page();
    p.creator.safety_topic = "none";
    p.products[0].description = "My favourite thrift picks for the week, with where to find them in your city.";
    expect(validateStorefront(input({ description: "Budget outfits and thrift picks for college students" }), p).finalChecks.safe_claims).toBe(true);
  });
});

describe("names", () => {
  it("uses the typed name, else the @handle, as the display name", () => {
    expect(validateStorefront(input({ name: "Priya" }), page()).storefront.creator.display_name).toBe("Priya");
    expect(validateStorefront(input({ handle: "rahul.lifts" }), page()).storefront.creator.display_name).toBe("@rahul.lifts");
  });
  it("flags a name in the bio that the creator never gave", () => {
    const p = page();
    p.creator.bio = "Hi, I'm Anu. " + p.creator.bio;
    expect(validateStorefront(input({ handle: "@bakewithanu" }), p).finalChecks.invented_facts).toBe(false);
  });
  it("allows a name the creator typed, or one that is a whole word in their handle", () => {
    const p = page();
    p.creator.bio = "I'm Rahul. " + p.creator.bio;
    expect(validateStorefront(input({ handle: "@rahul.lifts" }), p).finalChecks.invented_facts).toBe(true);
    expect(validateStorefront(input({ name: "Rahul" }), p).finalChecks.invented_facts).toBe(true);
  });
  it("does not treat a city after 'Main' as a name", () => {
    const p = page();
    p.creator.bio = "Main Delhi ka gym trainer hoon. " + p.creator.bio;
    expect(validateStorefront(input({ description: "Main Delhi ka gym trainer hoon, beginners ko sikhata hoon" }), p).finalChecks.invented_facts).toBe(true);
  });
  it("flags a placeholder or someone else's handle", () => {
    const p = page();
    p.creator.display_name = "Options Trading with @handle";
    expect(validateStorefront(input(), p).finalChecks.invented_facts).toBe(false);
    const q = page();
    q.creator.bio += " Follow @rahul.lifts for more.";
    expect(validateStorefront(input({ handle: "@rahul.lifts" }), q).finalChecks.invented_facts).toBe(true);
  });
  it("flags an invented person-like display name when there is no name or handle", () => {
    const p = page();
    p.creator.display_name = "Meera";
    expect(validateStorefront(input(), p).finalChecks.invented_facts).toBe(false);
  });
});

describe("consistency", () => {
  it("flags a title and description that disagree on length", () => {
    const p = page();
    p.products[2].title = "3-Month Coaching Package";
    p.products[2].description = "Teen weeks ke liye 3 calls where we review your plan and adjust it.";
    expect(validateStorefront(input(), p).finalChecks.consistency).toBe(false);
  });
  it("passes when they agree", () => {
    const p = page();
    p.products[2].title = "3-Month Coaching Package";
    p.products[2].description = "Three months of calls where we review your plan and adjust it as you go.";
    expect(validateStorefront(input(), p).finalChecks.consistency).toBe(true);
  });
});

describe("pre-checks", () => {
  it("sends inputs under 4 words to the clarify question, with no model call", () => {
    const r = precheck(input({ description: "I'm a CA" }));
    expect(r.kind).toBe("gate");
    if (r.kind === "gate") expect(r.gate.question).toContain("CA");
    expect(precheck(input({ description: "fitness", handle: "@fitwithme" })).kind).toBe("gate");
    expect(precheck(input({ description: "I teach yoga to seniors" })).kind).toBe("ok");
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
  it("allows time/session counts and numbers from the input", () => {
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
