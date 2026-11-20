"use client";

import { useState } from "react";
import { FORMAT_LABEL, type Chip, type CreatorInput, type Product, type Storefront } from "@/lib/ai/schema";
import type { RegenTarget, UiError } from "@/lib/ui/api";
import { canStep, priceNote, rs, stepLimitMessage } from "@/lib/ui/pricing";
import type { PriceOverride } from "@/lib/ui/storage";
import { ChipButton, Editable, PrimaryButton, RegenIcon, SecondaryButton, Sheet } from "./ui";

const CHIP_LABEL: Record<Chip, string> = {
  try_another: "Try another",
  shorter: "Shorter",
  more_casual: "More casual",
  more_premium: "More premium",
  cheaper: "Cheaper",
};
const ABOUT_CHIPS: Chip[] = ["try_another", "shorter", "more_casual", "more_premium"];
const PRODUCT_CHIPS: Chip[] = ["try_another", "shorter", "more_casual", "more_premium", "cheaper"];
const TIER_LABEL = { starter: "Starter", core: "Core", premium: "Premium" } as const;

const REGEN_ERROR: Record<UiError, string> = {
  offline: "You are offline. Connect and try again. Nothing on your page changed.",
  slow: "That took too long. Nothing on your page changed, so try again.",
  busy: "Lots of people are building stores right now. Try again in a few minutes.",
  broken: "Something went wrong on our side. Nothing on your page changed.",
};

export type RegenOutcome = { ok: true } | { ok: false; kind: UiError };

