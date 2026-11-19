/**
 * The AI engine. No UI here.
 *
 * generateStorefront():
 *   pre-checks -> primary (Groq) -> parse -> validators
 *     -> invalid? ONE retry on the primary with the errors fed back
 *     -> still invalid, or timeout / 429 / provider error? -> fallback (Gemini Flash-Lite), one try
 *     -> still failing? -> typed EngineError the UI turns into a friendly retry screen
 *
 * Time budget (fits Vercel Hobby: functions may run up to 300 s; our routes set maxDuration = 60):
 *   Groq 10 s + Groq retry 10 s + Gemini 25 s = 45 s worst case, inside our own 55 s budget.
 *
 * regenerateBlock(): same chain for one block, with the full current page as context.
 */
import { engineError, ProviderError, type EngineError, type ProviderFailureKind } from "./errors";
import { logCall, newRequestId, type CallLog } from "./log";
import { precheck } from "./precheck";
import { generatePrompt, regeneratePrompt, retryNote, systemPrompt } from "./prompts";
import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import type { LLMResponse, Provider, ProviderName } from "./providers/types";
import {
  AboutBlockSchema,
  GateWireSchema,
  ProductBlockSchema,
  toGateResponse,
  toProviderJsonSchema,
  type Chip,
  type CreatorInput,
  type Product,
  type Storefront,
} from "./schema";
import {
  errorsForRetry,
  priceBand,
  stepPrice,
  validateGate,
  validateStorefront,
  type Category,
  type Fix,
  type Issue,
} from "./validators";

// ---------- settings ----------

export const TIMEOUTS = {
  groqMs: 10_000,
  geminiMs: 25_000,
  budgetMs: 55_000,
};

const PROVIDERS: Record<ProviderName, Provider> = { groq: callGroq, gemini: callGemini };

export type SimulateMode = "slow" | "fail" | "badjson";
export const SIMULATE_MODES: SimulateMode[] = ["slow", "fail", "badjson"];

export type EngineOptions = {
  /** "report" = fix nothing, no retry (v1 eval). Default "enforce". */
  mode?: "enforce" | "report";
  /** Force a provider list, e.g. ["groq"] for evals. Default: LLM_PRIMARY then LLM_FALLBACK. */
  providers?: ProviderName[];
  /** Folder with system.md / generate.md / regenerate.md. Default "prompts". */
  promptDir?: string;
  simulate?: SimulateMode;
  requestId?: string;
};

export type EngineMeta = {
  requestId: string;
  provider?: ProviderName;
  model?: string;
  usedFallback: boolean;
  calls: CallLog[];
  totalMs: number;
  /** Decided before any model call (pre-checks). */
  local?: "handle_only" | "no_words";
  fixes: Fix[];
  issues: Issue[];
  modelChecks?: Record<Category, boolean>;
  finalChecks?: Record<Category, boolean>;
  /** What the model wrote before code fixes (for evals). */
  modelStorefront?: Storefront;
  /** The model's last draft when everything failed (for evals and debugging; never sent to the UI). */
  lastDraft?: unknown;
};

export type GenerateResult =
  | { ok: true; status: "ready"; storefront: Storefront; meta: EngineMeta }
  | { ok: true; status: "needs_more_info"; question: string; suggestions: string[]; meta: EngineMeta }
  | { ok: false; error: EngineError; meta: EngineMeta };

export type RegenTarget = { kind: "about" } | { kind: "product"; productId: string };

export type RegenerateResult =
  | { ok: true; storefront: Storefront; previous: unknown; meta: EngineMeta }
  | { ok: false; error: EngineError; meta: EngineMeta };

// ---------- public: generate ----------

export async function generateStorefront(input: CreatorInput, opts: EngineOptions = {}): Promise<GenerateResult> {
  const started = Date.now();
  const meta: EngineMeta = { requestId: opts.requestId ?? newRequestId(), usedFallback: false, calls: [], totalMs: 0, fixes: [], issues: [] };
  const done = <T extends GenerateResult>(r: T): T => ((r.meta.totalMs = Date.now() - started), r);

  const pre = precheck(input);
  if (pre.kind === "error") return done({ ok: false, error: pre.error, meta });
  if (pre.kind === "gate") return done({ ok: true, ...pre.gate, meta: { ...meta, local: pre.reason } });

  const mode = opts.mode ?? "enforce";
  type Parsed =
    | { status: "ready"; storefront: Storefront; model: Storefront; v: ReturnType<typeof validateStorefront> }
    | { status: "needs_more_info"; question: string; suggestions: string[] };

  const out = await runChain<Parsed>({
    kind: "generate",
    opts,
    meta,
    started,
    system: systemPrompt(opts.promptDir),
    user: generatePrompt(input, opts.promptDir),
    schemaName: "storefront_gate",
    schema: toProviderJsonSchema(GateWireSchema),
    parse: (json) => {
      const gate = toGateResponse(GateWireSchema.parse(json));
      if (gate.status === "needs_more_info") {
        if (mode === "enforce" && gate.suggestions.length > 3) gate.suggestions = gate.suggestions.slice(0, 3);
        return { value: gate, issues: validateGate(gate) };
      }
      const v = validateStorefront(input, gate.storefront, mode);
      return { value: { status: "ready", storefront: v.storefront, model: gate.storefront, v }, issues: v.errors, fixes: v.fixes };
    },
  });

  if (!out.ok) return done({ ok: false, error: out.error, meta });
  const val = out.value;
  if (val.status === "needs_more_info")
    return done({ ok: true, status: "needs_more_info", question: val.question, suggestions: val.suggestions, meta });

  meta.fixes = val.v.fixes;
  meta.issues = val.v.errors;
  meta.modelChecks = val.v.modelChecks;
  meta.finalChecks = val.v.finalChecks;
  meta.modelStorefront = val.model;
  return done({ ok: true, status: "ready", storefront: val.storefront, meta });
}

