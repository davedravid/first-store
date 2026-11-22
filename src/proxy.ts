import { NextResponse, type NextRequest } from "next/server";
import { redis } from "@/lib/redis";

// Same pattern as SLUG_RE in lib/stores.ts (kept inline so the proxy stays small).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,40}$/;

/**
 * A missing store must answer with a real 404. The public page streams (so its status is fixed at 200
 * before the data loads), so the check happens here, before the page starts: one EXISTS call per visit.
 */
export const config = { matcher: "/s/:slug" };

export async function proxy(req: NextRequest) {
  const slug = req.nextUrl.pathname.split("/")[2] ?? "";
  let exists = SLUG_RE.test(slug);
  if (exists && redis) {
    try {
      exists = (await redis.exists(`fs:store:${slug}`)) === 1;
    } catch {
      return NextResponse.next(); // if Redis is down, let the page handle it
    }
  }
  if (!exists) return NextResponse.rewrite(new URL("/store-missing", req.url), { status: 404 });
  return NextResponse.next();
}
