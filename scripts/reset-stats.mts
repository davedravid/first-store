/**
 * Clears the funnel counters (fs:ev:<day>, fs:evs:<slug>) and today's quota counters (fs:cap:*).
 * Stores, sign-ups and rate limits are not touched.
 * Run: npm run reset-stats            (dry run: lists what would be deleted)
 *      npm run reset-stats -- --yes   (deletes)
 */
import { redis } from "../src/lib/redis";

if (!redis) throw new Error("Upstash env values are missing (.env.local).");
const doIt = process.argv.includes("--yes");
const found: string[] = [];
for (const match of ["fs:ev:*", "fs:evs:*", "fs:cap:*"]) {
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, { match, count: 200 });
    cursor = String(next);
    found.push(...keys);
  } while (cursor !== "0");
}
console.log(`${found.length} stats keys found.`);
if (!doIt) {
  console.log("Dry run. Add -- --yes to delete them.");
} else if (found.length) {
  for (let i = 0; i < found.length; i += 100) await redis.del(...found.slice(i, i + 100));
  console.log("Deleted.");
}
