import { checkLimits, clientIp } from "@/lib/limits";
import { addWant, cleanContact, track, WantBodySchema } from "@/lib/stores";


export async function POST(req: Request) {
  const parsed = WantBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  const contact = cleanContact(parsed.data.contact);
  if (!contact) return Response.json({ ok: false, reason: "contact" }, { status: 400 });

  const limit = await checkLimits("want", clientIp(req));
  if (!limit.ok) return Response.json({ ok: false, reason: "busy" }, { status: 429 });

  const r = await addWant(parsed.data.slug, parsed.data.productId, parsed.data.name, contact);
  if (r === "not_found") return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (r === "no_db") return Response.json({ ok: false, reason: "busy" }, { status: 503 });
  if (r === "ok") await track("want_this_submit", parsed.data.slug);
  // A repeat sign-up is still a success for the follower.
  return Response.json({ ok: true });
}
