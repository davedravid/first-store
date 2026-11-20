/**
 * Checks that run BEFORE any model call. They are free, instant and never fail.
 * - empty            -> EMPTY_INPUT error (UI shows a hint under the box)
 * - too long         -> TOO_LONG error (UI asks to shorten)
 * - handle only      -> clarify question (we never read the handle, so there is nothing to go on)
 * - emoji / symbols  -> clarify question
 * - under 4 words    -> clarify question that echoes what they typed ("fitness", "I'm a CA")
 */
import { engineError, type EngineError } from "./errors";
import type { CreatorInput, GateResponse } from "./schema";

export type PrecheckResult =
  | { kind: "ok" }
  | { kind: "error"; error: EngineError }
  | { kind: "gate"; gate: Extract<GateResponse, { status: "needs_more_info" }>; reason: "handle_only" | "no_words" | "too_short" };

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

  // Under 4 real words (handles and links removed): too little to build a store, and asking costs nothing.
  const real = words.split(/\s+/).filter((w) => !HANDLE_OR_LINK.test(w) && /[\p{L}\p{N}]/u.test(w));
  if (real.length < 4)
    return { kind: "gate", gate: localGate(input.language, topicFrom(real.join(" "))), reason: "too_short" };

  return { kind: "ok" };
}

/** "I'm a CA" -> "CA", "fitness" -> "fitness". Used to make the tap answers about what they typed. */
function topicFrom(text: string): string {
  return text
    .replace(/^(i\s*am|i'?m|im|main|mai|me|myself)\s+/i, "")
    .replace(/^(a|an|the|ek)\s+/i, "")
    .replace(/\s+(hoon|hu|hun|hai)$/i, "")
    .replace(/[.!?,]+$/, "")
    .trim()
    .slice(0, 30);
}

function localGate(language: CreatorInput["language"], topic?: string): Extract<GateResponse, { status: "needs_more_info" }> {
  if (topic) {
    if (language === "hinglish")
      return {
        status: "needs_more_info",
        question: `Aapne "${topic}" likha. Aap kisko help karte ho, aur kis cheez mein?`,
        suggestions: [
          `Main beginners ko ${topic} start karna sikhata hoon`,
          `Main busy logon ke liye simple ${topic} tips share karti hoon`,
          `Main students aur working logon ko ${topic} sikhata hoon`,
        ],
      };
    return {
      status: "needs_more_info",
      question: `You said "${topic}". Who do you help, and with what?`,
      suggestions: [
        `I help beginners get started with ${topic}`,
        `I share simple ${topic} tips for busy people`,
        `I teach ${topic} to students and working people`,
      ],
    };
  }
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
