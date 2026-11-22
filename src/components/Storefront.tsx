"use client";

import { useState, type CSSProperties } from "react";
import { FORMAT_LABEL, type CreatorInput, type Product, type Storefront as Store } from "@/lib/ai/schema";
import { priceNote, rs } from "@/lib/ui/pricing";
import type { PriceOverride } from "@/lib/ui/storage";
import { themeVars, type Theme } from "@/lib/ui/theme";
import { Editable, RegenIcon } from "./ui";

/**
 * THE storefront. The editor renders it with `edit`, the public page will render it without,
 * so the creator edits exactly what followers see. "Why this price", price warnings,
 * "New version" buttons and the pencils only exist in edit mode.
 */
export type EditHooks = {
  input: CreatorInput;
  prices: Record<string, PriceOverride>;
  busyBlock: string | null;
  onCreator: (patch: Partial<Store["creator"]>) => void;
  onProduct: (id: string, patch: Partial<Product>) => void;
  onPrice: (id: string, price: number | null) => void;
  onRegen: (target: { kind: "about" } | { kind: "product"; productId: string }) => void;
};

const TIER_LABEL = { starter: "Starter", core: "Core", premium: "Premium" } as const;

export function initialsOf(name: string) {
  return (
    name
      .replace(/^@/, "")
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "★"
  );
}

export function Storefront(props: { store: Store; theme: Theme; edit?: EditHooks; onWant?: (p: Product) => void; wantCounts?: Record<string, number> }) {
  const { store, theme, edit } = props;
  const c = store.creator;
  const text = (label: string, value: string, onChange: (v: string) => void, className: string, max: number, singleLine = false) =>
    edit ? <Editable label={label} value={value} onChange={onChange} className={className} maxLength={max} singleLine={singleLine} /> : <p className={className}>{value}</p>;

  return (
    <article style={themeVars(theme) as CSSProperties} className="min-h-full bg-[#f6f7f9] pb-8 text-stone-900">
      {/* Header band */}
      <div
        className="relative h-28 bg-store"
        style={{ background: "linear-gradient(160deg, var(--accent) 0%, var(--deep) 100%)" }}
      >
        {edit && (
          <div className="absolute right-3 top-3">
            <RegenIcon onDark label="New version of your intro" onClick={() => edit.onRegen({ kind: "about" })} />
          </div>
        )}
      </div>

      {/* Profile */}
      <section aria-label="About" className={`relative px-5 text-center ${edit?.busyBlock === "about" ? "opacity-50" : ""}`}>
        <div className="relative mx-auto -mt-12 flex h-24 w-24 items-center justify-center rounded-full bg-store font-[family-name:var(--font-display)] text-3xl font-extrabold text-white shadow-md ring-4 ring-[#f6f7f9]" aria-hidden="true">
          {initialsOf(c.display_name)}
        </div>
        <div className="mt-3">{text("name", c.display_name, (v) => edit?.onCreator({ display_name: v }), "text-center font-[family-name:var(--font-display)] text-[26px] font-extrabold leading-tight tracking-tight", 40, true)}</div>
        <div className="mt-1">{text("tagline", c.tagline, (v) => edit?.onCreator({ tagline: v }), "text-center text-[16px] font-medium leading-snug text-store-deep", 90)}</div>
        <div className="mt-4">{text("bio", c.bio, (v) => edit?.onCreator({ bio: v }), "text-left text-[15px] leading-6 text-stone-700", 450)}</div>
        {edit?.busyBlock === "about" && <p className="mt-2 text-sm font-semibold text-store">Writing a new version...</p>}
      </section>

      {/* Products */}
      <h2 className="mt-8 px-5 font-[family-name:var(--font-display)] text-[20px] font-extrabold">What I offer</h2>
      <div className="mt-3 space-y-4 px-4">
        {store.products.map((p) => (
          <ProductCard key={p.id} p={p} store={store} edit={edit} text={text} onWant={props.onWant} wanted={props.wantCounts?.[p.id]} />
        ))}
      </div>

      {store.disclaimer && <p className="mt-8 px-6 text-center text-[13px] leading-5 text-stone-500">{store.disclaimer}</p>}
      <p className="mt-4 text-center text-xs text-stone-400">Made with First Store</p>
    </article>
  );
}

