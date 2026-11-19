/**
 * THE MODEL WRITES, CODE ENFORCES.
 *
 * Every rule about meaning lives in this one file:
 *   1. Price      – band from (format x audience x niche type), clamped and snapped to an allowed point. Code fixes.
 *   2. Tier order – Premium > Core > Starter. Code fixes by re-pricing.
 *   3. Ladder     – Premium is a package or mentorship (never one call); no community; 2-4 products; distinct formats.
 *   4. Lengths    – name, tagline, bio, titles, descriptions, bullets, rationale.
 *   5. Hype words – banned list.
 *   6. Safe claims– no guarantees, cures or stock tips.
 *   7. Invented numbers – any number in the copy that the creator did not give is flagged.
 *   8. Rationale  – "why this price" must not contain a rupee amount or number (code may change the price).
 *   9. Script     – Roman script only (no Devanagari).
 *
 * mode "enforce": apply the fixes (price, tier order) and return errors for the rest (they go back to the model).
 * mode "report" : fix nothing, only record what is wrong (used for the v1 eval run).
 */
import type { Audience, CreatorInput, Format, GateResponse, NicheType, Product, Storefront, Tier } from "./schema";

// ======================================================================
// 1. PRICE BANDS (from docs/PRODUCT_SPEC.md "PRICING")
// ======================================================================

export const PRICE_POINTS = [
  49, 99, 149, 199, 249, 299, 399, 499, 599, 699, 799, 999, 1499, 1999, 2499, 2999, 3999, 4999, 7999, 9999,
] as const;

type Band = { min: number; max: number };

const BASE_BAND: Record<Format, Band> = {
  priority_dm: { min: 49, max: 199 },
  template_pack: { min: 99, max: 499 },
  checklist: { min: 99, max: 499 },
  notes: { min: 99, max: 499 },
  prompt_pack: { min: 99, max: 499 },
  ebook_guide: { min: 199, max: 999 },
  roadmap: { min: 199, max: 999 },
  workshop: { min: 99, max: 499 }, // 999 allowed at 25K+ (below)
  call_1on1: { min: 299, max: 999 },
  short_course: { min: 499, max: 2999 },
  call_package: { min: 1499, max: 4999 }, // 7,999-9,999 needs stated credentials AND 25K+: not auto-priced in v1
  mentorship: { min: 1499, max: 4999 },
};

const AUDIENCE_RANK: Record<Audience, number> = { just_starting: 0, under_5k: 1, "5k_25k": 2, "25k_100k_plus": 3 };

/** The allowed price range for one product, after audience and niche rules. */
export function priceBand(format: Format, audience: Audience, nicheType: NicheType): Band {
  let { min, max } = BASE_BAND[format];
  const rank = AUDIENCE_RANK[audience];

  // Caps from the spec
  if (format === "workshop" && rank >= 3) max = 999;
  if (nicheType === "lifestyle" && rank < 3) {
    if (format === "ebook_guide" || format === "roadmap") max = Math.min(max, 499);
    if (format === "short_course") max = Math.min(max, 1499);
  }

  // Audience halves. career_exam niches move up one audience step earlier.
  const effectiveRank = nicheType === "career_exam" ? rank + 1 : rank;
  const points = pointsIn(min, max);
  const mid = points[Math.floor((points.length - 1) / 2)];
  if (effectiveRank <= 1) max = mid; // just starting / under 5K -> lower half
  else if (effectiveRank >= 3) min = mid; // 25-100K+ -> upper half
  return { min, max };
}

function pointsIn(min: number, max: number): number[] {
  return PRICE_POINTS.filter((p) => p >= min && p <= max);
}

/** Clamp into the band, then snap to the nearest allowed price point (ties go to the lower, friendlier price). */
export function snapPrice(price: number, band: Band): number {
  const points = pointsIn(band.min, band.max);
  const target = Number.isFinite(price) ? Math.min(Math.max(price, band.min), band.max) : band.min;
  let best = points[0];
  for (const p of points) if (Math.abs(p - target) < Math.abs(best - target)) best = p;
  return best;
}

/** One allowed step up or down inside the band (used by the Cheaper / More premium chips). */
export function stepPrice(price: number, band: Band, dir: 1 | -1): number {
  const points = pointsIn(band.min, band.max);
  const i = points.indexOf(snapPrice(price, band));
  return points[Math.min(Math.max(i + dir, 0), points.length - 1)];
}

// ======================================================================
// 3. LADDER RULES
// ======================================================================

const TIER_RANK: Record<Tier, number> = { starter: 0, core: 1, premium: 2 };

