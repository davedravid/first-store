"use client";

import dynamic from "next/dynamic";

/** The app reads the saved draft from this phone, so it only renders in the browser. The fallback is the same shape, never blank. */
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <main className="mx-auto w-full max-w-[480px] px-4 pt-6" aria-busy="true">
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">First Store</p>
      <h1 className="mt-2 text-[28px] font-bold leading-tight">Let&apos;s build your first store</h1>
      <div className="skeleton mt-6 h-32 w-full" />
    </main>
  ),
});

export default function ClientApp() {
  return <App />;
}
