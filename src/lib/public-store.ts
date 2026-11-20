import { cacheLife, cacheTag } from "next/cache";
import { getStore, toPublic, type PublicStore } from "./stores";

export const storeTag = (slug: string) => `store:${slug}`;

/** The public page's data, cached; publishing an update expires it at once (see /api/publish). */
export async function getPublicStore(slug: string): Promise<PublicStore | null> {
  "use cache";
  cacheTag(storeTag(slug));
  cacheLife("hours");
  const s = await getStore(slug);
  return s ? toPublic(s) : null;
}
