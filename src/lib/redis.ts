import { Redis } from "@upstash/redis";

/**
 * One shared Upstash Redis client (HTTP, so it works on Vercel with no connection pool).
 * Returns null when the env values are missing, so the app still runs locally without Redis.
 */
export const redis: Redis | null =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;
