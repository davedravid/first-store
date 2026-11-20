"use client";

import dynamic from "next/dynamic";

/** The app reads the saved draft from this phone, so it only renders in the browser. The fallback is the same shape, never blank. */
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <main className="mx-auto w-full max-w-[1180px] px-4 pt-5 lg:px-10 lg:pt-14" aria-busy="true">
      <p className="font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-tight">First Store</p>
      <h1 className="mt-4 max-w-[640px] font-[family-name:var(--font-display)] text-[32px] font-extrabold leading-[1.05] tracking-tight lg:mt-10 lg:text-[52px]">Turn what you know into a store.</h1>
      <div className="skeleton mt-8 h-28 w-full max-w-[640px]" />
    </main>
  ),
});

export default function ClientApp() {
  return <App />;
}
