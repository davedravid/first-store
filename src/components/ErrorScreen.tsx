"use client";

import type { UiError } from "@/lib/ui/api";
import { PrimaryButton, SecondaryButton } from "./ui";

const COPY: Record<UiError, { title: string; body: string; icon: string }> = {
  offline: {
    title: "You are offline",
    body: "Your words are saved on this phone. Connect to the internet and tap Try again.",
    icon: "M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18",
  },
  slow: {
    title: "This is taking too long",
    body: "Our AI is slow right now. Your words are saved, so trying again only takes a tap.",
    icon: "M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
  },
  busy: {
    title: "Lots of people are building stores right now",
    body: "Please try again in a few minutes. Your words are saved.",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  },
  broken: {
    title: "Something went wrong on our side",
    body: "It is not you. Your words are saved. Tap Try again and we will have another go.",
    icon: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  },
};

export function ErrorScreen(props: { kind: UiError; daily?: boolean; onRetry: () => void; onEdit: () => void }) {
  const c = COPY[props.kind];
  const body = props.kind === "busy" && props.daily ? "We have hit today's limit for new stores on our free plan. Please try again later. Your words are saved." : c.body;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-6 pb-16">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-900">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={c.icon} />
        </svg>
      </div>
      <h1 className="mt-5 text-center font-[family-name:var(--font-display)] text-[24px] font-extrabold leading-tight tracking-tight">{c.title}</h1>
      <p className="mt-2 text-center text-base leading-6 text-stone-600">{body}</p>
      <div className="mt-8 flex flex-col gap-3">
        <PrimaryButton onClick={props.onRetry}>Try again</PrimaryButton>
        <SecondaryButton onClick={props.onEdit}>Edit my words</SecondaryButton>
      </div>
    </div>
  );
}
