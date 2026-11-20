/**
 * THE MODEL WRITES, CODE ENFORCES.
 *
 * Every rule about meaning lives in this one file.
 *
 * Code WRITES (the model never does):
 *   - Final price      band from (format x audience x niche type), clamped and snapped to an allowed point
 *   - Tier order       Premium > Core > Starter, fixed by re-pricing
 *   - Display name     the creator's name if given, else their @handle, else the model's neutral niche label
 *   - "Why this price" built from the band, the audience and the other tiers, using the final price
 *   - Disclaimer       finance / health / astrology pages get a fixed one-line disclaimer
 *
 * Code CHECKS (problems go back to the model for one retry):
 *   - Ladder           2-4 products, distinct formats, one Starter, Premium is a package or mentorship, no community
 *   - Lengths          name, tagline, bio, titles, descriptions, bullets
 *   - Banned words     hype words and rule/compliance language ("regulatory", "SEBI registered", "disclaimer"...)
 *   - Safe claims      no guarantees, cures or stock tips; finance pages: no personalised trading advice
 *   - Invented facts   numbers the creator never gave ("10,000+ students", "50+ tricks") and names they never gave
 *   - Consistency      a duration in the title must match the description ("3-Month" vs "three weeks"),
 *                      no effort tag in a title, no extras the creator never mentioned ("with photos")
 *   - Outcome promises taglines and titles never promise a result ("crack UPSC", "get selected")
 *   - Script           Roman script only (no Devanagari)
 *
 * mode "enforce": apply the fixes and return errors for the rest.
 * mode "report" : fix nothing, only record what is wrong (used for the v1 eval run).
 */
import {
  type Audience,
  type CreatorInput,
  type Draft,
  type Format,
  type GateResponse,
  type NicheType,
  type SafetyTopic,
  type Storefront,
  type Tier,
} from "./schema";

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
// 2. LADDER RULES
// ======================================================================

const TIER_RANK: Record<Tier, number> = { starter: 0, core: 1, premium: 2 };

export const ALLOWED_FORMATS: Record<Tier, Format[]> = {
  starter: ["priority_dm", "template_pack", "checklist", "notes", "prompt_pack", "call_1on1"],
  core: ["workshop", "ebook_guide", "roadmap", "short_course", "call_1on1", "template_pack"],
  premium: ["call_package", "mentorship"],
};

// ======================================================================
// 3. LENGTH LIMITS (characters)
// ======================================================================

export const LIMITS = {
  display_name: { min: 2, max: 40 },
  niche: { min: 2, max: 60 },
  tagline: { min: 10, max: 90 },
  bio: { min: 120, max: 450 },
  title: { min: 5, max: 60 },
  description: { min: 40, max: 240 },
  whats_inside_item: { min: 3, max: 80 },
  question: { min: 10, max: 140 },
  suggestion: { min: 3, max: 60 },
};

// ======================================================================
// 4. WORD LISTS
// ======================================================================

export const HYPE_WORDS = [
  "ultimate", "game-changing", "game changing", "game changer", "game-changer", "unlock", "unlocks", "unlocking",
  "secret", "secrets", "life-changing", "life changing", "revolutionary", "overnight", "mind-blowing", "mind blowing",
  "world-class", "world class", "skyrocket", "supercharge", "next level", "next-level", "transform your life",
];

/** Rule and compliance language never belongs in the creator's copy (disclaimers are added by code instead). */
export const COMPLIANCE_WORDS = [
  "regulatory", "regulated", "regulation", "regulations", "sebi", "registered advisor", "registered adviser",
  "registered investment", "financial advice", "investment advice", "medical advice", "legal advice",
  "disclaimer", "compliance", "compliant", "terms and conditions", "liability",
  "substitute for professional", "not a substitute", "professional advice", "consult a professional",
  "consult your doctor", "registration", "registered", "certified advisor", "certified adviser", "licensed",
  "license", "licence", "not responsible",
];

