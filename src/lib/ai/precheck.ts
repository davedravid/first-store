/**
 * Checks that run BEFORE any model call. They are free, instant and never fail.
 * - empty            -> EMPTY_INPUT error (UI shows a hint under the box)
 * - too long         -> TOO_LONG error (UI asks to shorten)
 * - handle only      -> clarify question (we never read the handle, so there is nothing to go on)
 * - emoji / symbols  -> clarify question
 */
import { engineError, type EngineError } from "./errors";
import type { CreatorInput, GateResponse } from "./schema";

export type PrecheckResult =
  | { kind: "ok" }
  | { kind: "error"; error: EngineError }
  | { kind: "gate"; gate: Extract<GateResponse, { status: "needs_more_info" }>; reason: "handle_only" | "no_words" };

export function maxInputChars(): number {
  const n = Number(process.env.MAX_INPUT_CHARS);
  return Number.isFinite(n) && n > 0 ? n : 600;
}

const HANDLE_OR_LINK = /^(@[\w.]+|https?:\/\/\S+|(www\.)?instagram\.com\/\S+)$/i;

export function precheck(input: CreatorInput, maxChars = maxInputChars()): PrecheckResult {
  const description = input.description.trim();
  const bio = (input.instagram_bio ?? "").trim();
  const handle = (input.handle ?? "").trim();

  if (!description && !bio && !handle)
    return { kind: "error", error: engineError("EMPTY_INPUT", "Nothing was typed.") };

  if (description.length > maxChars || bio.length > maxChars)
    return {
      kind: "error",
      error: engineError("TOO_LONG", `Please keep it under ${maxChars} characters.`, {
        limit: maxChars,
        length: Math.max(description.length, bio.length),
      }),
    };

  const words = `${description} ${bio}`.trim();
  if (!words || HANDLE_OR_LINK.test(words)) return { kind: "gate", gate: localGate(input.language), reason: "handle_only" };
  if (!/[\p{L}\p{N}]/u.test(words)) return { kind: "gate", gate: localGate(input.language), reason: "no_words" };

  return { kind: "ok" };
}

function localGate(language: CreatorInput["language"]): Extract<GateResponse, { status: "needs_more_info" }> {
  if (language === "hinglish")
    return {
      status: "needs_more_info",
      question: "Aap kya karte ho? Log aapke paas kis cheez ke liye aate hain?",
      suggestions: [
        "Main busy logon ko ghar pe workout sikhata hoon",
        "Main simple budget recipes share karti hoon",
        "Main students ko govt exams ki tayyari karwata hoon",
      ],
    };
  return {
    status: "needs_more_info",
    question: "Tell us a bit about what you do. What do people come to you for?",
    suggestions: [
      "I share quick home workouts for busy people",
      "I post simple, budget-friendly recipes",
      "I help students prepare for government exams",
    ],
  };
}
