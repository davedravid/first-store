/**
 * Groq (primary). OpenAI-compatible endpoint, strict json_schema structured output.
 * Plain fetch, no SDK: the same request was tested by hand on 19 Nov 2026.
 */
import { ProviderError } from "../errors";
import type { LLMRequest, LLMResponse } from "./types";

const URL = "https://api.groq.com/openai/v1/chat/completions";

export async function callGroq(req: LLMRequest): Promise<LLMResponse> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new ProviderError("no_key", "GROQ_API_KEY is not set");

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: req.model,
        temperature: req.temperature ?? 0.7,
        max_completion_tokens: 4000,
        reasoning_effort: "low", // gpt-oss thinks before answering; low keeps it fast and cheap on tokens
        include_reasoning: false,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: req.schemaName, strict: true, schema: req.schema },
        },
      }),
      signal: AbortSignal.timeout(req.timeoutMs),
    });
  } catch (e) {
    const name = (e as Error).name;
    if (name === "TimeoutError" || name === "AbortError")
      throw new ProviderError("timeout", `Groq did not answer within ${req.timeoutMs} ms`);
    throw new ProviderError("network", "Could not reach Groq");
  }

  const rate = {
    remainingTokens: num(res.headers.get("x-ratelimit-remaining-tokens")),
    resetTokensMs: duration(res.headers.get("x-ratelimit-reset-tokens")),
    remainingRequests: num(res.headers.get("x-ratelimit-remaining-requests")),
  };
  const body = (await res.json().catch(() => ({}))) as GroqBody;

  if (res.status === 429) {
    const msg = body?.error?.message ?? "";
    const retryAfter = (num(res.headers.get("retry-after")) ?? 0) * 1000 || rate.resetTokensMs;
    // Groq names the limit in the message, e.g. "tokens per day (TPD)".
    const daily = /per day|\bTPD\b|\bRPD\b/i.test(msg);
    throw new ProviderError(daily ? "daily_limit" : "rate_limit", daily ? "Groq daily quota used up" : "Groq rate limit", 429, retryAfter);
  }
  if (!res.ok) {
    // Strict mode rejects output that does not match the schema with a 400.
    if (res.status === 400 && /schema|json/i.test(body?.error?.message ?? ""))
      throw new ProviderError("bad_json", `Groq output did not match the schema: ${body?.error?.message?.slice(0, 160)}`, 400);
    throw new ProviderError("http", `Groq HTTP ${res.status}: ${body?.error?.message?.slice(0, 160) ?? ""}`, res.status);
  }

  return {
    text: body.choices?.[0]?.message?.content ?? "",
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - started,
    rate,
  };
}

type GroqBody = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

function num(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Parses Groq reset values like "7.66s", "1m30.5s", "120ms". */
function duration(v: string | null): number | undefined {
  if (!v) return undefined;
  let ms = 0;
  for (const [, n, unit] of v.matchAll(/([\d.]+)(ms|h|m|s)/g)) {
    const x = parseFloat(n);
    ms += unit === "h" ? x * 3_600_000 : unit === "m" ? x * 60_000 : unit === "s" ? x * 1000 : x;
  }
  return Math.round(ms);
}