export const ALLOWED_FORMATS: Record<Tier, Format[]> = {
  starter: ["priority_dm", "template_pack", "checklist", "notes", "prompt_pack", "call_1on1"],
  core: ["workshop", "ebook_guide", "roadmap", "short_course", "call_1on1", "template_pack"],
  premium: ["call_package", "mentorship"],
};

// ======================================================================
// 4. LENGTH LIMITS (characters)
// ======================================================================

export const LIMITS = {
  display_name: { min: 2, max: 40 },
  niche: { min: 2, max: 60 },
  tagline: { min: 10, max: 90 },
  bio: { min: 120, max: 450 },
  title: { min: 5, max: 60 },
  description: { min: 40, max: 240 },
  whats_inside_item: { min: 3, max: 80 },
  price_rationale: { min: 10, max: 120 },
  question: { min: 10, max: 140 },
  suggestion: { min: 3, max: 60 },
};

// ======================================================================
// 5 + 6. WORD LISTS
// ======================================================================

export const HYPE_WORDS = [
  "ultimate", "game-changing", "game changing", "game changer", "game-changer", "unlock", "unlocks", "unlocking",
  "secret", "secrets", "life-changing", "life changing", "revolutionary", "overnight", "mind-blowing", "mind blowing",
  "world-class", "world class", "skyrocket", "supercharge", "next level", "next-level", "transform your life",
];

export const UNSAFE_CLAIMS = [
  // guarantees (astrology, exam prep, anything)
  "guarantee", "guaranteed", "guarantees", "100% result", "100% results", "100% success", "100% selection",
  "pakka result", "pakka selection", "sure-shot", "sure shot", "assured results", "assured selection",
  // health
  "cure", "cures", "cured", "curing", "reverse diabetes", "reverses diabetes", "reverse pcos", "heal diabetes",
  "no need for medicine", "stop your medicine",
  // finance
  "stock tip", "stock tips", "multibagger", "multi-bagger", "buy call", "sell call", "assured returns",
  "guaranteed returns", "double your money", "intraday tips",
];

// ======================================================================
// Result types
// ======================================================================

export type Category =
  | "invented_facts"
  | "hype_words"
  | "price_in_band"
  | "tier_order"
  | "distinct_formats"
  | "safe_claims"
  | "ladder"
  | "lengths"
  | "script"
  | "rationale";

export type Issue = { category: Category; where: string; message: string };
export type Fix = { where: string; message: string };

export type ValidationResult = {
  /** Fixed storefront in enforce mode, untouched in report mode. */
  storefront: Storefront;
  /** Problems the model must fix (enforce) or that were found (report). */
  errors: Issue[];
  /** What code changed by itself (enforce mode only). */
  fixes: Fix[];
  /** Per-category pass/fail on what the MODEL wrote, before any code fixes. */
  modelChecks: Record<Category, boolean>;
  /** Per-category pass/fail on the FINAL page the creator would see. */
  finalChecks: Record<Category, boolean>;
};

const ALL_CATEGORIES: Category[] = [
  "invented_facts", "hype_words", "price_in_band", "tier_order", "distinct_formats",
  "safe_claims", "ladder", "lengths", "script", "rationale",
];

// ======================================================================
// Main entry: validate a storefront
// ======================================================================

export function validateStorefront(
  input: CreatorInput,
  original: Storefront,
  mode: "enforce" | "report" = "enforce",
): ValidationResult {
  const sf: Storefront = structuredClone(original);
  const modelIssues = checkAll(input, sf);
  const fixes: Fix[] = [];

  if (mode === "enforce") {
    fixes.push(...fixPrices(input, sf));
    fixes.push(...fixTierOrder(input, sf));
  }

  const finalIssues = mode === "enforce" ? checkAll(input, sf) : modelIssues;
  return {
    storefront: mode === "enforce" ? sf : original,
    errors: finalIssues,
    fixes,
    modelChecks: toChecks(modelIssues),
    finalChecks: toChecks(finalIssues),
  };
}

function toChecks(issues: Issue[]): Record<Category, boolean> {
  const out = {} as Record<Category, boolean>;
  for (const c of ALL_CATEGORIES) out[c] = !issues.some((i) => i.category === c);
  return out;
}

function checkAll(input: CreatorInput, sf: Storefront): Issue[] {
  return [
    ...checkPrices(input, sf),
    ...checkTierOrder(sf),
    ...checkLadder(sf),
    ...checkLengths(sf),
    ...checkCopy(input, sf),
  ];
}

// ---------- 1. price ----------

