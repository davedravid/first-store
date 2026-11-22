"use client";

import { useRef, useState, type CSSProperties } from "react";
import type { Audience, CreatorInput } from "@/lib/ai/schema";
import { SAMPLE_STORE } from "@/lib/ui/sample";
import { THEMES, themeVars } from "@/lib/ui/theme";
import { Storefront } from "./Storefront";
import { PrimaryButton } from "./ui";

export const MAX_CHARS = 600;

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: "just_starting", label: "Just starting" },
  { id: "under_5k", label: "Under 5K" },
  { id: "5k_25k", label: "5K to 25K" },
  { id: "25k_100k_plus", label: "25K to 100K+" },
];

/** Starter sentences: tapping one fills the box and leaves the cursor at the end, so the creator finishes it in their own words. */
export const STARTERS: { label: string; text: string }[] = [
  { label: "Home workouts", text: "I teach home workouts to new moms who " },
  { label: "Eggless baking", text: "I share eggless baking recipes without an oven for " },
  { label: "UPSC answers", text: "I help UPSC aspirants with answer writing, especially " },
  { label: "First salary money", text: "I explain personal finance to people with their first salary, like " },
  { label: "Canva templates", text: "I make Canva templates for small shop owners who " },
  { label: "Hinglish: ghar ki baking", text: "Main ghar pe eggless cakes banana sikhati hoon, un logon ko jo " },
];

const field =
  "w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-[16px] leading-6 text-stone-900 placeholder:text-stone-400 outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10";

