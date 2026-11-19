/**
 * Typed errors. The UI turns each code into a friendly screen; nothing raw ever reaches the creator.
 */
export type EngineErrorCode =
  | "EMPTY_INPUT" //        nothing typed: show a gentle hint under the box
  | "TOO_LONG" //           over MAX_INPUT_CHARS: ask them to shorten it
  | "LLM_TIMEOUT" //        every provider was too slow
  | "RATE_LIMITED" //       free-tier quota or rate limit hit everywhere
  | "LLM_UNAVAILABLE" //    providers down, keys missing, or bad responses
  | "VALIDATION_FAILED"; // the output kept breaking our rules, even after retry and fallback

export type EngineError = {
  code: EngineErrorCode;
  /** True when trying again in a moment can work. */
  retryable: boolean;
  /** Plain message for logs and for the UI to adapt. Never contains provider internals. */
  message: string;
  /** Extra numbers for the UI, like the character limit. */
  detail?: Record<string, number | string>;
};

export function engineError(code: EngineErrorCode, message: string, detail?: EngineError["detail"]): EngineError {
  const retryable = code === "LLM_TIMEOUT" || code === "RATE_LIMITED" || code === "LLM_UNAVAILABLE" || code === "VALIDATION_FAILED";
  return { code, retryable, message, detail };
}

/** What a single provider call can fail with. */
export type ProviderFailureKind = "timeout" | "rate_limit" | "daily_limit" | "http" | "network" | "bad_json" | "no_key";

export class ProviderError extends Error {
  constructor(
    public kind: ProviderFailureKind,
    message: string,
    public status?: number,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
