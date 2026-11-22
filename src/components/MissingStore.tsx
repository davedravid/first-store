import Link from "next/link";

export function MissingStore() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-[26px] font-extrabold tracking-tight">This store is not here</h1>
      <p className="mt-2 text-base leading-6 text-stone-600">The link may be mistyped, or the store was never published.</p>
      <Link href="/" className="mx-auto mt-6 flex min-h-[48px] items-center rounded-2xl bg-stone-900 px-6 font-semibold text-white">
        Make your own store
      </Link>
    </main>
  );
}
