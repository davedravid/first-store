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
export type LimitKind = "generate" | "regenerate";
export type LimitResult = { ok: true } | { ok: false; reason: "ip" | "daily"; retryAfterSec: number };

const perIp = Number(process.env.RATE_LIMIT_GENERATE_PER_IP) || 10;
const windowStr = (process.env.RATE_LIMIT_WINDOW || "1 h") as Duration;
const dailyCap = Number(process.env.DAILY_CAP) || 50;
const factor: Record<LimitKind, number> = { generate: 1, regenerate: 3 };

const limiters: Record<LimitKind, Ratelimit> | null = redis
  ? {
      generate: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(perIp, windowStr), prefix: "fs:rl:gen" }),
      regenerate: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(perIp * 3, windowStr), prefix: "fs:rl:regen" }),
    }
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
  const cap = dailyCap * factor[kind];

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
