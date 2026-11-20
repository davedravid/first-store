import type { Chip, CreatorInput, Storefront } from "@/lib/ai/schema";

/** Every failure the creator can see. Never raw error text. */
export type UiError = "offline" | "slow" | "busy" | "broken";

export type GenerateOk =
  | { status: "ready"; storefront: Storefront }
  | { status: "needs_more_info"; question: string; suggestions: string[] };

export type ApiFail =
  | { ok: false; kind: UiError; daily?: boolean }
  | { ok: false; kind: "input"; code: "EMPTY_INPUT" | "TOO_LONG"; limit?: number };

const CLIENT_TIMEOUT_MS = 65_000; // the server gives up at about 55 s; this only catches a dead network

/** ?simulate=slow|badjson|fail on the page URL is passed through, for demos and tests. */
function withSimulate(path: string): string {
  if (typeof window === "undefined") return path;
  const sim = new URLSearchParams(window.location.search).get("simulate");
  return sim ? `${path}?simulate=${encodeURIComponent(sim)}` : path;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<{ ok: true; data: T } | ApiFail> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, kind: "offline" };
  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const both = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(withSimulate(path), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: both });
  } catch (e) {
    if (signal?.aborted) throw e; // the creator cancelled; the caller ignores it
    if (navigator.onLine === false) return { ok: false, kind: "offline" };
    return { ok: false, kind: timeout.aborted ? "slow" : "offline" };
  }
  const json = await res.json().catch(() => null);
  if (json?.ok) return { ok: true, data: json as T };
  const code: string | undefined = json?.error?.code;
  if (code === "EMPTY_INPUT" || code === "TOO_LONG") return { ok: false, kind: "input", code, limit: json.error.detail?.limit };
  if (code === "RATE_LIMITED" || res.status === 429) return { ok: false, kind: "busy", daily: json?.error?.detail?.reason === "daily" };
  if (code === "LLM_TIMEOUT" || res.status === 504) return { ok: false, kind: "slow" };
  return { ok: false, kind: "broken" };
}

export function generate(input: CreatorInput, signal?: AbortSignal) {
  return post<GenerateOk & { ok: true }>("/api/generate", input, signal);
}

export type RegenTarget = { kind: "about" } | { kind: "product"; productId: string };

export function regenerate(args: { input: CreatorInput; storefront: Storefront; target: RegenTarget; chip: Chip }) {
  return post<{ ok: true; storefront: Storefront }>("/api/regenerate", args);
}

// ---------- publishing ----------

export type PublishFail = { ok: false; kind: UiError | "bad_token" };

export async function publish(args: { input: CreatorInput; storefront: Storefront; slug?: string; token?: string }): Promise<{ ok: true; slug: string; token: string } | PublishFail> {
  if (navigator.onLine === false) return { ok: false, kind: "offline" };
  try {
    const res = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args), signal: AbortSignal.timeout(20000) });
    const j = await res.json().catch(() => null);
    if (j?.ok) return j;
    if (res.status === 403 || res.status === 404) return { ok: false, kind: "bad_token" };
    return { ok: false, kind: res.status === 429 ? "busy" : "broken" };
  } catch {
    return { ok: false, kind: (navigator.onLine as boolean) === false ? "offline" : "slow" };
  }
}

export type Signup = { productId: string; name: string; contact: string; at: number };
export type Interest = { counts: Record<string, number>; signups: Signup[] };

export async function loadForEdit(slug: string, token: string): Promise<{ ok: true; input: CreatorInput; storefront: Storefront; interest: Interest } | { ok: false; notFound: boolean }> {
  try {
    const res = await fetch("/api/store", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, token }), cache: "no-store" });
    const j = await res.json().catch(() => null);
    return j?.ok ? j : { ok: false, notFound: res.status === 404 };
  } catch {
    return { ok: false, notFound: false };
  }
}
