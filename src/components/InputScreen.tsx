"use client";

import { useState } from "react";
import type { Audience, CreatorInput } from "@/lib/ai/schema";
import { ChipButton, PrimaryButton } from "./ui";

export const MAX_CHARS = 600;

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "just_starting", label: "Just starting" },
  { id: "under_5k", label: "Under 5K" },
  { id: "5k_25k", label: "5K to 25K" },
  { id: "25k_100k_plus", label: "25K to 100K+" },
];

const field = "w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-[16px] leading-6 text-stone-900 placeholder:text-stone-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function InputScreen(props: {
  input: CreatorInput;
  handleRaw: string;
  hint: string | null;
  hasStore: boolean;
  busy: boolean;
  onChange: (input: CreatorInput, handleRaw?: string) => void;
  onSubmit: () => void;
  onBackToStore: () => void;
}) {
  const { input } = props;
  const [bioOpen, setBioOpen] = useState(Boolean(input.instagram_bio));
  const set = (patch: Partial<CreatorInput>) => props.onChange({ ...input, ...patch });
  const len = input.description.length;
  const bioLen = (input.instagram_bio ?? "").length;

  return (
    <form
      className="flex min-h-dvh flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit();
      }}
    >
      <div className="flex-1 px-4 pb-32 pt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">First Store</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight">Let&apos;s build your first store</h1>
        <p className="mt-2 text-base leading-6 text-stone-600">Tell us what you do. We will draft your page, products and prices. You can change everything after.</p>

        {props.hasStore && (
          <button type="button" onClick={props.onBackToStore} className="mt-4 min-h-[44px] w-full rounded-2xl bg-accent-soft px-4 text-left text-base font-medium text-accent">
            Back to my store →
          </button>
        )}

        <label htmlFor="desc" className="mt-6 block text-base font-semibold">
          What do you do and who do you help?
        </label>
        <textarea
          id="desc"
          rows={4}
          value={input.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="e.g. I teach home baking with a kadai to college students who have no oven"
          className={`${field} mt-2 resize-none`}
          aria-invalid={Boolean(props.hint)}
          aria-describedby="desc-hint"
        />
        <div id="desc-hint" className="mt-1 flex justify-between gap-3 text-sm">
          <span className={props.hint ? "font-medium text-accent" : "text-stone-500"}>{props.hint ?? "A sentence or two is enough. English or Hinglish is fine."}</span>
          {len > MAX_CHARS - 150 && <span className={len > MAX_CHARS ? "font-semibold text-accent" : "text-stone-500"}>{len}/{MAX_CHARS}</span>}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="name" className="block text-base font-semibold">
              Your name <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input id="name" value={input.name ?? ""} onChange={(e) => set({ name: e.target.value })} autoComplete="name" placeholder="Shown on your page" className={`${field} mt-2 min-h-[48px]`} />
          </div>
          <div>
            <label htmlFor="handle" className="block text-base font-semibold">
              Instagram handle <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input
              id="handle"
              value={props.handleRaw}
              onChange={(e) => props.onChange(input, e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="@yourname or a profile link"
              className={`${field} mt-2 min-h-[48px]`}
            />
            <p className="mt-1 text-sm text-stone-500">Only shown on your page. We never open your profile.</p>
          </div>
        </div>

        <div className="mt-5">
          {!bioOpen ? (
            <button type="button" onClick={() => setBioOpen(true)} className="min-h-[44px] text-base font-medium text-accent">
              + Paste your Instagram bio
            </button>
          ) : (
            <div>
              <label htmlFor="bio" className="block text-base font-semibold">
                Your Instagram bio <span className="font-normal text-stone-500">(optional)</span>
              </label>
              <textarea id="bio" rows={3} value={input.instagram_bio ?? ""} onChange={(e) => set({ instagram_bio: e.target.value })} placeholder="Paste it here. We only read what you paste." className={`${field} mt-2 resize-none`} />
              {bioLen > MAX_CHARS - 150 && <p className={`mt-1 text-right text-sm ${bioLen > MAX_CHARS ? "font-semibold text-accent" : "text-stone-500"}`}>{bioLen}/{MAX_CHARS}</p>}
            </div>
          )}
        </div>

        <fieldset className="mt-5">
          <legend className="text-base font-semibold">How many followers do you have?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {AUDIENCES.map((a) => (
              <ChipButton key={a.id} selected={input.audience === a.id} onClick={() => set({ audience: a.id })}>
                {a.label}
              </ChipButton>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-base font-semibold">Write my page in</legend>
          <div className="mt-2 grid grid-cols-2 rounded-full border border-stone-300 bg-white p-1">
            {(["en", "hinglish"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={input.language === l}
                onClick={() => set({ language: l })}
                className={`min-h-[44px] rounded-full text-[15px] font-medium ${input.language === l ? "bg-stone-900 text-white" : "text-stone-700"}`}
              >
                {l === "en" ? "English" : "Hinglish"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-background/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <PrimaryButton type="submit" disabled={props.busy}>
            {props.busy ? "Building..." : "Build my store"}
          </PrimaryButton>
        </div>
      </div>
    </form>
  );
}