function checkPrices(input: CreatorInput, sf: Storefront): Issue[] {
  const issues: Issue[] = [];
  sf.products.forEach((p, i) => {
    const band = priceBand(p.format, input.audience, sf.creator.niche_type);
    if (!(PRICE_POINTS as readonly number[]).includes(p.price_inr) || p.price_inr < band.min || p.price_inr > band.max)
      issues.push({
        category: "price_in_band",
        where: `products[${i}].price_inr`,
        message: `Product ${i + 1} (${p.format}) is priced ${p.price_inr}; allowed is ${band.min}-${band.max} on the price-point list.`,
      });
  });
  return issues;
}

function fixPrices(input: CreatorInput, sf: Storefront): Fix[] {
  const fixes: Fix[] = [];
  sf.products.forEach((p, i) => {
    const band = priceBand(p.format, input.audience, sf.creator.niche_type);
    const snapped = snapPrice(p.price_inr, band);
    if (snapped !== p.price_inr) {
      fixes.push({ where: `products[${i}].price_inr`, message: `${p.price_inr} -> ${snapped} (band ${band.min}-${band.max})` });
      p.price_inr = snapped;
    }
  });
  return fixes;
}

// ---------- 2. tier order ----------

function checkTierOrder(sf: Storefront): Issue[] {
  const issues: Issue[] = [];
  for (const a of sf.products)
    for (const b of sf.products)
      if (TIER_RANK[a.tier] < TIER_RANK[b.tier] && a.price_inr >= b.price_inr)
        issues.push({
          category: "tier_order",
          where: `products[${sf.products.indexOf(b)}].price_inr`,
          message: `${b.tier} "${b.title}" (${b.price_inr}) must cost more than ${a.tier} "${a.title}" (${a.price_inr}).`,
        });
  return issues;
}

/**
 * Re-price so every higher tier costs more than every lower tier.
 * First try moving the higher product UP inside its band; if its band is too low, move the lower product DOWN.
 */
function fixTierOrder(input: CreatorInput, sf: Storefront): Fix[] {
  const fixes: Fix[] = [];
  const band = (p: Product) => priceBand(p.format, input.audience, sf.creator.niche_type);
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const lo of sf.products)
      for (const hi of sf.products) {
        if (!(TIER_RANK[lo.tier] < TIER_RANK[hi.tier] && lo.price_inr >= hi.price_inr)) continue;
        const up = pointsIn(band(hi).min, band(hi).max).find((p) => p > lo.price_inr);
        if (up !== undefined) {
          fixes.push({ where: `"${hi.title}"`, message: `${hi.price_inr} -> ${up} to sit above ${lo.tier}` });
          hi.price_inr = up;
        } else {
          // Higher product is already near its ceiling: put it at its band max, and the lower one just below.
          const hiMax = band(hi).max;
          const down = pointsIn(band(lo).min, band(lo).max).filter((p) => p < hiMax).pop();
          if (down === undefined) continue; // bands do not allow it; stays an error for the model
          if (hi.price_inr !== hiMax) {
            fixes.push({ where: `"${hi.title}"`, message: `${hi.price_inr} -> ${hiMax} (top of its band)` });
            hi.price_inr = hiMax;
          }
          fixes.push({ where: `"${lo.title}"`, message: `${lo.price_inr} -> ${down} to sit below ${hi.tier}` });
          lo.price_inr = down;
        }
        changed = true;
      }
    if (!changed) break;
  }
  return fixes;
}

// ---------- 3. ladder ----------

