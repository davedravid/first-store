/**
 * Loads the prompt files from /prompts (or another folder, used by the evals to run the v1 prompts)
 * and fills in {{placeholders}}. Prompts stay as readable .md files.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Chip, CreatorInput, Storefront } from "./schema";

const cache = new Map<string, string>();

function load(dir: string, name: string): string {
  const file = path.join(process.cwd(), dir, `${name}.md`);
  let text = cache.get(file);
  if (text === undefined) {
    text = readFileSync(file, "utf8");
    cache.set(file, text);
  }
  return text;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? "");
}

const AUDIENCE_TEXT: Record<CreatorInput["audience"], string> = {
  just_starting: "just starting (almost no followers yet)",
  under_5k: "under 5K followers",
  "5k_25k": "5K to 25K followers",
  "25k_100k_plus": "25K to 100K+ followers",
};

const LANGUAGE_TEXT: Record<CreatorInput["language"], string> = {
  en: "en (English)",
  hinglish: "hinglish (Roman-script Hindi-English mix)",
};

/** Creator text, with our delimiter tags neutralised so input cannot close the data block early. */
export function creatorInputBlock(input: CreatorInput): string {
  const safe = (s: string) => s.replace(/<\/?\s*(creator_input|current_page|current_part)[^>]*>/gi, "");
  const lines = [`About me: ${safe(input.description.trim()) || "(empty)"}`];
  if (input.name?.trim()) lines.unshift(`My name: ${safe(input.name.trim())}`);
  if (input.handle?.trim()) lines.push(`Handle: ${safe(input.handle.trim())}`);
  if (input.instagram_bio?.trim()) lines.push(`My Instagram bio: ${safe(input.instagram_bio.trim())}`);
  return lines.join("\n");
}

export function systemPrompt(dir = "prompts"): string {
  return load(dir, "system");
}

export function generatePrompt(input: CreatorInput, dir = "prompts"): string {
  return fill(load(dir, "generate"), {
    creator_input: creatorInputBlock(input),
    audience: AUDIENCE_TEXT[input.audience],
    language: LANGUAGE_TEXT[input.language],
  });
}

const CHIP_TEXT: Record<Chip, string> = {
  try_another: "Instruction: try_another. A fresh take with a different angle, same tier, same quality.",
  shorter: "Instruction: shorter. Same idea in about half the words. Keep the most useful detail.",
  more_casual: "Instruction: more_casual. Same idea, more relaxed and chatty, like a DM to a follower.",
  more_premium: "Instruction: more_premium. Same idea, more polished and higher value. Do not exaggerate.",
  cheaper: "Instruction: cheaper. A lighter, smaller version that is easy to say yes to.",
};

export function regeneratePrompt(
  input: CreatorInput,
  page: Storefront,
  target: string,
  currentPart: unknown,
  chip: Chip,
  dir = "prompts",
): string {
  return fill(load(dir, "regenerate"), {
    creator_input: creatorInputBlock(input),
    audience: AUDIENCE_TEXT[input.audience],
    language: LANGUAGE_TEXT[input.language],
    current_page: JSON.stringify(page, null, 1),
    target,
    current_part: JSON.stringify(currentPart, null, 1),
    chip,
    chip_instruction: CHIP_TEXT[chip],
  });
}

/** Appended to the user prompt on the one retry. */
export function retryNote(errors: string): string {
  return `\n\n## Your previous answer had problems. Fix all of them and answer again with the full JSON.\n${errors}`;
}
