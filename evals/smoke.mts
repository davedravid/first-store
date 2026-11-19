/**
 * One quick real call to check the engine end to end. Never prints keys.
 * Run: node --env-file=.env.local --import tsx evals/smoke.ts [groq|gemini] [simulate]
 */
import { generateStorefront, type SimulateMode } from "../src/lib/ai/engine";
import type { ProviderName } from "../src/lib/ai/providers/types";
import { GateWireSchema, toProviderJsonSchema } from "../src/lib/ai/schema";

const provider = (process.argv[2] as ProviderName) || "groq";
const simulate = process.argv[3] as SimulateMode | undefined;

if (process.argv.includes("--schema")) {
  console.log(JSON.stringify(toProviderJsonSchema(GateWireSchema)).slice(0, 1500));
  process.exit(0);
}

process.env.AI_LOG_SILENT = "1";
const r = await generateStorefront(
  {
    description: "I am Neha, I post easy 20 minute dinner recipes for working couples in Pune. Mostly veg, some egg.",
    audience: "5k_25k",
    language: "en",
  },
  { providers: simulate ? undefined : [provider], simulate },
);
console.log(JSON.stringify({ ok: r.ok, status: r.ok ? r.status : r.error, provider: r.meta.provider, fallback: r.meta.usedFallback, totalMs: r.meta.totalMs, calls: r.meta.calls.map((c) => `${c.provider} a${c.attempt} ${c.outcome} in=${c.input_tokens} out=${c.output_tokens} ${c.latency_ms}ms rateLeft=${c.rate?.remainingTokens}`), fixes: r.meta.fixes, issues: r.meta.issues }, null, 1));
if (r.ok && r.status === "ready") console.log(JSON.stringify(r.storefront, null, 1));
