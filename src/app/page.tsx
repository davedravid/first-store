export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center gap-4 px-5 py-10">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        First Store
      </p>
      <h1 className="text-3xl font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
        Hello. Your store is coming soon.
      </h1>
      <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
        Tell us what you do and we will draft a store you can share in a few
        minutes.
      </p>
    </main>
  );
}
