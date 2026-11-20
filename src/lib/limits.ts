import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { redis } from "./redis";

/**
 * Guardrails for the free LLM quota (spec decision 13).
 * - Per-IP limit: RATE_LIMIT_GENERATE_PER_IP stores per RATE_LIMIT_WINDOW (default 10 per "1 h").
 *   Regenerates get 3x that, since one regenerate costs about a third of a store.
 * - Global daily cap: DAILY_CAP stores per UTC day across all users (default 50), and 3x that for regenerates.
 * Only requests that will call a model are counted (the route runs the free pre-checks first).
 * Without Upstash values (local dev) it falls back to an in-memory count and logs a warning once.
 */
export type LimitKind = "generate" | "regenerate" | "publish" | "want";
export type LimitResult = { ok: true } | { ok: false; reason: "ip" | "daily"; retryAfterSec: number };

const perIp = Number(process.env.RATE_LIMIT_GENERATE_PER_IP) || 10;
const wantPerIp = Number(process.env.RATE_LIMIT_WANT_PER_IP) || 5;
const windowStr = (process.env.RATE_LIMIT_WINDOW || "1 h") as Duration;
const dailyCap = Number(process.env.DAILY_CAP) || 50;

/** Per IP per window, and per UTC day across everyone. Publish and "I want this" cost no LLM quota, so their daily caps are only abuse brakes. */
const RULES: Record<LimitKind, { ip: number; daily: number; prefix: string }> = {
  generate: { ip: perIp, daily: dailyCap, prefix: "fs:rl:gen" },
  regenerate: { ip: perIp * 3, daily: dailyCap * 3, prefix: "fs:rl:regen" },
  publish: { ip: 20, daily: 500, prefix: "fs:rl:pub" },
  want: { ip: wantPerIp, daily: 2000, prefix: "fs:rl:want" },
};

const limiters: Record<LimitKind, Ratelimit> | null = redis
  ? (Object.fromEntries(
      (Object.keys(RULES) as LimitKind[]).map((k) => [k, new Ratelimit({ redis: redis!, limiter: Ratelimit.slidingWindow(RULES[k].ip, windowStr), prefix: RULES[k].prefix })]),
    ) as Record<LimitKind, Ratelimit>)
  : null;

const memory = new Map<string, number>();
let warned = false;

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

function secondsToUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.ceil((next - now.getTime()) / 1000);
}

export async function checkLimits(kind: LimitKind, ip: string): Promise<LimitResult> {
  const day = new Date().toISOString().slice(0, 10);
  const capKey = `fs:cap:${kind}:${day}`;
  const cap = RULES[kind].daily;

  if (!redis || !limiters) {
    if (!warned) {
      console.warn("[limits] Upstash env values missing: using an in-memory count (per server only).");
      warned = true;
    }
    const n = (memory.get(capKey) ?? 0) + 1;
    memory.set(capKey, n);
    return n > cap ? { ok: false, reason: "daily", retryAfterSec: secondsToUtcMidnight() } : { ok: true };
  }

  try {
    const r = await limiters[kind].limit(ip);
    if (!r.success) return { ok: false, reason: "ip", retryAfterSec: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };

    const used = await redis.incr(capKey);
    if (used === 1) await redis.expire(capKey, 60 * 60 * 26);
    if (used > cap) return { ok: false, reason: "daily", retryAfterSec: secondsToUtcMidnight() };
    return { ok: true };
  } catch (e) {
    // If Redis itself is down, do not block creators; the providers' own limits still apply.
    console.warn("[limits] Redis check failed, allowing the request:", (e as Error).message.slice(0, 80));
    return { ok: true };
  }
}
