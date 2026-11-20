/**
 * Shapes for everything the AI engine reads and writes.
 *
 * Zod checks TYPES and ALLOWED VALUES here. Lengths, counts, ranges and meaning
 * are checked in validators.ts, because neither Groq nor Gemini promises to
 * enforce them (Gemini silently drops minLength/maxLength; Groq strict mode
 * does not document them).
 */
import { z } from "zod";

// ---------- Creator input ----------

export const AUDIENCE = ["just_starting", "under_5k", "5k_25k", "25k_100k_plus"] as const;
export const LANGUAGE = ["en", "hinglish"] as const;

export const CreatorInputSchema = z.object({
  /** Optional. If empty, the page uses the @handle, else a neutral label from the niche. Never an invented name. */
  name: z.string().optional(),
  description: z.string().default(""),
  handle: z.string().optional(),
  instagram_bio: z.string().optional(),
  audience: z.enum(AUDIENCE).default("just_starting"),
  language: z.enum(LANGUAGE).default("en"),
});
export type CreatorInput = z.infer<typeof CreatorInputSchema>;
export type Audience = (typeof AUDIENCE)[number];

// ---------- Storefront ----------

export const NICHE_TYPE = ["career_exam", "expert", "lifestyle"] as const;
export const TIER = ["starter", "core", "premium"] as const;
export const EFFORT = ["weekend", "one_week", "two_weeks"] as const;

/** Fixed list so code can look up the price band. "community" is deliberately absent (spec: not in v1). */
export const FORMAT = [
  "priority_dm",
  "template_pack",
  "checklist",
  "notes",
  "prompt_pack",
  "ebook_guide",
  "roadmap",
  "workshop",
  "call_1on1",
  "short_course",
  "call_package",
  "mentorship",
] as const;
export type Format = (typeof FORMAT)[number];
export type Tier = (typeof TIER)[number];
export type NicheType = (typeof NICHE_TYPE)[number];

export const FORMAT_LABEL: Record<Format, string> = {
  priority_dm: "Priority DM",
  template_pack: "Template pack",
  checklist: "Checklist",
  notes: "Notes",
  prompt_pack: "Prompt pack",
  ebook_guide: "Ebook / guide",
  roadmap: "Roadmap",
  workshop: "Live workshop",
  call_1on1: "1:1 call (30 min)",
  short_course: "Short recorded course",
  call_package: "Call package",
  mentorship: "Mentorship",
};

/** Topics that get a code-written disclaimer on the public page. */
export const SAFETY_TOPIC = ["finance", "health", "astrology", "none"] as const;
export type SafetyTopic = (typeof SAFETY_TOPIC)[number];

/** What the MODEL writes for one product. No price_rationale: code writes that from the final price. */
export const ModelProductSchema = z.object({
  id: z.string(),
  format: z.enum(FORMAT),
  tier: z.enum(TIER),
  title: z.string(),
  description: z.string(),
  whats_inside: z.array(z.string()),
  price_inr: z.number(),
  effort_to_create: z.enum(EFFORT),
});
export type ModelProduct = z.infer<typeof ModelProductSchema>;

/** A product on the final page: the model's product plus code's "why this price". */
export const ProductSchema = ModelProductSchema.extend({ price_rationale: z.string() });
export type Product = z.infer<typeof ProductSchema>;

export const CreatorSchema = z.object({
  display_name: z.string(),
  niche: z.string(),
  niche_type: z.enum(NICHE_TYPE),
  safety_topic: z.enum(SAFETY_TOPIC),
  tagline: z.string(),
  bio: z.string(),
  language: z.enum(LANGUAGE),
});

/** What the MODEL writes for a whole page. */
export const ModelStorefrontSchema = z.object({
  creator: CreatorSchema,
  products: z.array(ModelProductSchema),
});
export type ModelStorefront = z.infer<typeof ModelStorefrontSchema>;

/** The final page: code adds price_rationale per product and the disclaimer. */
export const StorefrontSchema = z.object({
  creator: CreatorSchema,
  products: z.array(ProductSchema),
  disclaimer: z.string().nullable(),
});
export type Storefront = z.infer<typeof StorefrontSchema>;

/** Anything from a bare model draft to a final page (old pages may lack the code-owned fields). */
export type Draft = {
  creator: Omit<Storefront["creator"], "safety_topic"> & { safety_topic?: SafetyTopic };
  products: (ModelProduct & { price_rationale?: string })[];
  disclaimer?: string | null;
};

// ---------- Gate response (what the model returns for a generation) ----------
// Sent to the model as ONE flat object with nullable fields, because a flat
// object is the safest shape for both Groq strict mode and Gemini.

export const GateWireSchema = z.object({
  status: z.enum(["ready", "needs_more_info"]),
  storefront: ModelStorefrontSchema.nullable(),
  question: z.string().nullable(),
  suggestions: z.array(z.string()).nullable(),
});

export type GateResponse =
  | { status: "ready"; storefront: ModelStorefront }
  | { status: "needs_more_info"; question: string; suggestions: string[] };

/** Turns the flat wire object into a clean union. Throws a readable message if fields are missing. */
export function toGateResponse(wire: z.infer<typeof GateWireSchema>): GateResponse {
  if (wire.status === "ready") {
    if (!wire.storefront) throw new Error('status is "ready" but storefront is null');
    return { status: "ready", storefront: wire.storefront };
  }
  if (!wire.question) throw new Error('status is "needs_more_info" but question is null');
  // Missing suggestions are not fatal here: validateGate flags them and the model gets one retry.
  return { status: "needs_more_info", question: wire.question, suggestions: wire.suggestions ?? [] };
}

// ---------- Regenerate one block ----------

export const CHIPS = ["try_another", "shorter", "more_casual", "more_premium", "cheaper"] as const;
export type Chip = (typeof CHIPS)[number];

export const AboutBlockSchema = z.object({ tagline: z.string(), bio: z.string() });
export const ProductBlockSchema = z.object({ product: ModelProductSchema });

// ---------- JSON Schema for the providers ----------

const STRIP_KEYS = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "default",
]);

/**
 * Zod -> JSON Schema in the strict style both providers accept:
 * every object closed (additionalProperties:false), every property required,
 * and no length/range keywords (our validator checks those).
 */
export function toProviderJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<string, unknown>;
  return clean(raw) as Record<string, unknown>;
}

function clean(node: unknown, isPropertyMap = false): unknown {
  if (Array.isArray(node)) return node.map((n) => clean(n));
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    // Inside "properties", keys are OUR field names (e.g. a field called "format"), never keywords.
    if (!isPropertyMap && STRIP_KEYS.has(k)) continue;
    out[k] = clean(v, k === "properties" && !isPropertyMap);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as object);
  }
  return out;
}
