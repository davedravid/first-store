import { revalidateTag } from "next/cache";
import { checkLimits, clientIp } from "@/lib/limits";
import { storeTag } from "@/lib/public-store";
import { PublishBodySchema, publishStore, track } from "@/lib/stores";

export async function POST(req: Request) {
  const parsed = PublishBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid" }, { status: 400 });

  const limit = await checkLimits("publish", clientIp(req));
  if (!limit.ok) return Response.json({ ok: false, reason: "busy" }, { status: 429 });

  const r = await publishStore(parsed.data);
  if (!r.ok) return Response.json(r, { status: r.reason === "bad_token" ? 403 : r.reason === "not_found" ? 404 : 503 });

  revalidateTag(storeTag(r.slug), { expire: 0 });
  await track("publish", r.slug);
  return Response.json(r);
}