function checkLadder(sf: Storefront): Issue[] {
  const issues: Issue[] = [];
  const n = sf.products.length;
  if (n < 2 || n > 4)
    issues.push({ category: "ladder", where: "products", message: `There are ${n} products; there must be 2 to 4.` });

  const formats = sf.products.map((p) => p.format);
  const dupes = formats.filter((f, i) => formats.indexOf(f) !== i);
  if (dupes.length)
    issues.push({ category: "distinct_formats", where: "products", message: `Formats repeat (${[...new Set(dupes)].join(", ")}); every product needs a different format.` });

  const ids = sf.products.map((p) => p.id);
  if (new Set(ids).size !== ids.length)
    issues.push({ category: "ladder", where: "products", message: "Product ids repeat; every id must be unique." });

  if (!sf.products.some((p) => p.tier === "starter"))
    issues.push({ category: "ladder", where: "products", message: "There is no Starter product; include one low-priced Starter." });
  if (sf.products.filter((p) => p.tier === "premium").length > 1)
    issues.push({ category: "ladder", where: "products", message: "There is more than one Premium product; keep at most one." });

  sf.products.forEach((p, i) => {
    if (!ALLOWED_FORMATS[p.tier].includes(p.format))
      issues.push({
        category: "ladder",
        where: `products[${i}].format`,
        message:
          p.tier === "premium"
            ? `Product ${i + 1} is Premium but is a ${p.format}. Premium must be a call_package (for example 3 calls) or mentorship, never a single call.`
            : `Product ${i + 1} is ${p.tier} but uses ${p.format}; allowed for ${p.tier}: ${ALLOWED_FORMATS[p.tier].join(", ")}.`,
      });
    if (/\bcommunit(y|ies)\b|\bmembership\b/i.test(`${p.title} ${p.description}`))
      issues.push({ category: "ladder", where: `products[${i}]`, message: `Product ${i + 1} reads like a community or membership; those are not offered.` });
    if (p.whats_inside.length !== 3)
      issues.push({ category: "lengths", where: `products[${i}].whats_inside`, message: `Product ${i + 1} has ${p.whats_inside.length} "what's inside" bullets; it needs exactly 3.` });
  });
  return issues;
}

// ---------- 4. lengths ----------

function len(where: string, text: string, limit: { min: number; max: number }): Issue[] {
  const n = text.trim().length;
  if (n < limit.min || n > limit.max)
    return [{ category: "lengths", where, message: `${where} is ${n} characters; it must be ${limit.min}-${limit.max}.` }];
  return [];
}

function checkLengths(sf: Storefront): Issue[] {
  const c = sf.creator;
  return [
    ...len("display_name", c.display_name, LIMITS.display_name),
    ...len("niche", c.niche, LIMITS.niche),
    ...len("tagline", c.tagline, LIMITS.tagline),
    ...len("bio", c.bio, LIMITS.bio),
    ...sf.products.flatMap((p, i) => [
      ...len(`products[${i}].title`, p.title, LIMITS.title),
      ...len(`products[${i}].description`, p.description, LIMITS.description),
      ...len(`products[${i}].price_rationale`, p.price_rationale, LIMITS.price_rationale),
      ...p.whats_inside.flatMap((w, j) => len(`products[${i}].whats_inside[${j}]`, w, LIMITS.whats_inside_item)),
    ]),
  ];
}

// ---------- 5-9. copy: hype, safety, invented numbers, rationale, script ----------

/** All creator-visible text fields, labelled. */
export function copyFields(sf: Storefront): { where: string; text: string }[] {
  const c = sf.creator;
  return [
    { where: "display_name", text: c.display_name },
    { where: "tagline", text: c.tagline },
    { where: "bio", text: c.bio },
    ...sf.products.flatMap((p, i) => [
      { where: `products[${i}].title`, text: p.title },
      { where: `products[${i}].description`, text: p.description },
      ...p.whats_inside.map((w, j) => ({ where: `products[${i}].whats_inside[${j}]`, text: w })),
      { where: `products[${i}].price_rationale`, text: p.price_rationale },
    ]),
  ];
}

