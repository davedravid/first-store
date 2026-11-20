"use client";

import { useEffect, useState } from "react";

/**
 * A skeleton of the real page, so the creator sees the shape of what is coming.
 * The time hint is honest: in our evals a store took about 3 s, or 6-8 s when the first draft needed a fix.
 * After 10 s the main AI has timed out and the backup is really taking over, so we say so.
 */
export function GeneratingScreen(props: { onCancel: () => void }) {
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
    <div className="flex min-h-dvh flex-col px-4 pb-10 pt-6" aria-busy="true">
      <div role="status" aria-live="polite" className="sticky top-3 z-10 rounded-2xl bg-accent-soft px-4 py-3 shadow-sm">
        <p className="text-base font-semibold text-accent">Writing your page and picking prices...</p>
        <p className="mt-1 text-[15px] text-stone-700">{hint}</p>
      </div>

      <div className="mt-6 flex flex-col items-center">
        <div className="skeleton h-16 w-16 !rounded-full" />
        <div className="skeleton mt-4 h-6 w-48" />
        <div className="skeleton mt-2 h-4 w-64" />
      </div>
      <div className="mt-6 space-y-2">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-[92%]" />
        <div className="skeleton h-4 w-[80%]" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton mt-3 h-5 w-3/4" />
          <div className="skeleton mt-3 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-2/3" />
          <div className="skeleton mt-4 h-6 w-16" />
        </div>
      ))}

      <button type="button" onClick={props.onCancel} className="mx-auto mt-6 min-h-[44px] px-4 text-base text-stone-500 underline">
        Cancel and edit my words
      </button>
    </div>
  );
}
