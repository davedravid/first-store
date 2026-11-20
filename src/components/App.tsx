"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Chip, CreatorInput, Storefront } from "@/lib/ai/schema";
import { generate, regenerate, type RegenTarget, type UiError } from "@/lib/ui/api";
import { normalizeHandle } from "@/lib/ui/handle";
import { buildRationale } from "@/lib/ai/validators";
import { creatorRationale } from "@/lib/ui/pricing";
import { clearSaved, emptyInput, loadSaved, save, type PriceOverride, type Saved, type Screen } from "@/lib/ui/storage";
import { ClarifyScreen } from "./ClarifyScreen";
import { Editor, type RegenOutcome } from "./Editor";
import { ErrorScreen } from "./ErrorScreen";
import { GeneratingScreen } from "./GeneratingScreen";
import { InputScreen, MAX_CHARS } from "./InputScreen";
import { ConfirmSheet, Toast } from "./ui";

type Undo = { label: string; storefront: Storefront; prices: Record<string, PriceOverride>; edited: boolean };

function initial(): Saved {
  const s = loadSaved();
  if (!s) return { v: 1, screen: "input", input: emptyInput(), handleRaw: "", storefront: null, edited: false, prices: {}, clarify: null };
  // A refresh mid-request or on an error screen lands back on the right place with the words kept.
  const screen: Screen = s.screen === "editor" && s.storefront ? "editor" : s.screen === "clarify" && s.clarify ? "clarify" : "input";
  return { ...s, screen };
}

/** Re-apply prices the creator typed, after code re-priced the page during a regenerate. */
function applyPrices(input: CreatorInput, sf: Storefront, prices: Record<string, PriceOverride>): Storefront {
  const out: Storefront = { ...sf, products: sf.products.map((p) => (prices[p.id] ? { ...p, price_inr: prices[p.id].price } : p)) };
  out.products = out.products.map((p, i) => (prices[p.id] ? { ...p, price_rationale: creatorRationale(input, out, i) } : p));
  return out;
}

