import { generateStorefront, SIMULATE_MODES, type SimulateMode } from "@/lib/ai/engine";
import { engineError } from "@/lib/ai/errors";
import { CreatorInputSchema } from "@/lib/ai/schema";

// Vercel Hobby allows up to 300 s; we need at most ~45 s (see TIMEOUTS in engine.ts).
export const maxDuration = 60;

export async function POST(req: Request) {
  const simulate = new URL(req.url).searchParams.get("simulate") as SimulateMode | null;
  const body = await req.json().catch(() => null);
  const parsed = CreatorInputSchema.safeParse(body ?? {});
  if (!parsed.success)
    return Response.json({ ok: false, error: engineError("EMPTY_INPUT", "The request was not readable.") }, { status: 400 });

  const result = await generateStorefront(parsed.data, {
    simulate: simulate && SIMULATE_MODES.includes(simulate) ? simulate : undefined,
  });

  // Keep the response lean for the UI: no model-internal fields.
  const { modelStorefront: _drop, lastDraft: _draft, ...meta } = result.meta;
  void _drop;
  void _draft;
  return Response.json({ ...result, meta }, { status: result.ok ? 200 : statusFor(result.error.code) });
}

function statusFor(code: string): number {
  if (code === "EMPTY_INPUT" || code === "TOO_LONG") return 400;
  if (code === "RATE_LIMITED") return 429;
  if (code === "LLM_TIMEOUT") return 504;
  return 503;
}
