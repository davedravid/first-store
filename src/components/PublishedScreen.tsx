"use client";

import { useState, type CSSProperties } from "react";
import type { Storefront } from "@/lib/ai/schema";
import type { Interest } from "@/lib/ui/api";
import { themeVars, type Theme } from "@/lib/ui/theme";
import { track } from "@/lib/ui/track";
import type { Published } from "@/lib/ui/storage";
import { PrimaryButton, SecondaryButton } from "./ui";

/** Spec decision 10: the north-star click. SuperProfile's public site; no account data is passed along. */
export const SUPERPROFILE_URL = "https://superprofile.bio";

export function PublishedScreen(props: {
  published: Published;
  storefront: Storefront;
  theme: Theme;
  interest: Interest | null;
  justPublished: boolean;
  onKeepEditing: () => void;
  onRefresh: () => void;
}) {
  const { published, storefront: sf } = props;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const liveUrl = `${origin}/s/${published.slug}`;
  const editUrl = `${origin}/e/${published.slug}#k=${published.token}`;
  const shareText = `${sf.creator.tagline} ${liveUrl}`;
  const counts = props.interest?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const titleOf = (id: string) => sf.products.find((p) => p.id === id)?.title ?? "a product";

  return (
    <div style={themeVars(props.theme) as CSSProperties} className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-16 pt-6">
      <div className="rounded-3xl bg-store px-5 py-6 text-white" style={{ background: "linear-gradient(135deg, var(--accent), var(--deep))" }}>
        <p className="text-sm font-semibold uppercase tracking-wider text-white/80">{props.justPublished ? "Published" : "Your store"}</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[30px] font-extrabold leading-tight tracking-tight">{props.justPublished ? "Your store is live." : sf.creator.display_name}</h1>
        <p className="mt-2 text-[15px] text-white/85">Share the link in your bio, stories and WhatsApp groups.</p>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/15 p-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium" data-testid="live-url">
            {liveUrl.replace(/^https?:\/\//, "")}
          </span>
          <CopyButton text={liveUrl} label="Copy link" onCopy={() => track("share_click", published.slug)} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("share_click", published.slug)}
            className="flex min-h-[48px] items-center justify-center rounded-2xl bg-white text-[15px] font-bold text-store-deep"
          >
            Share on WhatsApp
          </a>
          <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] items-center justify-center rounded-2xl border border-white/40 text-[15px] font-semibold text-white">
            Open my page
          </a>
        </div>
      </div>

      {/* Interest: who tapped "I want this" */}
      <section className="mt-5 rounded-3xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-[19px] font-extrabold">Who wants what</h2>
          <button type="button" onClick={props.onRefresh} className="min-h-[40px] px-1 text-sm font-medium text-stone-500 underline underline-offset-2">
            Refresh
          </button>
        </div>
        {total === 0 ? (
          <p className="mt-2 text-[15px] leading-6 text-stone-600">No one yet. When followers tap &quot;I want this&quot;, you will see them here, so you know which product to make first.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2">
              {sf.products.map((p) =>
                counts[p.id] ? (
                  <li key={p.id} className="rounded-xl bg-store-tint px-3 py-2 text-[15px] text-store-deep">
                    <b>
                      {counts[p.id]} {counts[p.id] === 1 ? "person wants" : "people want"}
                    </b>{" "}
                    your {p.title}
                  </li>
                ) : null,
              )}
            </ul>
            <details className="mt-3">
              <summary className="min-h-[40px] cursor-pointer text-[14px] font-semibold text-stone-700">See their names and contacts</summary>
              <ul className="mt-1 divide-y divide-stone-100 text-[14px]">
                {props.interest!.signups.map((s, i) => (
                  <li key={i} className="py-2">
                    <b>{s.name}</b> <span className="text-stone-500">· {s.contact}</span>
                    <span className="block text-[13px] text-stone-500">wants {titleOf(s.productId)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-stone-500">They agreed to hear from you only about this launch.</p>
            </details>
          </>
        )}
      </section>

      {/* Private edit link */}
      <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-[16px] font-bold text-amber-950">Save your private edit link</h2>
        <p className="mt-1 text-[14px] leading-5 text-amber-900">There is no login. This link is the only way to edit your store and see who wants your products from another phone. Keep it to yourself.</p>
        <div className="mt-3">
          <CopyButton text={editUrl} label="Copy my edit link" wide />
        </div>
      </section>

      {/* North star */}
      <section className="mt-5 rounded-3xl border border-stone-200 bg-white p-5">
        <h2 className="font-[family-name:var(--font-display)] text-[19px] font-extrabold">Ready to take payments?</h2>
        <p className="mt-1 text-[15px] leading-6 text-stone-600">Move this store to SuperProfile to sell for real: payments, delivery and your own link in bio.</p>
        <a
          href={SUPERPROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("superprofile_click", published.slug)}
          className="mt-4 flex min-h-[52px] items-center justify-center rounded-2xl bg-stone-900 px-5 py-2 text-center text-[17px] font-semibold text-white"
        >
          Make this a real store on SuperProfile
        </a>
      </section>

      <SecondaryButton className="mt-5" onClick={props.onKeepEditing}>
        Keep editing my store
      </SecondaryButton>
    </div>
  );
}

function CopyButton(props: { text: string; label: string; wide?: boolean; onCopy?: () => void }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.text);
    } catch {
      // Older phones: fall back to a prompt the user can copy from.
      window.prompt("Copy this link:", props.text);
    }
    props.onCopy?.();
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  if (props.wide) return <PrimaryButton onClick={copy}>{done ? "Copied" : props.label}</PrimaryButton>;
  return (
    <button type="button" onClick={copy} className="min-h-[44px] shrink-0 rounded-xl bg-white px-4 text-[14px] font-bold text-store-deep">
      {done ? "Copied" : props.label}
    </button>
  );
}