export default function App() {
  const [state, setState] = useState<Saved>(initial);
  const [error, setError] = useState<{ kind: UiError; daily?: boolean } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busyBlock, setBusyBlock] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: Undo } | null>(null);
  const [confirm, setConfirm] = useState<"redo" | "startover" | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Autosave on every change.
  useEffect(() => {
    save(state);
  }, [state]);

  // Every new screen starts at the top (otherwise the loading hint or the page header can be scrolled out of view).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.screen]);

  // Phone Back button: from any screen, go back to the words instead of leaving the site.
  useEffect(() => {
    if (state.screen !== "input" && window.history.state?.fs !== state.screen) window.history.pushState({ fs: state.screen }, "");
  }, [state.screen]);
  useEffect(() => {
    const onPop = () => {
      abort.current?.abort();
      setError(null);
      setState((s) => ({ ...s, screen: "input" }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = (screen: Screen) => setState((s) => ({ ...s, screen }));

  const run = useCallback(async (input: CreatorInput, undoFrom?: Undo) => {
    if (!input.description.trim()) {
      setHint("Tell us a little about what you do first.");
      return go("input");
    }
    if (input.description.length > MAX_CHARS || (input.instagram_bio ?? "").length > MAX_CHARS) {
      setHint(`That's a bit long. Please keep each box under ${MAX_CHARS} characters.`);
      return go("input");
    }
    setHint(null);
    setError(null);
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState((s) => ({ ...s, input, screen: "generating" }));

    let r;
    try {
      r = await generate(input, ctrl.signal);
    } catch {
      return; // cancelled by the creator
    }
    if (ctrl.signal.aborted) return;
    if (!r.ok) {
      if (r.kind === "input") {
        setHint(r.code === "TOO_LONG" ? `That's a bit long. Please keep each box under ${r.limit ?? MAX_CHARS} characters.` : "Tell us a little about what you do first.");
        return go("input");
      }
      setError({ kind: r.kind, daily: r.daily });
      return go("error");
    }
    const data = r.data;
    if (data.status === "needs_more_info") setState((s) => ({ ...s, screen: "clarify", clarify: { question: data.question, suggestions: data.suggestions } }));
    else {
      setState((s) => ({ ...s, screen: "editor", storefront: data.storefront, edited: false, prices: {}, clarify: null }));
      if (undoFrom) setToast({ message: "Here is a fresh page.", undo: undoFrom });
    }
  }, []);

  const submit = () => {
    const input = { ...state.input, handle: normalizeHandle(state.handleRaw) };
    run(input);
  };

  const answer = (text: string) => {
    const d = state.input.description.trim();
    const description = d ? `${d}${/[.!?]$/.test(d) ? "" : "."} ${text}` : text;
    run({ ...state.input, description });
  };

  async function regen(target: RegenTarget, chip: Chip): Promise<RegenOutcome> {
    const sf = state.storefront;
    if (!sf) return { ok: false, kind: "broken" };
    const id = target.kind === "about" ? "about" : target.productId;
    setBusyBlock(id);
    const r = await regenerate({ input: state.input, storefront: sf, target, chip });
    setBusyBlock(null);
    if (!r.ok) return { ok: false, kind: r.kind === "input" ? "broken" : r.kind };

    const undo: Undo = { label: "", storefront: sf, prices: state.prices, edited: state.edited };
    // A price the creator typed survives a regenerate, unless they asked to move or redo that product's price.
    const prices = { ...state.prices };
    if (target.kind === "product" && (chip === "cheaper" || chip === "more_premium" || chip === "try_another")) delete prices[target.productId];
    const next = applyPrices(state.input, { ...r.data.storefront, creator: { ...r.data.storefront.creator, display_name: sf.creator.display_name } }, prices);
    setState((s) => ({ ...s, storefront: next, prices }));
    setToast({ message: target.kind === "about" ? "Your intro is updated." : "Your product is updated.", undo });
    return { ok: true };
  }

  const redoAll = () => {
    setConfirm(null);
    setToast(null);
    run(state.input, state.storefront ? { label: "", storefront: state.storefront, prices: state.prices, edited: state.edited } : undefined);
  };

  const undo = (u: Undo) => {
    setState((s) => ({ ...s, screen: "editor", storefront: u.storefront, prices: u.prices, edited: u.edited }));
    setToast({ message: "Undone." });
  };

  const setPrice = (productId: string, price: number | null) => {
    setState((s) => {
      if (!s.storefront) return s;
      const prices = { ...s.prices };
      const current = s.storefront.products.find((p) => p.id === productId);
      if (!current) return s;
      let sf = s.storefront;
      if (price === null) {
        const o = prices[productId];
        delete prices[productId];
        if (o) sf = { ...sf, products: sf.products.map((p) => (p.id === productId ? { ...p, price_inr: o.suggested } : p)) };
        // Back to our price: our own "why this price" wording again.
        sf = { ...sf, products: sf.products.map((p, i) => (p.id === productId ? { ...p, price_rationale: buildRationale(s.input, sf, i) } : p)) };
        return { ...s, storefront: sf, prices, edited: true };
      }
      prices[productId] = { price, suggested: prices[productId]?.suggested ?? current.price_inr };
      return { ...s, storefront: applyPrices(s.input, sf, prices), prices, edited: true };
    });
  };

  const startOver = () => {
    clearSaved();
    setState({ v: 1, screen: "input", input: emptyInput(), handleRaw: "", storefront: null, edited: false, prices: {}, clarify: null });
  };

  return (
    <main className="mx-auto w-full max-w-[480px]">
      {state.screen === "input" && (
        <>
          <InputScreen
            input={state.input}
            handleRaw={state.handleRaw}
            hint={hint}
            hasStore={Boolean(state.storefront)}
            busy={false}
            onChange={(input, handleRaw) => {
              if (hint) setHint(null);
              setState((s) => ({ ...s, input, handleRaw: handleRaw ?? s.handleRaw }));
            }}
            onSubmit={submit}
            onBackToStore={() => go("editor")}
          />
          {(state.storefront || state.input.description) && (
            <div className="-mt-28 mb-32 px-4 text-center">
              <button type="button" onClick={() => setConfirm("startover")} className="min-h-[44px] text-sm text-stone-500 underline">
                Start over with a blank page
              </button>
            </div>
          )}
        </>
      )}
      {state.screen === "generating" && (
        <GeneratingScreen
          onCancel={() => {
            abort.current?.abort();
            go("input");
          }}
        />
      )}
      {state.screen === "clarify" && state.clarify && <ClarifyScreen question={state.clarify.question} suggestions={state.clarify.suggestions} onAnswer={answer} onBack={() => go("input")} />}
      {state.screen === "error" && error && (
        <ErrorScreen
          kind={error.kind}
          daily={error.daily}
          onRetry={() => run(state.input)}
          onEdit={() => {
            setError(null);
            go("input");
          }}
        />
      )}
      {state.screen === "error" && !error && <ErrorScreen kind="broken" onRetry={() => run(state.input)} onEdit={() => go("input")} />}
      {state.screen === "editor" && state.storefront && (
        <Editor
          input={state.input}
          storefront={state.storefront}
          prices={state.prices}
          busyBlock={busyBlock}
          onEdit={(sf) => setState((s) => ({ ...s, storefront: sf, edited: true }))}
          onPrice={setPrice}
          onRegenerate={regen}
          onRegenerateAll={() => (state.edited ? setConfirm("redo") : redoAll())}
          onBackToInput={() => go("input")}
        />
      )}

      <ConfirmSheet
        open={confirm === "redo"}
        title="Redo the whole page?"
        body="You have made changes. Redoing writes a fresh page and prices, and your edits will be replaced. You can undo it right after."
        confirm="Yes, redo everything"
        onConfirm={redoAll}
        onClose={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === "startover"}
        title="Start over?"
        body="This clears your words and your store draft from this phone. It cannot be undone."
        confirm="Yes, clear everything"
        onConfirm={() => {
          setConfirm(null);
          startOver();
        }}
        onClose={() => setConfirm(null)}
      />
      {toast && state.screen === "editor" && (
        <Toast message={toast.message} actionLabel={toast.undo ? "Undo" : undefined} onAction={() => toast.undo && undo(toast.undo)} onDone={() => setToast(null)} />
      )}
    </main>
  );
}
