"use client";

import { useState } from "react";
import { ChipButton, PrimaryButton } from "./ui";

export function ClarifyScreen(props: { question: string; suggestions: string[]; onAnswer: (text: string) => void; onBack: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex min-h-dvh flex-col px-4 pb-10 pt-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">One quick question</p>
      <h1 className="mt-2 text-[24px] font-bold leading-snug">{props.question}</h1>
      <p className="mt-2 text-base text-stone-600">Tap one, or say it in your own words.</p>

      <div className="mt-5 flex flex-col gap-2">
        {props.suggestions.map((s) => (
          <ChipButton key={s} onClick={() => props.onAnswer(s)}>
            <span className="block py-2 text-left">{s}</span>
          </ChipButton>
        ))}
      </div>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) props.onAnswer(text.trim());
        }}
      >
        <label htmlFor="answer" className="block text-base font-semibold">
          Or type your answer
        </label>
        <textarea
          id="answer"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I help working women do 20 minute home workouts"
          className="mt-2 w-full resize-none rounded-2xl border border-stone-300 bg-white px-4 py-3 text-[16px] leading-6 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <PrimaryButton type="submit" disabled={!text.trim()} className="mt-3">
          Continue
        </PrimaryButton>
      </form>

      <button type="button" onClick={props.onBack} className="mx-auto mt-4 min-h-[44px] px-4 text-base text-stone-500 underline">
        Go back and edit what I wrote
      </button>
    </div>
  );
}
