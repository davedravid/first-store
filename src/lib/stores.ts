/**
 * Published stores, "I want this" sign-ups and funnel events, all in Upstash Redis.
 *
 * fs:store:<slug>     JSON: the store, the creator's input (needed to edit later) and a SHA-256 of the edit token
 * fs:want:<slug>      list of sign-ups (newest first, capped at 500): product, name, contact, time
 * fs:wantn:<slug>     hash: product id -> number of people who want it
 * fs:wantset:<slug>   set of "product|contact", so the same person is counted once per product
 * fs:ev:<day>         hash: funnel event -> count for that UTC day; fs:evs:<slug> per store
 *
 * The edit token is never stored, only its hash. Sign-up contacts are only ever returned with the right token.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CreatorInputSchema, StorefrontSchema, type CreatorInput, type Storefront } from "./ai/schema";
import { DISCLAIMERS, safetyTopic } from "./ai/validators";
import { redis } from "./redis";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,40}$/;

export type StoredStore = { v: 1; slug: string; input: CreatorInput; storefront: Storefront; tokenHash: string; createdAt: number; updatedAt: number };

/** Caps for creator-edited text. A little above the model limits, since the creator may edit by hand. */
const str = (max: number) => z.string().trim().min(1).max(max);
export const PublishStoreSchema = StorefrontSchema.extend({
  creator: StorefrontSchema.shape.creator.extend({ display_name: str(60), niche: str(80), tagline: str(140), bio: str(700) }),
  products: z
    .array(
      StorefrontSchema.shape.products.element.extend({
        id: z.string().regex(/^[\w-]{1,20}$/),
        title: str(90),
        description: str(360),
        whats_inside: z.array(str(120)).min(1).max(5),
        price_inr: z.number().int().min(1).max(99999),
        price_rationale: z.string().max(400),
      }),
    )
    .min(1)
    .max(4),
});

export const PublishBodySchema = z.object({
  input: CreatorInputSchema,
  storefront: PublishStoreSchema,
  slug: z.string().regex(SLUG_RE).optional(),
  token: z.string().min(16).max(64).optional(),
});

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