export function findWords(text: string, list: string[]): string[] {
  const lower = text.toLowerCase();
  return list.filter((w) => new RegExp(`(^|[^a-z])${escapeRe(w)}($|[^a-z])`, "i").test(lower));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DEVANAGARI = /[ऀ-ॿ]/;

function checkCopy(input: CreatorInput, sf: Storefront): Issue[] {
  const issues: Issue[] = [];
  const allowedNumbers = numbersInInput(input);

  for (const { where, text } of copyFields(sf)) {
    const hype = findWords(text, HYPE_WORDS);
    if (hype.length) issues.push({ category: "hype_words", where, message: `${where} uses hype words: ${hype.join(", ")}. Say it plainly.` });

    const unsafe = findWords(text, UNSAFE_CLAIMS);
    if (unsafe.length)
      issues.push({ category: "safe_claims", where, message: `${where} makes an unsafe claim (${unsafe.join(", ")}). No guarantees, cures or stock tips; keep it to education.` });

    if (DEVANAGARI.test(text)) issues.push({ category: "script", where, message: `${where} uses Devanagari script; write in Roman script only.` });

    if (where.endsWith("price_rationale")) {
      if (/₹|\brs\.?\s*\d|\binr\b|\d/i.test(text))
        issues.push({ category: "rationale", where, message: `${where} contains a number or rupee amount. Explain the price without any number, because code may adjust the price.` });
      continue; // numbers in the rationale are handled by the rule above, not the invented-number rule
    }

    for (const claim of inventedNumbers(text, allowedNumbers))
      issues.push({ category: "invented_facts", where, message: `${where} says "${claim}", but the creator never gave that number. Remove it.` });
  }
  return issues;
}

// ---------- 7. invented numbers ----------

/** Words after a number that make it a claim about the creator (needs to come from the input). */
// Up to two describing words may sit between the number and the unit: "10,000 happy students", "30 quick recipes".
const CLAIM_UNITS = /^\s*(\+|%|k\b|l\b|lakh|lac|cr\b|crore|million|mn\b|(?:[a-z-]+\s+){0,2}(?:followers?|students?|clients?|members?|people|subscribers?|customers?|learners?|aspirants?|downloads?|sales|years?|yrs?|selections?|ranks?|reviews?|views?|likes?|families|women|men|kids|patients?)\b)/i;

/**
 * Words after a number that describe the SHAPE of the product: time and sessions ("3 calls", "30-min", "7-day plan").
 * Content counts ("50+ tricks", "20 recipes") are NOT here on purpose: above 12 they are promises the creator
 * never made, so they are flagged unless the creator gave the number.
 */
const PRODUCT_UNITS = /^\s*-?\s*(?:[a-z-]+\s+){0,1}(min|mins|minute|minutes|hour|hours|hr|hrs|day|days|week|weeks|month|months|session|sessions|call|calls|class|classes|x\b)\b/i;

function normalise(raw: string, suffix: string): number {
  let n = parseFloat(raw.replace(/,/g, ""));
  const s = suffix.toLowerCase().trim();
  if (s.startsWith("k")) n *= 1_000;
  else if (s.startsWith("l") || s.startsWith("lakh") || s.startsWith("lac")) n *= 100_000;
  else if (s.startsWith("cr")) n *= 10_000_000;
  else if (s.startsWith("m")) n *= 1_000_000;
  return n;
}

const NUMBER_RE = /(?<![\w.])(\d[\d,]*(?:\.\d+)?)(?=([^\d]{0,30}))/g;

export function numbersInInput(input: CreatorInput): Set<number> {
  const text = [input.description, input.instagram_bio ?? "", input.handle ?? ""].join(" ");
  const out = new Set<number>();
  for (const m of text.matchAll(NUMBER_RE)) {
    out.add(parseFloat(m[1].replace(/,/g, "")));
    out.add(normalise(m[1], m[2] ?? ""));
  }
  return out;
}

/**
 * Returns the invented claims in a piece of copy.
 * Flagged: a number the creator never gave that is a claim (followers, students, years, %, 10k, 2 lakh, 500+...)
 *          or any bare number above 12 that is not describing the product.
 * Allowed: numbers from the input, product-shape counts ("3 calls", "30-min", "7-day plan"), small counts 1-12.
 */
export function inventedNumbers(rawText: string, allowed: Set<number>): string[] {
  // Models often write Unicode hyphens ("30‑min"); treat them like a normal hyphen.
  const text = rawText.replace(/[‐-―−]/g, "-");
  const out: string[] = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const raw = m[1];
    const after = m[2] ?? "";
    const value = normalise(raw, after);
    const plain = parseFloat(raw.replace(/,/g, ""));
    if (allowed.has(value) || allowed.has(plain)) continue;
    const isClaim = CLAIM_UNITS.test(after);
    if (!isClaim && PRODUCT_UNITS.test(after) && plain <= 100) continue;
    if (!isClaim && plain <= 12) continue;
    // ₹ amounts inside copy are flagged too (prices live in price_inr only, and code may change them)
    out.push((raw + after).replace(/\s+/g, " ").trim().slice(0, 28));
  }
  return out;
}

// ======================================================================
// Gate (needs_more_info) checks
// ======================================================================

export function validateGate(res: Extract<GateResponse, { status: "needs_more_info" }>): Issue[] {
  const issues: Issue[] = [];
  issues.push(...len("question", res.question, LIMITS.question));
  if (res.suggestions.length !== 3)
    issues.push({ category: "lengths", where: "suggestions", message: `There are ${res.suggestions.length} suggestions; there must be exactly 3.` });
  res.suggestions.forEach((s, i) => issues.push(...len(`suggestions[${i}]`, s, LIMITS.suggestion)));
  for (const t of [res.question, ...res.suggestions])
    if (DEVANAGARI.test(t)) issues.push({ category: "script", where: "gate", message: "Use Roman script only." });
  return issues;
}

/** Plain sentences to send back to the model on the one retry. */
export function errorsForRetry(issues: Issue[]): string {
  return issues.map((i, n) => `${n + 1}. ${i.message}`).join("\n");
}
