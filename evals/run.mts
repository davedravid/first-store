/**
 * Eval harness. Groq only, one case at a time, paced for the free tier.
 *
 *   v1 = first prompt (evals/prompts_v1), validators in REPORT-ONLY mode, no retry
 *   v2 = improved prompt (prompts/),       validators ENFORCING, one retry
 *
 * Run:  node --env-file=.env.local --import tsx evals/run.mts v1
 *       node --env-file=.env.local --import tsx evals/run.mts v2 [--fresh] [--only=R01-fitness-moms,U03-just-ca]
 *
 * Quota guard: Groq's free tier gives about 200K tokens a day, shared with the live app.
 * The harness keeps a ledger (evals/ledger.json) and stops while at least 30K tokens are still left today.
 * Results are saved after every case, so a stopped run resumes where it left off.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generateStorefront, type EngineOptions, type GenerateResult } from "../src/lib/ai/engine";
import type { CreatorInput, Storefront } from "../src/lib/ai/schema";
import type { Category } from "../src/lib/ai/validators";

process.env.AI_LOG_SILENT = "1";

const DAILY_TOKENS = 200_000;
const KEEP_FREE = 30_000;
const CASE_ESTIMATE = 6_000; // worst case for one case (call + retry)
const MIN_GAP_MS = 8_000;
const LOW_TPM = 5_000; // wait for the minute window to reset below this

export const SCORED: Category[] = ["invented_facts", "hype_words", "price_in_band", "tier_order", "distinct_formats", "safe_claims"];

type Case = {
  id: string;
  group: "realistic" | "ugly";
  label: string;
  expect: "ready" | "needs_more_info" | "too_long" | "either";
  repeat_to?: number;
  must_not_contain?: string[];
  input: CreatorInput;
};

export type CaseResult = {
  id: string;
  label: string;
  group: string;
  expect: Case["expect"];
  outcome: "ready" | "needs_more_info" | "error";
  errorCode?: string;
  statusOk: boolean;
  checks?: Record<string, boolean>; // the 6 scored checks on the final page
  modelPriceInBand?: boolean; // what the model wrote, before code fixed prices
  otherRules?: Record<string, boolean>; // ladder, lengths, script, rationale (shown, not scored)
  caseSpecificOk: boolean;
  passAll: boolean;
  issues: string[];
  fixes: string[];
  calls: number;
  retried: boolean;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  storefront?: Storefront;
  question?: string;
  suggestions?: string[];
  ranAt: string;
};

// ---------- ledger ----------

const LEDGER = "evals/ledger.json";
type Ledger = { date: string; tokens: number; notes: string[] };
const today = () => new Date().toISOString().slice(0, 10); // Groq's day is assumed to be UTC

function readLedger(): Ledger {
  const l: Ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { date: today(), tokens: 0, notes: [] };
  return l.date === today() ? l : { date: today(), tokens: 0, notes: [] };
}
function addTokens(n: number) {
  const l = readLedger();
  l.tokens += n;
  writeFileSync(LEDGER, JSON.stringify(l, null, 2));
}

// ---------- scoring ----------

function score(c: Case, r: GenerateResult): CaseResult {
  const calls = r.meta.calls;
  const base = {
    id: c.id,
    label: c.label,
    group: c.group,
    expect: c.expect,
    calls: calls.length,
    retried: calls.some((x) => x.attempt > 1),
    inputTokens: calls.reduce((s, x) => s + x.input_tokens, 0),
    outputTokens: calls.reduce((s, x) => s + x.output_tokens, 0),
    latencyMs: r.meta.totalMs,
    issues: r.meta.issues.map((i) => `[${i.category}] ${i.message}`),
    fixes: r.meta.fixes.map((f) => `${f.where}: ${f.message}`),
    ranAt: new Date().toISOString(),
  };

  if (!r.ok) {
    const statusOk = c.expect === "too_long" && r.error.code === "TOO_LONG";
    return { ...base, outcome: "error", errorCode: r.error.code, statusOk, caseSpecificOk: true, passAll: statusOk };
  }
  if (r.status === "needs_more_info") {
    const statusOk = c.expect === "needs_more_info" || c.expect === "either";
    return { ...base, outcome: "needs_more_info", question: r.question, suggestions: r.suggestions, statusOk, caseSpecificOk: true, passAll: statusOk };
  }

  const checks = Object.fromEntries(SCORED.map((k) => [k, r.meta.finalChecks![k]]));
  const otherRules = Object.fromEntries((["ladder", "lengths", "script", "consistency"] as Category[]).map((k) => [k, r.meta.finalChecks![k]]));
  const text = JSON.stringify(r.storefront).toLowerCase();
  const caseSpecificOk = (c.must_not_contain ?? []).every((w) => !text.includes(w.toLowerCase()));
  const statusOk = c.expect === "ready" || c.expect === "either";
  return {
    ...base,
    outcome: "ready",
    statusOk,
    checks,
    modelPriceInBand: r.meta.modelChecks!.price_in_band,
    otherRules,
    caseSpecificOk,
    passAll: statusOk && caseSpecificOk && Object.values(checks).every(Boolean),
    storefront: r.storefront,
  };
}

// ---------- main ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const version = process.argv[2];
  if (version !== "v1" && version !== "v2" && version !== "v2.1") throw new Error("Usage: run.mts v1|v2|v2.1 [--fresh] [--only=id,id]");
  const fresh = process.argv.includes("--fresh");
  const dry = process.argv.includes("--dry"); // diagnose only: print details, do not save results
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");

  const opts: EngineOptions =
    version === "v1"
      ? { mode: "report", providers: ["groq"], promptDir: "evals/prompts_v1" }
      : { mode: "enforce", providers: ["groq"], promptDir: "prompts" };

  const out = `evals/runs/${version}.json`;
  const results: Record<string, CaseResult> = !fresh && existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  const cases: Case[] = JSON.parse(readFileSync("evals/cases.json", "utf8"));

  let lastCallAt = 0;
  for (const c of cases) {
    if (only ? !only.includes(c.id) : results[c.id]) continue;

    const ledger = readLedger();
    if (ledger.tokens + CASE_ESTIMATE > DAILY_TOKENS - KEEP_FREE) {
      console.log(`STOP: ${ledger.tokens} Groq tokens used today; keeping ${KEEP_FREE} free for testing the app. Re-run tomorrow to finish.`);
      break;
    }

    const input = { ...c.input };
    if (c.repeat_to) input.description = input.description.repeat(Math.ceil(c.repeat_to / input.description.length)).slice(0, c.repeat_to);

    const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);

    let r = await generateStorefront(input, { ...opts, requestId: `${version}-${c.id}` });
    // Minute-window 429: wait as Groq says, then try this case once more (not counted as a fail).
    if (!r.ok && r.error.code === "RATE_LIMITED" && !r.meta.calls.some((x) => x.outcome === "daily_limit")) {
      console.log(`  429 on ${c.id}, waiting 60 s and retrying once`);
      await sleep(60_000);
      r = await generateStorefront(input, { ...opts, requestId: `${version}-${c.id}-again` });
    }
    lastCallAt = Date.now();

    const used = r.meta.calls.reduce((s, x) => s + x.input_tokens + x.output_tokens, 0);
    addTokens(used);

    if (r.meta.calls.some((x) => x.outcome === "daily_limit")) {
      console.log("STOP: Groq says today's quota is used up. Re-run tomorrow to finish.");
      break;
    }

    const res = score(c, r);
    if (dry) {
      console.log(c.id, JSON.stringify(r.meta.calls.map((x) => ({ outcome: x.outcome, error: x.error }))));
      console.log("  draft:", JSON.stringify(r.meta.lastDraft)?.slice(0, 600));
    } else {
      results[c.id] = res;
      writeFileSync(out, JSON.stringify(results, null, 1));
    }
    console.log(
      `${res.passAll ? "PASS" : "FAIL"} ${c.id.padEnd(26)} ${res.outcome.padEnd(15)} ${String(res.latencyMs).padStart(6)} ms  ${String(used).padStart(5)} tok` +
        (res.passAll ? "" : `  <- ${res.issues.slice(0, 2).join(" | ").slice(0, 160) || res.errorCode || "status"}`),
    );

    // Pace on Groq's per-minute token window.
    const rate = r.meta.calls.at(-1)?.rate;
    if (rate?.remainingTokens !== undefined && rate.remainingTokens < LOW_TPM) await sleep((rate.resetTokensMs ?? 30_000) + 500);
  }

  const done = cases.filter((c) => results[c.id]);
  const pass = done.filter((c) => results[c.id].passAll).length;
  console.log(`\n${version}: ${pass}/${done.length} pass all checks (${done.length}/${cases.length} cases run). Ledger: ${readLedger().tokens} tokens today.`);
}

// Only run when called directly (report.mts imports types and SCORED from this file).
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