/** Compliance words that are allowed when the creator uses them about themself. */
const CREDENTIAL_WORDS = ["registered", "licensed", "registration", "certified advisor", "certified adviser"];

/** Outcome promises in taglines and titles: exam prep and coaching must not promise a result. */
export const OUTCOME_PROMISES = [
  "clear upsc", "clear ssc", "clear neet", "clear jee", "clear cat", "clear the exam", "clear your exam", "clear exams",
  "clear prelims", "clear mains", "crack", "cracks", "cracking", "get selected", "selection guaranteed", "top rank",
  "top ranks", "ace the exam", "ace your exam", "pakka clear", "clear karo", "crack karo", "get the job", "land the job",
  "land your dream job", "get hired",
];

/** Delivery extras the model likes to promise. Allowed only when the creator's own input mentions them. */
export const UNPROMISED_EXTRAS = [
  "with photos", "photo tutorial", "photo tutorials", "step-by-step photos", "step by step photos", "photos of every step",
  "video tutorials", "whatsapp support", "whatsapp group", "certificate", "certificates", "lifetime access",
  "printable", "printables", "24/7 support",
];

/** The effort tag is for the creator, never for the buyer: it must not leak into a title. */
const EFFORT_WORDS: Record<string, string[]> = {
  weekend: ["weekend", "one weekend"],
  one_week: ["one week", "1 week", "1-week", "one-week", "one_week"],
  two_weeks: ["two weeks", "2 weeks", "2-week", "two-week", "two_weeks"],
};

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

/** Personalised trading advice. Checked on finance pages only ("picks" is fine for a thrift store). */
export const FINANCE_ADVICE = [
  "analysis of your setup", "analyse your setup", "analyze your setup", "your setup", "next move", "next moves",
  "review your trades", "review of your trades", "your trades", "trade review", "trade reviews", "trade calls",
  "trading calls", "trade alerts", "trading alerts", "entry/exit", "entry and exit", "entry & exit", "entry points",
  "exit points", "entry price", "exit price", "buy/sell", "buy or sell", "buy and sell signals", "buy signals",
  "sell signals", "trading signals", "stock picks", "picks", "which stocks to buy", "what to buy", "portfolio review",
  "review your portfolio", "target price", "live trades", "profit targets", "exit criteria", "next trading week",
  "next trading day", "next trading session",
];

/**
 * Word lists miss rewordings ("review of your current approach", "tailored suggestions for strategy improvement"),
 * so finance pages also get these patterns: a review verb aimed at the buyer's own trading, or a tailored strategy.
 */