export function InputScreen(props: {
  input: CreatorInput;
  handleRaw: string;
  hint: string | null;
  hasStore: boolean;
  canStartOver: boolean;
  onChange: (input: CreatorInput, handleRaw?: string) => void;
  onSubmit: () => void;
  onBackToStore: () => void;
  onStartOver: () => void;
}) {
  const { input } = props;
  const hasExtras = Boolean(input.name || props.handleRaw || input.instagram_bio);
  const [moreOpen, setMoreOpen] = useState(hasExtras);
  const box = useRef<HTMLTextAreaElement>(null);
  const set = (patch: Partial<CreatorInput>) => props.onChange({ ...input, ...patch });
  const len = input.description.length;
  const bioLen = (input.instagram_bio ?? "").length;
  const showStarters = !input.description.trim() || STARTERS.some((s) => s.text === input.description);

  // Focus inside the tap itself (iOS only opens the keyboard then), with the text and cursor set straight away,
  // so the first letters the creator types are never lost.
  const pickStarter = (text: string) => {
    const el = box.current;
    if (el) {
      el.value = text;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    }
    set({ description: text });
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14 lg:px-10 lg:py-10">
      <form
        className="flex min-h-dvh flex-col lg:min-h-0"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
      >
        <div className="flex-1 px-4 pb-32 pt-5 lg:px-0 lg:pb-0 lg:pt-4">
          <div className="flex items-center justify-between">
            <p className="font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-tight">
              <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#c2410c] align-middle" />
              First Store
            </p>
            {props.canStartOver && (
              <button type="button" onClick={props.onStartOver} className="min-h-[44px] px-1 text-sm text-stone-500 underline underline-offset-2">
                Start over
              </button>
            )}
          </div>

          <h1 className="mt-4 font-[family-name:var(--font-display)] text-[32px] font-extrabold leading-[1.05] tracking-tight lg:mt-10 lg:text-[52px]">
            Turn what you know into a store.
          </h1>
          <p className="mt-3 text-[17px] leading-6 text-stone-600 lg:text-[19px]">Your bio, 3 products and prices, in under a minute.</p>

          {props.hasStore && (
            <button type="button" onClick={props.onBackToStore} className="mt-3 min-h-[44px] text-[15px] font-semibold text-stone-900 underline underline-offset-4">
              Back to my store →
            </button>
          )}

          <label htmlFor="desc" className="mt-6 block text-[16px] font-semibold">
            What do you do and who do you help?
          </label>
          <textarea
            id="desc"
            ref={box}
            rows={3}
            value={input.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Say it like you would to a follower."
            className={`${field} mt-2 resize-none`}
            aria-invalid={Boolean(props.hint)}
            aria-describedby="desc-hint"
          />
          <div id="desc-hint" className="mt-1 flex min-h-[20px] justify-between gap-3 text-sm">
            {props.hint ? <span className="font-medium text-[#b91c1c]">{props.hint}</span> : <span className="text-stone-500">English or Hinglish, a sentence or two.</span>}
            {len > MAX_CHARS - 150 && <span className={len > MAX_CHARS ? "font-semibold text-[#b91c1c]" : "text-stone-500"}>{len}/{MAX_CHARS}</span>}
          </div>

          {showStarters && (
            <div className="mt-3">
              <p className="text-[13px] font-medium text-stone-500">Need a start? Tap one and finish the sentence:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => pickStarter(s.text)}
                    className={`min-h-[40px] rounded-full border px-3.5 text-[14px] font-medium transition active:scale-[0.97] ${
                      input.description === s.text ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <fieldset className="mt-6">
            <legend className="text-[16px] font-semibold">How many followers do you have?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AUDIENCES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={input.audience === a.id}
                  onClick={() => set({ audience: a.id })}
                  className={`min-h-[44px] rounded-xl border text-[15px] font-medium transition ${
                    input.audience === a.id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-800"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-[16px] font-semibold">Write my page in</legend>
            <div className="mt-2 grid max-w-[320px] grid-cols-2 rounded-xl border border-stone-300 bg-white p-1">
              {(["en", "hinglish"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={input.language === l}
                  onClick={() => set({ language: l })}
                  className={`min-h-[40px] rounded-lg text-[15px] font-medium ${input.language === l ? "bg-stone-900 text-white" : "text-stone-700"}`}
                >
                  {l === "en" ? "English" : "Hinglish"}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 rounded-2xl border border-stone-200 bg-white">
            <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className="flex min-h-[52px] w-full items-center justify-between px-4 text-left text-[15px] font-semibold">
              <span>
                Add more about you <span className="font-normal text-stone-500">(optional)</span>
              </span>
              <svg className={`transition ${moreOpen ? "rotate-180" : ""}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {moreOpen && (
              <div className="space-y-4 border-t border-stone-100 px-4 pb-4 pt-3">
                <div>
                  <label htmlFor="name" className="block text-[15px] font-semibold">
                    Your name
                  </label>
                  <input id="name" value={input.name ?? ""} onChange={(e) => set({ name: e.target.value })} autoComplete="name" placeholder="Shown on your page" className={`${field} mt-1.5 min-h-[48px]`} />
                </div>
                <div>
                  <label htmlFor="handle" className="block text-[15px] font-semibold">
                    Instagram handle
                  </label>
                  <input
                    id="handle"
                    value={props.handleRaw}
                    onChange={(e) => props.onChange(input, e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="@yourname or a profile link"
                    className={`${field} mt-1.5 min-h-[48px]`}
                  />
                  <p className="mt-1 text-[13px] text-stone-500">Only shown on your page. We never open your profile.</p>
                </div>
                <div>
                  <label htmlFor="bio" className="block text-[15px] font-semibold">
                    Your Instagram bio
                  </label>
                  <textarea id="bio" rows={3} value={input.instagram_bio ?? ""} onChange={(e) => set({ instagram_bio: e.target.value })} placeholder="Paste it here. We only read what you paste." className={`${field} mt-1.5 resize-none`} />
                  {bioLen > MAX_CHARS - 150 && <p className={`mt-1 text-right text-sm ${bioLen > MAX_CHARS ? "font-semibold text-[#b91c1c]" : "text-stone-500"}`}>{bioLen}/{MAX_CHARS}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 hidden lg:block">
            <PrimaryButton type="submit">Build my store</PrimaryButton>
            <p className="mt-2 text-center text-[13px] text-stone-500">Free. No login. You can change everything after.</p>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-background/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <PrimaryButton type="submit">Build my store</PrimaryButton>
        </div>
      </form>

      {/* Desktop: what they will get */}
      <aside className="hidden lg:block" aria-label="Example store">
        <div className="sticky top-10">
          <p className="mb-3 text-center text-[13px] font-semibold uppercase tracking-wider text-stone-500">Example of what you will get</p>
          <div className="phone-frame mx-auto" style={themeVars(THEMES.fitness) as CSSProperties}>
            <div className="phone-scroll" inert>
              <Storefront store={SAMPLE_STORE} theme={THEMES.fitness} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