export function Editor(props: {
  input: CreatorInput;
  storefront: Storefront;
  prices: Record<string, PriceOverride>;
  busyBlock: string | null;
  onEdit: (sf: Storefront) => void;
  onPrice: (productId: string, price: number | null) => void;
  onRegenerate: (target: RegenTarget, chip: Chip) => Promise<RegenOutcome>;
  onRegenerateAll: () => void;
  onBackToInput: () => void;
}) {
  const { storefront: sf, input } = props;
  const [sheet, setSheet] = useState<{ target: RegenTarget; note?: string; error?: string; last?: Chip } | null>(null);

  const editCreator = (patch: Partial<Storefront["creator"]>) => props.onEdit({ ...sf, creator: { ...sf.creator, ...patch } });
  const editProduct = (id: string, patch: Partial<Product>) => props.onEdit({ ...sf, products: sf.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const product = sheet?.target.kind === "product" ? sf.products.find((p) => p.id === (sheet.target as { productId: string }).productId) : undefined;

  async function pick(chip: Chip) {
    if (!sheet) return;
    if (product && (chip === "cheaper" || chip === "more_premium")) {
      const dir = chip === "cheaper" ? -1 : 1;
      if (!canStep(input, sf, product, dir)) {
        setSheet({ ...sheet, note: stepLimitMessage(product, dir), error: undefined });
        return;
      }
    }
    const target = sheet.target;
    setSheet(null);
    const r = await props.onRegenerate(target, chip);
    if (!r.ok) setSheet({ target, error: REGEN_ERROR[r.kind], last: chip });
  }

  const initials = sf.creator.display_name.replace(/^@/, "").split(/[\s._]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="min-h-dvh pb-40">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-background/95 px-2 backdrop-blur">
        <button type="button" onClick={props.onBackToInput} className="min-h-[48px] px-2 text-[15px] font-medium text-stone-700">
          ← Edit my words
        </button>
        <span className="px-2 text-sm text-stone-500">Draft saved</span>
      </header>

      <p className="mx-4 mt-4 rounded-xl bg-accent-soft px-3 py-2 text-[15px] text-stone-800">
        Tap any text to change it. Tap <span aria-hidden="true">↻</span> to get a new version of a block.
      </p>

      {/* About block */}
      <section aria-label="About" className={`relative mx-4 mt-4 rounded-3xl bg-white p-5 shadow-sm ${props.busyBlock === "about" ? "opacity-50" : ""}`}>
        <div className="absolute right-2 top-2">
          <RegenIcon label="New version of the about block" onClick={() => setSheet({ target: { kind: "about" } })} />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-bold text-white" aria-hidden="true">
            {initials || "★"}
          </div>
          <Editable label="name" value={sf.creator.display_name} onChange={(v) => editCreator({ display_name: v })} singleLine maxLength={40} className="mt-3 text-center text-[22px] font-bold" />
          <Editable label="tagline" value={sf.creator.tagline} onChange={(v) => editCreator({ tagline: v })} maxLength={90} className="text-center text-base text-stone-600" />
        </div>
        <Editable label="bio" value={sf.creator.bio} onChange={(v) => editCreator({ bio: v })} maxLength={450} className="mt-3 text-base leading-6 text-stone-800" />
        {props.busyBlock === "about" && <p className="mt-2 text-center text-sm font-medium text-accent">Rewriting...</p>}
      </section>

      <h2 className="mx-4 mt-7 text-lg font-bold">What I offer</h2>
      {sf.products.map((p) => {
        const note = priceNote(input, sf, p);
        const override = props.prices[p.id];
        const busy = props.busyBlock === p.id;
        return (
          <section key={p.id} aria-label={p.title} className={`relative mx-4 mt-3 rounded-3xl bg-white p-5 shadow-sm ${busy ? "opacity-50" : ""}`}>
            <div className="absolute right-2 top-2">
              <RegenIcon label={`New version of ${p.title}`} onClick={() => setSheet({ target: { kind: "product", productId: p.id } })} />
            </div>
            <p className="pr-10 text-sm font-medium text-stone-500">
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{TIER_LABEL[p.tier]}</span> {FORMAT_LABEL[p.format]}
            </p>
            <Editable label="product title" value={p.title} onChange={(v) => editProduct(p.id, { title: v })} singleLine maxLength={60} className="mt-2 text-lg font-semibold leading-snug" />
            <Editable label="product description" value={p.description} onChange={(v) => editProduct(p.id, { description: v })} maxLength={240} className="mt-1 text-base leading-6 text-stone-700" />
            <ul className="mt-2 space-y-0.5">
              {p.whats_inside.map((w, j) => (
                <li key={j} className="flex items-start gap-2 text-[15px] text-stone-700">
                  <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <Editable label={`point ${j + 1}`} value={w} onChange={(v) => editProduct(p.id, { whats_inside: p.whats_inside.map((x, k) => (k === j ? v : x)) })} singleLine maxLength={80} />
                </li>
              ))}
            </ul>

            <PriceField price={p.price_inr} onSet={(n) => props.onPrice(p.id, n)} />
            {note && <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{note}</p>}
            {override && (
              <button type="button" onClick={() => props.onPrice(p.id, null)} className="min-h-[44px] text-sm font-medium text-accent">
                Use our suggested price ({rs(override.suggested)})
              </button>
            )}
            <p className="mt-1 text-sm leading-5 text-stone-500">
              <span className="font-medium text-stone-600">Why this price: </span>
              {p.price_rationale}
            </p>
            {busy && <p className="mt-2 text-sm font-medium text-accent">Rewriting...</p>}
          </section>
        );
      })}

      {sf.disclaimer && <p className="mx-4 mt-5 text-center text-sm text-stone-500">{sf.disclaimer}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-background/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-[480px] grid-cols-[1fr_1.4fr] gap-3">
          <SecondaryButton onClick={props.onRegenerateAll} disabled={props.busyBlock !== null}>
            Redo all
          </SecondaryButton>
          <PrimaryButton disabled>Publish</PrimaryButton>
        </div>
        <p className="mt-1 text-center text-xs text-stone-500">Publishing is coming in the next step.</p>
      </div>

      <Sheet open={sheet !== null} title={sheet?.target.kind === "about" ? "New version of your intro" : "New version of this product"} onClose={() => setSheet(null)}>
        {sheet?.error ? (
          <div>
            <p className="mb-4 text-base leading-6 text-stone-700">{sheet.error}</p>
            <PrimaryButton onClick={() => sheet.last && pick(sheet.last)}>Try again</PrimaryButton>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(sheet?.target.kind === "about" ? ABOUT_CHIPS : PRODUCT_CHIPS).map((c) => (
                <ChipButton key={c} onClick={() => pick(c)}>
                  {CHIP_LABEL[c]}
                </ChipButton>
              ))}
            </div>
            {sheet?.note && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-[15px] leading-6 text-amber-900">{sheet.note}</p>}
            <p className="mt-4 text-sm text-stone-500">Only this block changes. You can undo it.</p>
          </>
        )}
      </Sheet>
    </div>
  );
}

function PriceField(props: { price: number; onSet: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <label className="mt-3 flex items-center gap-2">
        <span className="text-xl font-bold">₹</span>
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
          className="min-h-[44px] w-32 rounded-xl border border-accent px-3 text-[18px] font-bold outline-none ring-2 ring-accent/20"
        />
      </label>
    );
  return (
    <button type="button" aria-label={`Price ${rs(props.price)}, tap to change`} onClick={() => setEditing(true)} className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl px-1 text-[22px] font-bold active:bg-stone-100">
      {rs(props.price)}
      <span className="text-sm font-medium text-stone-500">Change</span>
    </button>
  );
}
