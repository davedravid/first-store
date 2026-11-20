/**
 * Accepts "@name", "name" or a pasted instagram.com link and returns "@name" (or "" if it is not a handle).
 * Display only: the handle is never fetched or used to guess a niche.
 */
const NOT_PROFILES = new Set(["p", "reel", "reels", "stories", "explore", "tv", "accounts", "direct"]);

export function normalizeHandle(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  const link = s.match(/instagram\.com\/([^/?#\s]+)/i);
  if (link) {
    if (NOT_PROFILES.has(link[1].toLowerCase())) return "";
    s = link[1];
  }
  s = s.replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").replace(/^\.+|\.+$/g, "").slice(0, 30);
  return s ? `@${s.toLowerCase()}` : "";
}
