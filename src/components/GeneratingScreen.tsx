"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { themeVars, type Theme } from "@/lib/ui/theme";

/**
 * A skeleton in the shape of the real storefront, tinted with the accent guessed from the creator's words.
 * The time hint is honest: in our evals a store took about 3 s, or 6-8 s when the first draft needed a fix.
 * After 10 s the main AI has timed out and the backup is really taking over, so we say so.
 */
export function GeneratingScreen(props: { theme: Theme; onCancel: () => void }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const hint =
    secs < 10
      ? "This usually takes 3 to 8 seconds."
      : secs < 35
        ? "Taking longer than usual. Our main AI is slow, so we are asking our backup."
        : "Still working. We stop at about a minute and you can try again.";

  return (
    <div style={themeVars(props.theme) as CSSProperties} className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col pb-10 lg:max-w-[1100px] lg:flex-row lg:items-center lg:justify-center lg:gap-16" aria-busy="true">
      <div role="status" aria-live="polite" className="sticky top-0 z-10 bg-background/95 px-4 pb-3 pt-4 backdrop-blur lg:static lg:w-[320px] lg:bg-transparent lg:p-0">
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <p className="flex items-center gap-2 text-[16px] font-semibold text-stone-900 lg:font-[family-name:var(--font-display)] lg:text-[30px] lg:font-extrabold lg:leading-tight">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-store lg:hidden" />
            Writing your page and picking prices...
          </p>
          <p className="mt-1 text-[15px] text-stone-600 lg:mt-3 lg:text-[16px]">{hint}</p>
          <button type="button" onClick={props.onCancel} className="mt-1 hidden min-h-[44px] text-[15px] text-stone-500 underline underline-offset-4 lg:block">
            Cancel and edit my words
          </button>
        </div>
      </div>

      <div className="frame-lg">
        <div className="phone-scroll bg-[#f6f7f9]">
          <div className="h-28" style={{ background: "linear-gradient(135deg, var(--accent), var(--deep))", opacity: 0.85 }} />
          <div className="relative z-10 mx-auto -mt-12 h-24 w-24 rounded-full bg-store opacity-30 ring-4 ring-[#f6f7f9]" />
          <div className="flex flex-col items-center px-5">
            <div className="mt-4 h-7 w-44 animate-pulse rounded-lg bg-store-tint" />
            <div className="skeleton mt-2 h-4 w-60" />
          </div>
          <div className="mt-5 space-y-2 px-5">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-[94%]" />
            <div className="skeleton h-3.5 w-[78%]" />
          </div>
          <div className="skeleton mx-5 mt-8 h-5 w-32" />
          {[0, 1].map((i) => (
            <div key={i} className="mx-4 mt-3 rounded-3xl border border-stone-200 bg-white p-5">
              <div className="h-5 w-20 animate-pulse rounded-full bg-store-tint" />
              <div className="skeleton mt-4 h-6 w-3/4" />
              <div className="skeleton mt-3 h-3.5 w-full" />
              <div className="skeleton mt-2 h-3.5 w-2/3" />
              <div className="mt-5 flex items-center gap-3 border-t border-stone-100 pt-4">
                <div className="skeleton h-8 w-20" />
                <div className="h-12 flex-1 rounded-2xl bg-store opacity-25" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={props.onCancel} className="mx-auto mt-6 min-h-[44px] px-4 text-base text-stone-500 underline lg:hidden">
        Cancel and edit my words
      </button>
    </div>
  );
}