function tokenMatches(token: string, tokenHash: string) {
  const a = Buffer.from(hash(token), "hex");
  const b = Buffer.from(tokenHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function slugBase(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .replace(/-$/, "");
  return base.length >= 3 ? base : "store";
}

/** The disclaimer is always re-derived on the server, so a page can never be published without it. */
function finalise(input: CreatorInput, sf: Storefront): Storefront {
  const topic = safetyTopic(input, sf);
  return { ...sf, creator: { ...sf.creator, safety_topic: topic }, disclaimer: topic === "none" ? null : DISCLAIMERS[topic] };
}

export type PublishResult = { ok: true; slug: string; token: string } | { ok: false; reason: "no_db" | "bad_token" | "not_found" | "busy" };

export async function publishStore(body: z.infer<typeof PublishBodySchema>): Promise<PublishResult> {
  if (!redis) return { ok: false, reason: "no_db" };
  const storefront = finalise(body.input, body.storefront);
  const now = Date.now();

  // Update an existing store: the token must match.
  if (body.slug && body.token) {
    const old = await getStore(body.slug);
    if (!old) return { ok: false, reason: "not_found" };
    if (!tokenMatches(body.token, old.tokenHash)) return { ok: false, reason: "bad_token" };
    const next: StoredStore = { ...old, input: body.input, storefront, updatedAt: now };
    await redis.set(`fs:store:${body.slug}`, JSON.stringify(next));
    return { ok: true, slug: body.slug, token: body.token };
  }

  // New store: a readable slug plus 4 random characters, claimed with SET NX so two stores never collide.
  const token = randomBytes(18).toString("base64url");
  const base = slugBase(storefront.creator.display_name);
  for (let i = 0; i < 4; i++) {
    const slug = `${base}-${randomBytes(3).toString("hex").slice(0, 4)}`;
    const rec: StoredStore = { v: 1, slug, input: body.input, storefront, tokenHash: hash(token), createdAt: now, updatedAt: now };
    if (await redis.set(`fs:store:${slug}`, JSON.stringify(rec), { nx: true })) return { ok: true, slug, token };
  }
  return { ok: false, reason: "busy" };
}

export async function getStore(slug: string): Promise<StoredStore | null> {
  if (!redis || !SLUG_RE.test(slug)) return null;
  const raw = await redis.get<StoredStore | string>(`fs:store:${slug}`);
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as StoredStore) : raw;
}

/** For the public page: never the input, the token hash or the editor-only "why this price". */
export type PublicStore = { slug: string; storefront: Storefront };
export function toPublic(s: StoredStore): PublicStore {
  return { slug: s.slug, storefront: { ...s.storefront, products: s.storefront.products.map((p) => ({ ...p, price_rationale: "" })) } };
}

// ---------- "I want this" ----------

export const WantBodySchema = z.object({
  slug: z.string().regex(SLUG_RE),
  productId: z.string().regex(/^[\w-]{1,20}$/),
  name: z.string().trim().min(1).max(60),
  contact: z.string().trim().min(5).max(120),
  consent: z.literal(true),
});

/** An Indian mobile number (10 digits starting 6-9, optional +91 or 0) or an email. Returns the cleaned value or null. */
export function cleanContact(raw: string): string | null {
  const v = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return v.toLowerCase();
  const digits = v.replace(/[\s\-().]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export type Signup = { productId: string; name: string; contact: string; at: number };

export async function addWant(slug: string, productId: string, name: string, contact: string): Promise<"ok" | "duplicate" | "not_found" | "no_db"> {
  if (!redis) return "no_db";
  const store = await getStore(slug);
  if (!store || !store.storefront.products.some((p) => p.id === productId)) return "not_found";
  const fresh = await redis.sadd(`fs:wantset:${slug}`, `${productId}|${contact}`);
  if (!fresh) return "duplicate";
  const entry: Signup = { productId, name, contact, at: Date.now() };
  await Promise.all([redis.lpush(`fs:want:${slug}`, JSON.stringify(entry)), redis.hincrby(`fs:wantn:${slug}`, productId, 1)]);
  await redis.ltrim(`fs:want:${slug}`, 0, 499);
  return "ok";
}

export type Interest = { counts: Record<string, number>; signups: Signup[] };

export async function getInterest(slug: string): Promise<Interest> {
  if (!redis) return { counts: {}, signups: [] };
  const [counts, list] = await Promise.all([redis.hgetall<Record<string, number>>(`fs:wantn:${slug}`), redis.lrange<Signup | string>(`fs:want:${slug}`, 0, 99)]);
  return {
    counts: Object.fromEntries(Object.entries(counts ?? {}).map(([k, n]) => [k, Number(n)])),
    signups: list.map((x) => (typeof x === "string" ? (JSON.parse(x) as Signup) : x)),
  };
}

/** Load a store for its creator: needs the token. */
export async function loadForEdit(slug: string, token: string) {
  const s = await getStore(slug);
  if (!s || !tokenMatches(token, s.tokenHash)) return null;
  return { input: s.input, storefront: s.storefront, interest: await getInterest(slug) };
}

// ---------- funnel events (spec decision 12) ----------

export const EVENTS = [
  "generate",
  "needs_more_info",
  "edit",
  "regenerate",
  "publish",
  "share_click",
  "page_view",
  "want_this_submit",
  "superprofile_click",
] as const;
export type FunnelEvent = (typeof EVENTS)[number];

export async function track(event: FunnelEvent, slug?: string) {
  if (!redis) return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    await Promise.all([
      redis.hincrby(`fs:ev:${day}`, event, 1),
      ...(slug && SLUG_RE.test(slug) ? [redis.hincrby(`fs:evs:${slug}`, event, 1)] : []),
    ]);
  } catch {
    // Analytics must never break the product.
  }
}
