import { z } from "zod";
import { checkLimits, clientIp } from "@/lib/limits";
import { loadForEdit, SLUG_RE } from "@/lib/stores";

/** The creator's edit link: returns their store, their words and who wants what. Token in the body, never the URL. */
export async function POST(req: Request) {
  const parsed = z.object({ slug: z.string().regex(SLUG_RE), token: z.string().min(16).max(64) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  // Guessing tokens is pointless (144 random bits), but cap tries anyway.
  const limit = await checkLimits("publish", clientIp(req));
  if (!limit.ok) return Response.json({ ok: false, reason: "busy" }, { status: 429 });
  const data = await loadForEdit(parsed.data.slug, parsed.data.token);
  if (!data) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true, ...data }, { headers: { "cache-control": "no-store" } });
}
