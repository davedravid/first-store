/**
 * One accent colour per store, picked from the niche. Not a theme picker.
 * Order: the model's safety_topic, then the model's niche label, then the creator's own words (backup only),
 * so "budget outfits for college" (niche: fashion) never turns finance navy.
 * Every accent passes WCAG AA (4.5:1) for white text on it, and for accent text on its tint (see theme.test.ts).
 */
import type { CreatorInput, Storefront } from "@/lib/ai/schema";

export type ThemeName = "fitness" | "finance" | "cooking" | "design" | "exam" | "astrology" | "fashion" | "default";
export type Theme = { name: ThemeName; accent: string; tint: string; deep: string };

export const THEMES: Record<ThemeName, Theme> = {
  fitness: { name: "fitness", accent: "#047857", tint: "#ecfdf5", deep: "#064e3b" },
  finance: { name: "finance", accent: "#1e40af", tint: "#eff6ff", deep: "#1e2a6b" },
  cooking: { name: "cooking", accent: "#c2410c", tint: "#fff7ed", deep: "#8a2c0a" },
  design: { name: "design", accent: "#6d28d9", tint: "#f5f3ff", deep: "#4c1d95" },
  exam: { name: "exam", accent: "#1d4ed8", tint: "#eff6ff", deep: "#1e3a8a" },
  astrology: { name: "astrology", accent: "#6b21a8", tint: "#faf5ff", deep: "#3b0764" },
  fashion: { name: "fashion", accent: "#be123c", tint: "#fff1f2", deep: "#881337" },
  default: { name: "default", accent: "#0f766e", tint: "#f0fdfa", deep: "#134e4a" },
};

// Checked in this order; the first match wins.
const KEYWORDS: [ThemeName, RegExp][] = [
  ["astrology", /\b(astro\w*|tarot|numerolog\w*|vastu|horoscope|kundli|jyotish)\b/],
  ["finance", /\b(financ\w*|money|invest\w*|trading|trader|stocks?|mutual funds?|sip|tax(es)?|savings?|credit cards?|options)\b/],
  ["exam", /\b(exams?|upsc|ssc|neet|jee|gate|ias|interviews?|placements?|resumes?|careers?|coding|study|students? prep|board exams?)\b/],
  ["fitness", /\b(fitness|yoga|workouts?|gym|pilates|weight loss|diet\w*|nutrition|wellness|zumba|exercise|strength)\b/],
  ["cooking", /\b(cook\w*|bak\w*|recipes?|food|kitchen|cakes?|chef|meals?|kadai|tiffin|cookies)\b/],
  ["design", /\b(design\w*|canva|figma|ui|ux|illustrat\w*|logos?|branding|graphics?)\b/],
  ["fashion", /\b(fashion|sarees?|outfits?|styling|stylist|makeup|beauty|skin ?care|thrift\w*|jewell?ery|clothes|kurtis?)\b/],
];

function byWords(text: string): ThemeName | null {
  const t = text.toLowerCase();
  return KEYWORDS.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** For a finished store: safety_topic, then the model's niche, then the creator's words. */
export function themeFor(sf: Storefront | null, input?: CreatorInput): Theme {
  if (sf) {
    const topic = sf.creator.safety_topic;
    if (topic === "finance") return THEMES.finance;
    if (topic === "astrology") return THEMES.astrology;
    const fromNiche = byWords(sf.creator.niche);
    if (fromNiche) return THEMES[fromNiche];
    if (topic === "health") return THEMES.fitness;
  }
  const fromInput = input ? byWords([input.description, input.instagram_bio ?? ""].join(" ")) : null;
  return THEMES[fromInput ?? "default"];
}

/** CSS variables for a themed block. */
export function themeVars(t: Theme): Record<string, string> {
  return { "--accent": t.accent, "--tint": t.tint, "--deep": t.deep };
}

// ---------- contrast (WCAG 2.x) ----------

function lum(hex: string): number {
  const c = hex.replace("#", "").match(/../g)!.map((x) => parseInt(x, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
