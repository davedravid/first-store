/** Deletes a test store and its sign-ups from Upstash. Run: node --env-file=.env.local --import tsx tests/ui/cleanup.mts <slug> */
import { redis } from "../../src/lib/redis";
const slug = process.argv[2];
if (!redis || !slug || !/^[a-z0-9-]+-[a-z0-9]{4}$/.test(slug)) throw new Error("need a slug like name-ab12");
const keys = ["store", "want", "wantn", "wantset", "evs"].map((k) => `fs:${k}:${slug}`);
console.log("deleted keys:", await redis.del(...keys), "for", slug);