// ---------- public: regenerate one block ----------

export async function regenerateBlock(
  args: { input: CreatorInput; storefront: Storefront; target: RegenTarget; chip: Chip },
  opts: EngineOptions = {},
): Promise<RegenerateResult> {
  const started = Date.now();
  const meta: EngineMeta = { requestId: opts.requestId ?? newRequestId(), usedFallback: false, calls: [], totalMs: 0, fixes: [], issues: [] };
  const done = <T extends RegenerateResult>(r: T): T => ((r.meta.totalMs = Date.now() - started), r);
  const { input, storefront: page, target, chip } = args;

  const index = target.kind === "product" ? page.products.findIndex((p) => p.id === target.productId) : -1;
  if (target.kind === "product" && index < 0)
    return done({ ok: false, error: engineError("LLM_UNAVAILABLE", "That product is not on the page."), meta });

  const previous = target.kind === "about" ? { tagline: page.creator.tagline, bio: page.creator.bio } : page.products[index];
  const before = validateStorefront(input, page, "report").errors.map((i) => i.message);

  const out = await runChain<{ storefront: Storefront; fixes: Fix[] }>({
    kind: "regenerate",
    opts,
    meta,
    started,
    system: systemPrompt(opts.promptDir),
    user: regeneratePrompt(input, page, target.kind === "about" ? "the tagline and bio" : `product ${target.productId}`, previous, chip, opts.promptDir),
    schemaName: target.kind === "about" ? "about_block" : "product_block",
    schema: toProviderJsonSchema(target.kind === "about" ? AboutBlockSchema : ProductBlockSchema),
    parse: (json) => {
      const merged: Storefront = structuredClone(page);
      if (target.kind === "about") {
        const b = AboutBlockSchema.parse(json);
        merged.creator.tagline = b.tagline;
        merged.creator.bio = b.bio;
      } else {
        const old = page.products[index];
        const p: Product = { ...ProductBlockSchema.parse(json).product, id: old.id, tier: old.tier };
        // Cheaper / More premium: code moves the price one step; the model only rewrites the copy.
        if (chip === "cheaper" || chip === "more_premium")
          p.price_inr = stepPrice(old.price_inr, priceBand(p.format, input.audience, merged.creator.niche_type), chip === "cheaper" ? -1 : 1);
        merged.products[index] = p;
      }
      const v = validateStorefront(input, merged, opts.mode ?? "enforce");
      // Only problems this regeneration introduced count; the creator's own edits elsewhere never block it.
      const fresh = v.errors.filter((e) => !before.includes(e.message));
      return { value: { storefront: v.storefront, fixes: v.fixes }, issues: fresh, fixes: v.fixes };
    },
  });

  if (!out.ok) return done({ ok: false, error: out.error, meta });
  meta.fixes = out.value.fixes;
  return done({ ok: true, storefront: out.value.storefront, previous, meta });
}

// ---------- the retry / fallback chain ----------

type ChainArgs<T> = {
  kind: "generate" | "regenerate";
  opts: EngineOptions;
  meta: EngineMeta;
  started: number;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  parse: (json: unknown) => { value: T; issues: Issue[]; fixes?: Fix[] };
};

function providerOrder(opts: EngineOptions): ProviderName[] {
  if (opts.providers?.length) return opts.providers;
  const list = [process.env.LLM_PRIMARY, process.env.LLM_FALLBACK].filter(
    (p): p is ProviderName => p === "groq" || p === "gemini",
  );
  return [...new Set(list.length ? list : (["groq", "gemini"] as ProviderName[]))];
}

function modelFor(provider: ProviderName, kind: "generate" | "regenerate"): string {
  if (provider === "groq") return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  return (kind === "generate" ? process.env.MODEL_GENERATE : process.env.MODEL_REGEN) || "gemini-3.5-flash-lite";
}

