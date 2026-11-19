/**
 * One JSON line per model call. On Vercel these show up in the project's Logs tab.
 * Never logs keys or the creator's text.
 */
export type CallLog = {
  event: "llm_call";
  requestId: string;
  kind: "generate" | "regenerate";
  provider: "groq" | "gemini";
  model: string;
  attempt: number; // 1 = first try, 2 = retry with errors fed back
  fallback: boolean; // true when the backup provider served this call
  outcome: "ok" | "invalid" | "bad_json" | "timeout" | "rate_limit" | "daily_limit" | "error";
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  simulated?: string;
  /** Short reason when the call failed (provider message or parse error). Never contains keys or creator text. */
  error?: string;
  /** Groq's "tokens left this minute" and when it resets, used by the eval pacing. */
  rate?: { remainingTokens?: number; resetTokensMs?: number; remainingRequests?: number };
};

export function logCall(entry: CallLog): void {
  if (process.env.AI_LOG_SILENT === "1") return;
  console.log(JSON.stringify(entry));
}

export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}
