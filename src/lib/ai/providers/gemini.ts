/**
 * Gemini (fallback). Official @google/genai SDK, generateContent with a JSON schema.
 * Note: Gemini ignores minLength/maxLength, which is one reason our validator checks lengths itself.
 */
import { GoogleGenAI } from "@google/genai";
import { ProviderError } from "../errors";
import type { LLMRequest, LLMResponse } from "./types";

let client: GoogleGenAI | null = null;

export async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new ProviderError("no_key", "GOOGLE_GENERATIVE_AI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: key });

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  try {
    const res = await client.models.generateContent({
      model: req.model,
      contents: req.user,
      config: {
        systemInstruction: req.system,
        temperature: req.temperature ?? 0.7,
        responseMimeType: "application/json",
        responseJsonSchema: req.schema,
        abortSignal: controller.signal,
      },
    });
    return {
      text: res.text ?? "",
      inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0),
      latencyMs: Date.now() - started,
    };
  } catch (e) {
    if (controller.signal.aborted) throw new ProviderError("timeout", `Gemini did not answer within ${req.timeoutMs} ms`);
    const status = (e as { status?: number }).status;
    if (status === 429) throw new ProviderError("rate_limit", "Gemini rate limit or quota", 429);
    if (status) throw new ProviderError("http", `Gemini HTTP ${status}`, status);
    throw new ProviderError("network", "Could not reach Gemini");
  } finally {
    clearTimeout(timer);
  }
}
