import type { CreatorInput, Storefront } from "@/lib/ai/schema";

export type Screen = "input" | "generating" | "clarify" | "editor" | "error" | "published";

/** A published store on this device: the slug and the secret edit token (also in the private edit link). */
export type Published = { slug: string; token: string; at: number };

/** A price the creator typed themself, with the price we suggested so they can go back to it. */
export type PriceOverride = { price: number; suggested: number };

export type Saved = {
  v: 1;
  screen: Screen;
  input: CreatorInput;
  /** The raw handle as typed, so the box shows what they wrote. */
  handleRaw: string;
  storefront: Storefront | null;
  edited: boolean;
  prices: Record<string, PriceOverride>;
  clarify: { question: string; suggestions: string[] } | null;
  published?: Published | null;
};

const KEY = "first-store:draft:v1";

export const emptyInput = (): CreatorInput => ({ description: "", audience: "under_5k", language: "en", name: "", handle: "", instagram_bio: "" });

export function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return s && s.v === 1 && s.input ? s : null;
  } catch {
    return null;
  }
}

export function save(s: Saved) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or full storage: the app still works, it just cannot autosave.
  }
}

export function clearSaved() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
