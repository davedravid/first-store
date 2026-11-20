"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product, Storefront as Store } from "@/lib/ai/schema";
import { track } from "@/lib/ui/track";
import { themeFor } from "@/lib/ui/theme";
import { Storefront } from "./Storefront";
import { PrimaryButton, Sheet } from "./ui";

const field = "w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-[16px] outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10";

/** What a follower sees. Same Storefront as the editor, in public mode, plus the "I want this" sign-up. */
export function PublicStore(props: { slug: string; store: Store }) {
  const { slug, store } = props;
  const theme = themeFor(store);
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"form" | "sending" | "done" | "error" | "busy" | "contact">("form");
  const creator = store.creator.display_name;

  useEffect(() => track("page_view", slug), [slug]);

  const open = (p: Product) => {
    setProduct(p);
    setState("form");
  };

  async function submit() {
    if (!product) return;
    setState("sending");
    try {
      const res = await fetch("/api/want", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, productId: product.id, name, contact, consent: true }),
      });
      const j = await res.json().catch(() => null);
      if (j?.ok) return setState("done");
      setState(j?.reason === "contact" ? "contact" : res.status === 429 ? "busy" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[480px] bg-[#fbfaf8] lg:my-8 lg:min-h-0 lg:overflow-hidden lg:rounded-[32px] lg:shadow-xl">
      <Storefront store={store} theme={theme} onWant={open} />
      <p className="pb-8 text-center text-xs text-stone-400">
        <Link href="/" className="underline underline-offset-2">
          Make your own store
        </Link>
      </p>

      <Sheet open={product !== null} title={state === "done" ? "You are on the list" : "Get notified"} onClose={() => setProduct(null)}>
        {state === "done" ? (
          <div>
            <p className="text-base leading-6 text-stone-700">
              Thanks, {name.split(" ")[0]}. {creator} will let you know when <b>{product?.title}</b> is ready.
            </p>
            <PrimaryButton className="mt-5" onClick={() => setProduct(null)}>
              Done
            </PrimaryButton>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && contact.trim()) submit();
            }}
          >
            <p className="text-[15px] leading-6 text-stone-600">
              <b className="text-stone-900">{product?.title}</b> is not out yet. Leave your details and {creator} will tell you when it launches.
            </p>
            <label htmlFor="want-name" className="mt-4 block text-[15px] font-semibold">
              Your name
            </label>
            <input id="want-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} className={`${field} mt-1.5 min-h-[48px]`} />
            <label htmlFor="want-contact" className="mt-3 block text-[15px] font-semibold">
              WhatsApp number or email
            </label>
            <input id="want-contact" value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="on" maxLength={120} placeholder="98xxxxxx10 or you@email.com" className={`${field} mt-1.5 min-h-[48px]`} />
            {state === "contact" && <p className="mt-1 text-sm font-medium text-[#b91c1c]">That does not look like a 10-digit mobile number or an email.</p>}
            {state === "error" && <p className="mt-1 text-sm font-medium text-[#b91c1c]">Something went wrong on our side. Please try again.</p>}
            {state === "busy" && <p className="mt-1 text-sm font-medium text-[#b91c1c]">Too many tries from this device. Please try again later.</p>}
            <p className="mt-3 text-[13px] leading-5 text-stone-500">Only {creator} sees this, and only to tell you when it launches.</p>
            <PrimaryButton type="submit" className="mt-4" disabled={state === "sending" || !name.trim() || !contact.trim()}>
              {state === "sending" ? "Sending..." : "Notify me"}
            </PrimaryButton>
          </form>
        )}
      </Sheet>
    </main>
  );
}