function ProductCard(props: {
  p: Product;
  store: Store;
  edit?: EditHooks;
  text: (label: string, value: string, onChange: (v: string) => void, className: string, max: number, singleLine?: boolean) => React.ReactNode;
  onWant?: (p: Product) => void;
  wanted?: number;
}) {
  const { p, store, edit, text } = props;
  const [hint, setHint] = useState(false);
  const busy = edit?.busyBlock === p.id;
  const note = edit ? priceNote(edit.input, store, p) : null;
  const override = edit?.prices[p.id];

  return (
    <section aria-label={p.title} className={`rounded-3xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)] ${busy ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap">
          <span className="shrink-0 rounded-full bg-store-tint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-store">{TIER_LABEL[p.tier]}</span>
          <span className="truncate rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">{FORMAT_LABEL[p.format]}</span>
        </div>
        {edit && <RegenIcon label={`New version of ${p.title}`} onClick={() => edit.onRegen({ kind: "product", productId: p.id })} />}
      </div>

      <div className="mt-3">{text("product title", p.title, (v) => edit?.onProduct(p.id, { title: v }), "font-[family-name:var(--font-display)] text-[21px] font-extrabold leading-tight tracking-tight", 60, true)}</div>
      <div className="mt-2">{text("product description", p.description, (v) => edit?.onProduct(p.id, { description: v }), "text-[15px] leading-6 text-stone-600", 240)}</div>
      <ul className="mt-3 space-y-1.5">
        {p.whats_inside.map((w, j) => (
          <li key={j} className="flex items-start gap-2.5 text-[15px] leading-6 text-stone-700">
            <svg className="mt-[5px] shrink-0 text-store opacity-80" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <div className="min-w-0 flex-1">{text(`point ${j + 1}`, w, (v) => edit?.onProduct(p.id, { whats_inside: p.whats_inside.map((x, k) => (k === j ? v : x)) }), "", 80, true)}</div>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
        {edit ? <PriceField price={p.price_inr} onSet={(n) => edit.onPrice(p.id, n)} /> : <p className="font-[family-name:var(--font-display)] text-[28px] font-extrabold">{rs(p.price_inr)}</p>}
        <button
          type="button"
          onClick={() => {
            if (!edit) return props.onWant?.(p);
            setHint(true);
            setTimeout(() => setHint(false), 2500);
          }}
          className="min-h-[48px] flex-1 rounded-2xl bg-store px-4 text-[16px] font-bold text-white shadow-sm transition active:scale-[0.98]"
        >
          I want this
        </button>
      </div>
      {hint && (
        <p role="status" className="mt-2 text-center text-sm text-stone-500">
          Followers will tap this on your live page.
        </p>
      )}

      {edit && props.wanted ? (
        <p className="mt-3 rounded-xl bg-store-tint px-3 py-2 text-[13px] font-semibold text-store-deep">
          {props.wanted} {props.wanted === 1 ? "person wants" : "people want"} this
        </p>
      ) : null}
      {edit && (
        <>
          {note && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-900">{note}</p>}
          {override && (
            <button type="button" onClick={() => edit.onPrice(p.id, null)} className="mt-1 min-h-[40px] text-[13px] font-semibold text-store">
              Use our suggested price ({rs(override.suggested)})
            </button>
          )}
          <details className="group mt-2">
            <summary className="flex min-h-[36px] cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-stone-500">
              <svg className="transition group-open:rotate-90" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
              Why this price? <span className="text-stone-400">(only you see this)</span>
            </summary>
            <p className="pb-1 pl-4 text-[13px] leading-5 text-stone-500">{p.price_rationale}</p>
          </details>
          {busy && <p className="mt-1 text-sm font-semibold text-store">Writing a new version...</p>}
        </>
      )}
    </section>
  );
}

function PriceField(props: { price: number; onSet: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <label className="flex items-center gap-1">
        <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold">₹</span>
        <input
          autoFocus
          inputMode="numeric"
          aria-label="Price in rupees"
          defaultValue={props.price}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          onBlur={(e) => {
            const n = Math.round(Number(e.target.value.replace(/[^\d]/g, "")));
            if (n > 0 && n !== props.price) props.onSet(Math.min(n, 99999));
            setEditing(false);
          }}
          className="min-h-[44px] w-24 rounded-xl border border-store px-2 text-[18px] font-bold outline-none ring-2 ring-store/20"
        />
      </label>
    );
  return (
    <button type="button" aria-label={`Price ${rs(props.price)}, tap to change`} onClick={() => setEditing(true)} className="editable rounded-lg px-1.5 py-0.5 text-left">
      <span className="font-[family-name:var(--font-display)] text-[28px] font-extrabold leading-none">{rs(props.price)}</span>
      <span className="block text-[12px] font-medium text-stone-500">Tap to change</span>
    </button>
  );
}