const FINANCE_ADVICE_PATTERNS: RegExp[] = [
  /\b(review|reviewing|reviews|analy[sz]\w*|audit\w*|check\w*|fine-?tun\w*|assess\w*)\s+(of\s+)?(your|ur)\s+(current\s+|own\s+)?(trad\w*|setups?|positions?|portfolios?|charts?|approach|strateg\w*|plans?|picks?)/i,
  /\b(tailored|personali[sz]ed|custom)\s+(trading\s+|investment\s+)?(strateg\w*|suggestions?|trades?|portfolios?|picks?|calls?|signals?)/i,
  /\b(personali[sz]ed|tailored)\b[^.]{0,40}\b(trad\w*|options|stocks?|portfolio)/i,
  // the buyer's own trades or positions, in any wording ("your recent trades", "your open positions")
  /\byour\s+(recent\s+|current\s+|own\s+|open\s+|live\s+|past\s+|last\s+)?(trades?|positions?|portfolios?)\b/i,
  // daily trade ideas dressed up as content ("the day's key options setup", "daily heads-up on market setups")
  /\b(market|options?|trade|trading|intraday|stock)\s+setups?\b/i,
  /\b(daily|day['’]s|today['’]s|tomorrow['’]s|weekly)\b[^.;]{0,30}\b(setups?|trades?|levels?|calls?|trade ideas?|picks?)\b/i,
];

// ======================================================================
// 5. DISCLAIMERS (code-written, shown on the public page)
// ======================================================================

export const DISCLAIMERS: Record<Exclude<SafetyTopic, "none">, string> = {
  finance: "Educational content only. Not investment advice.",
  health: "Not medical advice.",
  astrology: "For guidance only; no guaranteed outcomes.",
};

/** Strong signals only, so "budget outfits" or "tiffin options" never get a finance disclaimer. */
const TOPIC_KEYWORDS: [Exclude<SafetyTopic, "none">, RegExp][] = [
  ["finance", /\b(stocks?|share market|stock market|trading|trader|trade options|options trading|intraday|invest\w*|sips?|mutual funds?|personal finance|finance|financial|income tax|itr|credit cards?|cibil|crypto)\b/i],
  ["astrology", /\b(astro\w*|tarot|kundli|horoscope|numerolog\w*|vastu|zodiac|jyotish\w*)\b/i],
  ["health", /\b(diabet\w*|weight loss|fat loss|diet plans?|desi diet|yoga|fitness|workouts?|gym|pcos|pcod|thyroid|nutrition\w*)\b/i],
];

/** Topic from the model, with a keyword safety net on the creator's own words and the niche. */
export function safetyTopic(input: CreatorInput, draft: Draft): SafetyTopic {
  if (draft.creator.safety_topic && draft.creator.safety_topic !== "none") return draft.creator.safety_topic;
  const text = `${input.description} ${input.instagram_bio ?? ""} ${draft.creator.niche}`;
  for (const [topic, re] of TOPIC_KEYWORDS) if (re.test(text)) return topic;
  return "none";
}

// ======================================================================
// 6. "WHY THIS PRICE" (code-written from the final price)
// ======================================================================

const FORMAT_PLURAL: Record<Format, string> = {
  priority_dm: "Priority DMs",
  template_pack: "Template packs",
  checklist: "Checklists",
  notes: "Notes",
  prompt_pack: "Prompt packs",
  ebook_guide: "Ebooks and guides",
  roadmap: "Roadmaps",
  workshop: "Live workshops",
  call_1on1: "1:1 calls",
  short_course: "Short recorded courses",
  call_package: "Call packages",
  mentorship: "Mentorships",
};

export const FORMAT_SINGULAR: Record<Format, string> = {
  priority_dm: "priority DM",
  template_pack: "template pack",
  checklist: "checklist",
  notes: "notes",
  prompt_pack: "prompt pack",
  ebook_guide: "ebook",
  roadmap: "roadmap",
  workshop: "workshop",
  call_1on1: "1:1 call",
  short_course: "course",
  call_package: "call package",
  mentorship: "mentorship",
};

export const AUDIENCE_PHRASE: Record<Audience, string> = {
  just_starting: "creators who are just starting",
  under_5k: "creators with under 5K followers",
  "5k_25k": "creators with 5-25K followers",
  "25k_100k_plus": "creators with 25K+ followers",
};

const rs = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Example: "Our price guide puts ebooks and guides from creators with 5-25K followers at ₹199-₹499.
 *           We picked ₹399 so it's a step up from your ₹99 starter."
 * Worded as "our price guide" because the bands are our heuristics (sense-checked against public data), not market data.
 */
export function buildRationale(input: CreatorInput, sf: Draft, index: number): string {
  const p = sf.products[index];
  const band = priceBand(p.format, input.audience, sf.creator.niche_type);
  const range = band.min === band.max ? rs(band.min) : `${rs(band.min)}-${rs(band.max)}`;
  const plural = FORMAT_PLURAL[p.format];
  const first = `Our price guide puts ${plural.startsWith("Priority") ? "priority DMs" : plural.toLowerCase()} from ${AUDIENCE_PHRASE[input.audience]} at ${range}.`;

  const cheaper = sf.products.filter((o) => TIER_RANK[o.tier] < TIER_RANK[p.tier]).sort((a, b) => b.price_inr - a.price_inr)[0];
  let why: string;
  if (p.tier === "starter") why = "so it's an easy first buy for your followers";
  else if (p.tier === "core")
    why = cheaper ? `so it's a step up from your ${rs(cheaper.price_inr)} starter` : "for your main product";
  else
    why = cheaper
      ? `because it's your deepest offer, above your ${rs(cheaper.price_inr)} ${FORMAT_SINGULAR[cheaper.format]}`
      : "because it's your deepest offer";
  return `${first} We picked ${rs(p.price_inr)} ${why}.`;
}

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
  | "consistency";

export type Issue = { category: Category; where: string; message: string };
export type Fix = { where: string; message: string };

export type ValidationResult = {
  /** The final page: code-owned fields always filled; prices fixed in enforce mode only. */
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
  "safe_claims", "ladder", "lengths", "script", "consistency",
];

// ======================================================================
// Main entry: validate a storefront
// ======================================================================

export function validateStorefront(
  input: CreatorInput,
  draft: Draft,
  mode: "enforce" | "report" = "enforce",
  opts: { setName?: boolean } = {},
): ValidationResult {
  const sf: Draft = structuredClone(draft);
  const modelIssues = checkAll(input, sf);
  const fixes: Fix[] = [];

  if (opts.setName !== false) setDisplayName(input, sf);
  if (mode === "enforce") {
    fixes.push(...fixPrices(input, sf));
    fixes.push(...fixTierOrder(input, sf));
  }
  const finalPage = finalize(input, sf);

  const finalIssues = mode === "enforce" ? checkAll(input, finalPage) : modelIssues;
  return {
    storefront: finalPage,
    errors: finalIssues,
    fixes,
    modelChecks: toChecks(modelIssues),
    finalChecks: toChecks(finalIssues),
  };
}

/** Adds the code-owned fields: safety topic, "why this price" for every product, disclaimer. */
function finalize(input: CreatorInput, sf: Draft): Storefront {
  const topic = safetyTopic(input, sf);
  return {
    creator: { ...sf.creator, safety_topic: topic },
    products: sf.products.map((p, i) => ({ ...p, price_rationale: buildRationale(input, sf, i) })),
    disclaimer: topic === "none" ? null : DISCLAIMERS[topic],
  };
}

/** Name the creator typed > their @handle > the model's neutral niche label. */
function setDisplayName(input: CreatorInput, sf: Draft) {
  const name = input.name?.trim();
  const handle = input.handle?.trim();
  if (name) sf.creator.display_name = name;
  else if (handle) sf.creator.display_name = handle.startsWith("@") ? handle : `@${handle}`;
}

function toChecks(issues: Issue[]): Record<Category, boolean> {
  const out = {} as Record<Category, boolean>;
  for (const c of ALL_CATEGORIES) out[c] = !issues.some((i) => i.category === c);
  return out;
}

function checkAll(input: CreatorInput, sf: Draft): Issue[] {
  return [
    ...checkPrices(input, sf),
    ...checkTierOrder(sf),
    ...checkLadder(sf),
    ...checkLengths(sf),
    ...checkCopy(input, sf),
    ...checkNames(input, sf),
    ...checkDurations(sf),
    ...checkExtrasAndEffort(input, sf),
  ];
}

// ---------- price ----------

function checkPrices(input: CreatorInput, sf: Draft): Issue[] {
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

function fixPrices(input: CreatorInput, sf: Draft): Fix[] {
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

// ---------- tier order ----------

function checkTierOrder(sf: Draft): Issue[] {
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
function fixTierOrder(input: CreatorInput, sf: Draft): Fix[] {
  const fixes: Fix[] = [];
  const band = (p: Draft["products"][number]) => priceBand(p.format, input.audience, sf.creator.niche_type);
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

// ---------- ladder ----------

function checkLadder(sf: Draft): Issue[] {
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

// ---------- lengths ----------

function len(where: string, text: string, limit: { min: number; max: number }): Issue[] {
  const n = text.trim().length;
  if (n < limit.min || n > limit.max)
    return [{ category: "lengths", where, message: `${where} is ${n} characters; it must be ${limit.min}-${limit.max}.` }];
  return [];
}

function checkLengths(sf: Draft): Issue[] {
  const c = sf.creator;
  return [
    ...len("display_name", c.display_name, LIMITS.display_name),
    ...len("niche", c.niche, LIMITS.niche),
    ...len("tagline", c.tagline, LIMITS.tagline),
    ...len("bio", c.bio, LIMITS.bio),
    ...sf.products.flatMap((p, i) => [
      ...len(`products[${i}].title`, p.title, LIMITS.title),
      ...len(`products[${i}].description`, p.description, LIMITS.description),
      ...p.whats_inside.flatMap((w, j) => len(`products[${i}].whats_inside[${j}]`, w, LIMITS.whats_inside_item)),
    ]),
  ];
}

// ---------- copy: banned words, safety, invented numbers, script ----------

/** All creator-visible text the MODEL wrote, labelled. (price_rationale and disclaimer are written by code.) */
export function copyFields(sf: Draft): { where: string; text: string }[] {
  const c = sf.creator;
  return [
    { where: "display_name", text: c.display_name },
    { where: "tagline", text: c.tagline },
    { where: "bio", text: c.bio },
    ...sf.products.flatMap((p, i) => [
      { where: `products[${i}].title`, text: p.title },
      { where: `products[${i}].description`, text: p.description },
      ...p.whats_inside.map((w, j) => ({ where: `products[${i}].whats_inside[${j}]`, text: w })),
    ]),
  ];
}

export function findWords(text: string, list: string[]): string[] {
  const lower = normaliseDashes(text).toLowerCase();
  return list.filter((w) => new RegExp(`(^|[^a-z])${escapeRe(w)}($|[^a-z])`, "i").test(lower));
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Models often write Unicode hyphens ("30‑min"); treat them like a normal hyphen. */
function normaliseDashes(s: string) {
  return s.replace(/[‐-―−]/g, "-");
}

const DEVANAGARI = /[ऀ-ॿ]/;

function checkCopy(input: CreatorInput, sf: Draft): Issue[] {
  const issues: Issue[] = [];
  const allowedNumbers = numbersInInput(input);
  const finance = safetyTopic(input, sf) === "finance";
  const said = [input.description, input.instagram_bio ?? ""].join(" ");

  for (const { where, text } of copyFields(sf)) {
    const hype = findWords(text, HYPE_WORDS);
    if (hype.length) issues.push({ category: "hype_words", where, message: `${where} uses hype words: ${hype.join(", ")}. Say it plainly.` });

    // A credential the creator states themself ("registered dietitian") may be repeated; nothing else may.
    const rules = findWords(text, COMPLIANCE_WORDS).filter((w) => !(CREDENTIAL_WORDS.includes(w) && findWords(said, [w]).length));
    if (rules.length)
      issues.push({ category: "hype_words", where, message: `${where} uses rule or compliance language (${rules.join(", ")}). Leave it out; the page adds its own disclaimer.` });

    const unsafe = findWords(text, UNSAFE_CLAIMS);
    if (unsafe.length)
      issues.push({ category: "safe_claims", where, message: `${where} makes an unsafe claim (${unsafe.join(", ")}). No guarantees, cures or stock tips; keep it to education.` });

    if (finance) {
      const advice = findWords(text, FINANCE_ADVICE);
      for (const re of FINANCE_ADVICE_PATTERNS) {
        const m = normaliseDashes(text).match(re);
        if (m) advice.push(m[0]);
      }
      if (advice.length)
        issues.push({ category: "safe_claims", where, message: `${where} offers personalised trading advice (${advice.join(", ")}). Finance products must teach concepts, not review trades or give calls.` });
    }

    if (DEVANAGARI.test(text)) issues.push({ category: "script", where, message: `${where} uses Devanagari script; write in Roman script only.` });

    for (const claim of inventedNumbers(text, allowedNumbers))
      issues.push({ category: "invented_facts", where, message: `${where} says "${claim}", but the creator never gave that number. Remove it.` });
  }
  return issues;
}

// ---------- invented names ----------

/** Words the creator gave us: name, description, bio, and the handle split on . _ - and digits ("rahul.lifts" -> rahul, lifts). */
function inputWords(input: CreatorInput): Set<string> {
  const text = [input.name ?? "", input.description, input.instagram_bio ?? "", (input.handle ?? "").replace(/[@._\-\d]+/g, " ")].join(" ");
  return new Set(text.toLowerCase().match(/\p{L}+/gu) ?? []);
}

/** Capitalised words after these openers are almost always a person's name. */
// Hinglish "Main X hoon" only counts at the start of a sentence, so English "my main Starter" does not trip it.
const NAME_INTRO = /(?:\b[Ii] am|\b[Ii]['’]m|\b[Mm]y name is|\b[Tt]his is|\b[Mm]yself|\b[Mm]era naam|(?:^|[.!?]\s+)Main|\b[Hh]i,? [Ii]['’]m|\b[Hh]ey,? [Ii]['’]m)\s+([A-Z][a-z]{1,})\b/g;
const SIGN_OFF = /[-–—]\s*([A-Z][a-z]+)\s*[.!]?\s*$/;

/** Capitalised words that are not names (so "I'm Delhi-based" or "Main Hindi medium..." do not trip the rule). */
const NOT_NAMES = new Set([
  "a", "an", "the", "here", "so", "not", "also", "just", "your", "passionate", "certified", "currently", "based",
  "working", "hindi", "english", "india", "indian", "delhi", "mumbai", "bangalore", "bengaluru", "pune", "chennai",
  "kolkata", "hyderabad", "on", "in", "into", "from", "with", "aap", "apne", "ek", "yahan", "har", "bhi", "sirf",
  "beginners", "students", "doing", "helping", "teaching", "sharing", "excited", "happy", "glad", "now", "always",
  "starter", "core", "premium", "kadai", "cooker",
]);

function checkNames(input: CreatorInput, sf: Draft): Issue[] {
  const issues: Issue[] = [];
  const allowed = inputWords(input);
  const ok = (w: string) => allowed.has(w.toLowerCase()) || NOT_NAMES.has(w.toLowerCase());

  const bio = normaliseDashes(sf.creator.bio);
  const found = [...bio.matchAll(NAME_INTRO)].map((m) => m[1]);
  const sign = bio.match(SIGN_OFF)?.[1];
  if (sign) found.push(sign);
  for (const name of new Set(found))
    if (!ok(name))
      issues.push({ category: "invented_facts", where: "bio", message: `bio uses the name "${name}", but the creator never gave a name. Do not invent a person's name; write the bio without one.` });

  // A handle the creator never gave, or a literal placeholder like "@handle", is invented too.
  const handle = (input.handle ?? "").trim().replace(/^@?/, "@").toLowerCase();
  for (const { where, text } of [{ where: "display_name", text: sf.creator.display_name }, { where: "bio", text: sf.creator.bio }, { where: "tagline", text: sf.creator.tagline }])
    for (const m of text.matchAll(/@[\w.]+/g))
      if (m[0].toLowerCase() !== handle)
        issues.push({ category: "invented_facts", where, message: `${where} uses "${m[0]}", which is not the creator's handle. Do not write handles or placeholders.` });

  // Only checked when code did not set the name itself (no name and no handle given).
  if (!input.name?.trim() && !input.handle?.trim()) {
    const words = sf.creator.display_name.match(/\p{L}+/gu) ?? [];
    const niche = new Set((sf.creator.niche.toLowerCase().match(/\p{L}+/gu) ?? []));
    const grounded = words.some((w) => w.length >= 3 && (allowed.has(w.toLowerCase()) || niche.has(w.toLowerCase())));
    if (!grounded)
      issues.push({ category: "invented_facts", where: "display_name", message: `display_name "${sf.creator.display_name}" looks like an invented name. Use a neutral label from the niche instead, like "Home Baking with Kadai".` });
  }
  return issues;
}

// ---------- consistency: durations ----------

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10,
};
const UNIT_DAYS: Record<string, number> = { day: 1, din: 1, week: 7, hafte: 7, hafta: 7, month: 30, mahine: 30, mahina: 30 };
const DURATION_RE = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|ek|do|teen|chaar|char|paanch|panch|chhe|saat|aath|nau|das)[\s-]*(day|week|month|din|hafte|hafta|mahine|mahina)s?\b/gi;

function durations(text: string): { days: number; raw: string }[] {
  return [...normaliseDashes(text).matchAll(DURATION_RE)].map((m) => {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1].toLowerCase()];
    return { days: n * UNIT_DAYS[m[2].toLowerCase()], raw: m[0] };
  });
}

function checkDurations(sf: Draft): Issue[] {
  const issues: Issue[] = [];
  sf.products.forEach((p, i) => {
    const inTitle = durations(p.title);
    if (!inTitle.length) return;
    const rest = durations([p.description, ...p.whats_inside].join(" | "));
    const clash = rest.find((d) => !inTitle.some((t) => t.days === d.days));
    if (clash)
      issues.push({ category: "consistency", where: `products[${i}]`, message: `Product ${i + 1}'s title says "${inTitle[0].raw}" but its description says "${clash.raw}". Make them match.` });
  });
  return issues;
}

// ---------- effort tag in titles, outcome promises, unpromised extras ----------

/** "photo tutorials" is allowed if the creator mentions any photo; "whatsapp group" if they mention WhatsApp. */
function extraBase(extra: string): RegExp {
  const base = ["photo", "video", "whatsapp", "certificate", "lifetime", "printable", "24/7"].find((b) => extra.includes(b)) ?? extra;
  return new RegExp(escapeRe(base), "i");
}

function checkExtrasAndEffort(input: CreatorInput, sf: Draft): Issue[] {
  const issues: Issue[] = [];
  const said = [input.description, input.instagram_bio ?? ""].join(" ");
  for (const { where, text } of [{ where: "tagline", text: sf.creator.tagline }, ...sf.products.map((p, i) => ({ where: `products[${i}].title`, text: p.title }))]) {
    const promise = findWords(text, OUTCOME_PROMISES);
    if (promise.length)
      issues.push({ category: "safe_claims", where, message: `${where} promises an outcome (${promise.join(", ")}). Say what it helps with, not a result.` });
  }
  sf.products.forEach((p, i) => {
    const effort = findWords(p.title, EFFORT_WORDS[p.effort_to_create] ?? []);
    if (effort.length)
      issues.push({ category: "consistency", where: `products[${i}].title`, message: `products[${i}].title mentions how long it takes you to make it (${effort[0]}). Leave the effort out of the title.` });
  });
  for (const { where, text } of copyFields(sf)) {
    const extras = findWords(text, UNPROMISED_EXTRAS).filter((w) => !extraBase(w).test(said));
    if (extras.length)
      issues.push({ category: "consistency", where, message: `${where} promises ${extras.join(", ")}, which the creator never mentioned. Describe what it covers, not delivery extras.` });
  }
  return issues;
}

// ---------- invented numbers ----------

// Up to two describing words may sit between the number and the unit: "10,000 happy students".
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
  const text = [input.name ?? "", input.description, input.instagram_bio ?? "", input.handle ?? ""].join(" ");
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
 *          or any bare number above 12 that is not describing the product's time or sessions.
 * Allowed: numbers from the input, time/session counts ("3 calls", "30-min", "7-day plan"), small counts 1-12.
 */
export function inventedNumbers(rawText: string, allowed: Set<number>): string[] {
  const text = normaliseDashes(rawText);
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
