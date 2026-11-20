"use client";

import { useState, type CSSProperties } from "react";
import type { Chip, CreatorInput, Storefront as Store } from "@/lib/ai/schema";
import type { RegenTarget, UiError } from "@/lib/ui/api";
import { canStep, stepLimitMessage } from "@/lib/ui/pricing";
import type { PriceOverride } from "@/lib/ui/storage";
import { themeVars, type Theme } from "@/lib/ui/theme";
import { Storefront, type EditHooks } from "./Storefront";
import { ChipButton, PrimaryButton, Sheet } from "./ui";

const CHIP_LABEL: Record<Chip, string> = {
  try_another: "Try another",
  shorter: "Shorter",
  more_casual: "More casual",
  more_premium: "More premium",
  cheaper: "Cheaper",
};
const ABOUT_CHIPS: Chip[] = ["try_another", "shorter", "more_casual", "more_premium"];
const PRODUCT_CHIPS: Chip[] = ["try_another", "shorter", "more_casual", "more_premium", "cheaper"];

const REGEN_ERROR: Record<UiError, string> = {
  offline: "You are offline. Connect and try again. Nothing on your page changed.",
  slow: "That took too long. Nothing on your page changed, so try again.",
  busy: "Lots of people are building stores right now. Try again in a few minutes.",
  broken: "Something went wrong on our side. Nothing on your page changed.",
};

export type RegenOutcome = { ok: true } | { ok: false; kind: UiError };

export function Editor(props: {
  input: CreatorInput;
  storefront: Store;
  theme: Theme;
  prices: Record<string, PriceOverride>;
  busyBlock: string | null;
  onEdit: (sf: Store) => void;
  onPrice: (productId: string, price: number | null) => void;
  onRegenerate: (target: RegenTarget, chip: Chip) => Promise<RegenOutcome>;
  onRegenerateAll: () => void;
  onBackToInput: () => void;
  published: { slug: string; hasChanges: boolean } | null;
  publishing: boolean;
  wantCounts?: Record<string, number>;
  onPublish: () => void;
  onShowLive: () => void;
}) {
  const { storefront: sf, input, theme } = props;
  const [sheet, setSheet] = useState<{ target: RegenTarget; note?: string; error?: string; last?: Chip } | null>(null);

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

  const hooks: EditHooks = {
    input,
    prices: props.prices,
    busyBlock: props.busyBlock,
    onCreator: (patch) => props.onEdit({ ...sf, creator: { ...sf.creator, ...patch } }),
    onProduct: (id, patch) => props.onEdit({ ...sf, products: sf.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),
    onPrice: props.onPrice,
    onRegen: (target) => setSheet({ target }),
  };

  const pub = props.published;
  const publish = (
    <div>
      <PrimaryButton onClick={props.onPublish} disabled={props.publishing || props.busyBlock !== null || (pub !== null && !pub.hasChanges)}>
        {props.publishing ? "Publishing..." : pub ? (pub.hasChanges ? "Update my live page" : "Live and up to date") : "Publish my store"}
      </PrimaryButton>
      {pub ? (
        <button type="button" onClick={props.onShowLive} className="mt-1 block w-full text-center text-xs font-medium text-stone-600 underline underline-offset-2">
          Live at /s/{pub.slug} · share and see interest
        </button>
      ) : (
        <p className="mt-1.5 text-center text-xs text-stone-500">Free, no login. You get a link to share.</p>
      )}
    </div>
  );

  return (
    <div style={themeVars(theme) as CSSProperties} className="mx-auto w-full max-w-[1100px] pb-36 lg:grid lg:min-h-dvh lg:grid-cols-[320px_390px] lg:items-center lg:justify-center lg:gap-16 lg:pb-0">
      {/* Mobile header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-background/95 px-2 backdrop-blur lg:hidden">
        <button type="button" onClick={props.onBackToInput} className="min-h-[48px] px-2 text-[15px] font-medium text-stone-700">
          ← Edit my words
        </button>
        <span className="px-2 text-sm text-stone-500">Draft saved</span>
      </header>

      {/* Desktop side panel */}
      <aside className="hidden lg:block">
        <button type="button" onClick={props.onBackToInput} className="min-h-[44px] text-[15px] font-medium text-stone-600 hover:text-stone-900">
          ← Edit my words
        </button>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[34px] font-extrabold leading-tight tracking-tight">Your store draft</h1>
        <p className="mt-1 text-sm text-stone-500">Saved on this device as you go.</p>
        <ul className="mt-6 space-y-3 text-[15px] leading-6 text-stone-700">
          <HowTo n={1}>Click any text to change it.</HowTo>
          <HowTo n={2}>Click a price to set your own.</HowTo>
          <HowTo n={3}>
            <b>New version</b> rewrites one block. You can undo it.
          </HowTo>
          <HowTo n={4}>Followers see this page without the editing bits.</HowTo>
        </ul>
        <div className="mt-8">{publish}</div>
        <button type="button" onClick={props.onRegenerateAll} disabled={props.busyBlock !== null} className="mt-3 min-h-[44px] w-full text-[15px] font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900 disabled:opacity-50">
          Redo the whole page
        </button>
      </aside>

      {/* The store: full width on phones, a phone frame on desktop */}
      <div className="frame-lg">
        <div className="phone-scroll">
          <p className="mx-4 mt-3 rounded-xl bg-white px-3 py-2 text-[14px] text-stone-600 shadow-sm lg:hidden">Tap any text to change it. Tap <b>New version</b> for a fresh take on a block.</p>
          <Storefront store={sf} theme={theme} edit={hooks} wantCounts={props.wantCounts} />
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-background/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-[480px] grid-cols-[auto_1fr] items-start gap-3">
          <button type="button" onClick={props.onRegenerateAll} disabled={props.busyBlock !== null} className="min-h-[52px] px-2 text-[15px] font-medium text-stone-600 underline underline-offset-4 disabled:opacity-50">
            Redo all
          </button>
          {publish}
        </div>
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

function HowTo(props: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-store-tint text-[13px] font-bold text-store">{props.n}</span>
      <span>{props.children}</span>
    </li>
  );
}