async function runChain<T>(a: ChainArgs<T>): Promise<{ ok: true; value: T } | { ok: false; error: EngineError }> {
  const mode = a.opts.mode ?? "enforce";
  const order = providerOrder(a.opts);
  const deadline = a.started + TIMEOUTS.budgetMs;
  let feedback = "";
  const failures: ProviderFailureKind[] = [];
  let lastIssues: Issue[] = [];
  let callNo = 0;

  for (let pi = 0; pi < order.length; pi++) {
    const provider = order[pi];
    const model = modelFor(provider, a.kind);
    const attempts = pi === 0 && mode === "enforce" ? 2 : 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      callNo++;
      const cap = provider === "groq" ? TIMEOUTS.groqMs : TIMEOUTS.geminiMs;
      const timeoutMs = Math.min(cap, deadline - Date.now() - 500);
      if (timeoutMs < 2_000) return { ok: false, error: engineError("LLM_TIMEOUT", "Ran out of time.") };

      const log: CallLog = {
        event: "llm_call",
        requestId: a.meta.requestId,
        kind: a.kind,
        provider,
        model,
        attempt,
        fallback: pi > 0,
        outcome: "ok",
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: 0,
        ...(a.opts.simulate ? { simulated: a.opts.simulate } : {}),
      };

      let res: LLMResponse;
      const callStarted = Date.now();
      try {
        res = await callWithSimulation(provider, callNo, a.opts.simulate, {
          model,
          system: a.system,
          user: a.user + (feedback ? retryNote(feedback) : ""),
          schema: a.schema,
          schemaName: a.schemaName,
          timeoutMs,
        });
      } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError("network", String(e));
        failures.push(err.kind);
        log.outcome = err.kind === "timeout" ? "timeout" : err.kind === "rate_limit" ? "rate_limit" : err.kind === "daily_limit" ? "daily_limit" : err.kind === "bad_json" ? "bad_json" : "error";
        log.latency_ms = Date.now() - callStarted;
        log.error = err.message.slice(0, 200);
        record(a.meta, log);
        if (err.kind === "bad_json") {
          feedback = "Your reply was not valid JSON for the schema. Return only JSON that matches the schema exactly.";
          continue; // same provider, next attempt
        }
        break; // timeout, 429, outage, no key: go straight to the next provider
      }

      log.input_tokens = res.inputTokens;
      log.output_tokens = res.outputTokens;
      log.latency_ms = res.latencyMs;
      log.rate = res.rate;

      let parsed: ReturnType<ChainArgs<T>["parse"]>;
      try {
        const json = JSON.parse(res.text);
        a.meta.lastDraft = json;
        parsed = a.parse(json);
      } catch (e) {
        failures.push("bad_json");
        log.outcome = "bad_json";
        log.error = String((e as Error).message).slice(0, 200);
        record(a.meta, log);
        feedback = `Your reply could not be read: ${String((e as Error).message).slice(0, 200)}. Return only JSON that matches the schema exactly.`;
        if (mode === "report") return { ok: false, error: engineError("VALIDATION_FAILED", "The model's reply could not be read.") };
        continue;
      }

      if (parsed.issues.length === 0 || mode === "report") {
        record(a.meta, log);
        a.meta.provider = provider;
        a.meta.model = model;
        a.meta.usedFallback = pi > 0;
        return { ok: true, value: parsed.value };
      }

      log.outcome = "invalid";
      record(a.meta, log);
      lastIssues = parsed.issues;
      feedback = errorsForRetry(parsed.issues);
    }
  }

  a.meta.issues = lastIssues;
  return { ok: false, error: finalError(failures, lastIssues.length > 0) };
}

function record(meta: EngineMeta, log: CallLog) {
  meta.calls.push(log);
  logCall(log);
}

function finalError(failures: ProviderFailureKind[], hadInvalid: boolean): EngineError {
  const last = failures[failures.length - 1];
  if (hadInvalid && (failures.length === 0 || last === "bad_json"))
    return engineError("VALIDATION_FAILED", "The draft kept breaking our quality rules.");
  if (failures.length && failures.every((f) => f === "timeout")) return engineError("LLM_TIMEOUT", "The AI took too long to answer.");
  if (failures.some((f) => f === "rate_limit" || f === "daily_limit")) return engineError("RATE_LIMITED", "Too many requests right now.");
  if (hadInvalid) return engineError("VALIDATION_FAILED", "The draft kept breaking our quality rules.");
  return engineError("LLM_UNAVAILABLE", "The AI service is not available right now.");
}

// ---------- ?simulate= for demos ----------

async function callWithSimulation(
  provider: ProviderName,
  callNo: number,
  simulate: SimulateMode | undefined,
  req: Parameters<Provider>[0],
): Promise<LLMResponse> {
  if (simulate === "fail") throw new ProviderError("http", `Simulated outage on ${provider}`, 503);
  if (simulate === "slow" && callNo === 1) {
    await new Promise((r) => setTimeout(r, req.timeoutMs));
    throw new ProviderError("timeout", `Simulated: ${provider} did not answer within ${req.timeoutMs} ms`);
  }
  if (simulate === "badjson" && callNo === 1)
    return { text: '{"status":"ready","storefront":{"creator":{"display_name":', inputTokens: 0, outputTokens: 0, latencyMs: 5 };
  return PROVIDERS[provider](req);
}
