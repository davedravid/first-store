import { z } from "zod";
import { EVENTS, SLUG_RE, track } from "@/lib/stores";

/** Funnel events from the browser (sendBeacon). Unknown events are ignored. */
export async function POST(req: Request) {
  const text = await req.text().catch(() => "");
  const parsed = z.object({ event: z.enum(EVENTS), slug: z.string().regex(SLUG_RE).optional() }).safeParse((() => { try { return JSON.parse(text); } catch { return null; } })());
  if (parsed.success) await track(parsed.data.event, parsed.data.slug);
  return new Response(null, { status: 204 });
}
