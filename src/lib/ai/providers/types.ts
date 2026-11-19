export type ProviderName = "groq" | "gemini";

export type LLMRequest = {
  model: string;
  system: string;
  user: string;
  /** Strict JSON Schema (from toProviderJsonSchema). */
  schema: Record<string, unknown>;
  schemaName: string;
  timeoutMs: number;
  temperature?: number;
};

export type LLMResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  rate?: { remainingTokens?: number; resetTokensMs?: number; remainingRequests?: number };
};

export type Provider = (req: LLMRequest) => Promise<LLMResponse>;
