import { z } from "zod";
import { regenerateBlock, SIMULATE_MODES, type SimulateMode } from "@/lib/ai/engine";
import { engineError } from "@/lib/ai/errors";
import { CHIPS, CreatorInputSchema, StorefrontSchema } from "@/lib/ai/schema";

export const maxDuration = 60;

const BodySchema = z.object({
  input: CreatorInputSchema,
  storefront: StorefrontSchema,
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("about") }),
    z.object({ kind: z.literal("product"), productId: z.string() }),
  ]),
  chip: z.enum(CHIPS),
});

export async function POST(req: Request) {
  const simulate = new URL(req.url).searchParams.get("simulate") as SimulateMode | null;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ ok: false, error: engineError("LLM_UNAVAILABLE", "The request was not readable.") }, { status: 400 });

  const result = await regenerateBlock(parsed.data, {
    simulate: simulate && SIMULATE_MODES.includes(simulate) ? simulate : undefined,
  });
  return Response.json(result, { status: result.ok ? 200 : result.error.code === "RATE_LIMITED" ? 429 : 503 });
}
