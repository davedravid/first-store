"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Chip, CreatorInput, Storefront } from "@/lib/ai/schema";
import { generate, loadForEdit, publish, regenerate, type Interest, type RegenTarget, type UiError } from "@/lib/ui/api";
import { normalizeHandle } from "@/lib/ui/handle";
import { buildRationale } from "@/lib/ai/validators";
import { creatorRationale } from "@/lib/ui/pricing";
import { themeFor } from "@/lib/ui/theme";
import { publishWarnings } from "@/lib/ui/publish-check";
import { track } from "@/lib/ui/track";
import { clearSaved, emptyInput, loadSaved, save, type PriceOverride, type Saved, type Screen } from "@/lib/ui/storage";
import { ClarifyScreen } from "./ClarifyScreen";
import { Editor, type RegenOutcome } from "./Editor";
import { ErrorScreen } from "./ErrorScreen";
import { GeneratingScreen } from "./GeneratingScreen";
import { InputScreen, MAX_CHARS } from "./InputScreen";
import { PublishedScreen } from "./PublishedScreen";
import Link from "next/link";
import { ConfirmSheet, PrimaryButton, SecondaryButton, Sheet, Toast } from "./ui";

type Undo = { label: string; storefront: Storefront; prices: Record<string, PriceOverride>; edited: boolean };

function initial(): Saved {
  const s = loadSaved();
  if (!s) return { v: 1, screen: "input", input: emptyInput(), handleRaw: "", storefront: null, edited: false, prices: {}, clarify: null };
  // A refresh mid-request or on an error screen lands back on the right place with the words kept.
  const screen: Screen =
    s.screen === "published" && s.published && s.storefront ? "published" : s.screen === "editor" && s.storefront ? "editor" : s.screen === "clarify" && s.clarify ? "clarify" : "input";
  return { ...s, screen };
}

/** Re-apply prices the creator typed, after code re-priced the page during a regenerate. */
function applyPrices(input: CreatorInput, sf: Storefront, prices: Record<string, PriceOverride>): Storefront {
  const out: Storefront = { ...sf, products: sf.products.map((p) => (prices[p.id] ? { ...p, price_inr: prices[p.id].price } : p)) };
  out.products = out.products.map((p, i) => (prices[p.id] ? { ...p, price_rationale: creatorRationale(input, out, i) } : p));
  return out;
}

export default function App(props: { editSlug?: string }) {
  const [state, setState] = useState<Saved>(initial);
  const [interest, setInterest] = useState<Interest | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  // The edit token comes from the link (#k=...) or, on the creator's own phone, from the saved draft.
  const [editToken] = useState<string | null>(() => {
    if (!props.editSlug) return null;
    const saved = loadSaved()?.published;
    return new URLSearchParams(window.location.hash.slice(1)).get("k") || (saved?.slug === props.editSlug ? saved.token : null);
  });
  const [editLink, setEditLink] = useState<"loading" | "bad" | "ok" | null>(props.editSlug ? (editToken ? "loading" : "bad") : null);
  const [error, setError] = useState<{ kind: UiError; daily?: boolean } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busyBlock, setBusyBlock] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: Undo; retry?: () => void } | null>(null);
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

  // The private edit link (/e/<slug>#k=<token>): load the published store for its creator.
  useEffect(() => {
    if (!props.editSlug || !editToken) return;
    const slug = props.editSlug;
    const token = editToken;
    loadForEdit(slug, token).then((r) => {
      if (!r.ok) return setEditLink("bad");
      setInterest(r.interest);
      setJustPublished(false);
      setState({ v: 1, screen: "published", input: r.input, handleRaw: r.input.handle ?? "", storefront: r.storefront, edited: false, prices: {}, clarify: null, published: { slug, token, at: Date.now() } });
      setEditLink("ok");
    });
  }, [props.editSlug, editToken]);

  const refreshInterest = useCallback(async () => {
    const p = state.published;
    if (!p) return;
    const r = await loadForEdit(p.slug, p.token);
    if (r.ok) setInterest(r.interest);
  }, [state.published]);

  // Fresh "who wants what" numbers each time the live screen opens.
  const pubSlug = state.published?.slug;
  const pubToken = state.published?.token;
  useEffect(() => {
    if (state.screen !== "published" || !pubSlug || !pubToken) return;
    let live = true;
    loadForEdit(pubSlug, pubToken).then((r) => {
      if (live && r.ok) setInterest(r.interest);
    });
    return () => {
      live = false;
    };
  }, [state.screen, pubSlug, pubToken]);

  async function doPublish() {
    const sf = state.storefront;
    if (!sf || publishing) return;
    setPublishing(true);
    setToast(null);
    let r = await publish({ input: state.input, storefront: sf, slug: state.published?.slug, token: state.published?.token });
    // The saved token no longer matches (store gone): publish it as a new store instead of failing.
    if (!r.ok && r.kind === "bad_token") r = await publish({ input: state.input, storefront: sf });
    setPublishing(false);
    if (!r.ok) {
      const msg = r.kind === "offline" ? "You are offline. Your store is saved here; try again when you are connected." : r.kind === "busy" ? "Lots of people are publishing right now. Try again in a few minutes." : "We could not publish just now. Your store is saved here.";
      setToast({ message: msg, retry: doPublish });
      return;
    }
    const first = !state.published;
    setJustPublished(first);
    setState((s) => ({ ...s, screen: "published", published: { slug: r.slug, token: r.token, at: Date.now() }, edited: false }));
    if (!first) setToast({ message: "Your live page is updated." });
  }

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
    track("generate");

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
    if (data.status === "needs_more_info") {
      track("needs_more_info");
      setState((s) => ({ ...s, screen: "clarify", clarify: { question: data.question, suggestions: data.suggestions } }));
    }
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
    track("regenerate", state.published?.slug);
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
    setInterest(null);
    setState({ v: 1, screen: "input", input: emptyInput(), handleRaw: "", storefront: null, edited: false, prices: {}, clarify: null });
  };

  // One accent per store: from the finished store (topic, niche), else the creator's own words.
  const theme = themeFor(state.storefront, state.input);
  const loadingTheme = themeFor(null, state.input);

  if (editLink === "loading")
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] items-center justify-center px-6" aria-busy="true">
        <p className="text-base text-stone-600">Opening your store...</p>
      </main>
    );
  if (editLink === "bad")
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center px-6 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-extrabold tracking-tight">This edit link does not work</h1>
        <p className="mt-2 text-base leading-6 text-stone-600">Check that you copied the whole link, including the part after the #. Your public page is not affected.</p>
        <Link href="/" className="mt-6 flex min-h-[52px] items-center justify-center rounded-2xl bg-stone-900 px-5 text-[17px] font-semibold text-white">
          Make a new store
        </Link>
      </main>
    );

  return (
    <main className="w-full">
      {state.screen === "input" && (
        <InputScreen
          input={state.input}
          handleRaw={state.handleRaw}
          hint={hint}
          hasStore={Boolean(state.storefront)}
          canStartOver={Boolean(state.storefront || state.input.description)}
          onChange={(input, handleRaw) => {
            if (hint) setHint(null);
            setState((s) => ({ ...s, input, handleRaw: handleRaw ?? s.handleRaw }));
          }}
          onSubmit={submit}
          onBackToStore={() => go("editor")}
          onStartOver={() => setConfirm("startover")}
        />
      )}
      {state.screen === "generating" && (
        <GeneratingScreen
          theme={loadingTheme}
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
          theme={theme}
          prices={state.prices}
          busyBlock={busyBlock}
          onEdit={(sf) => {
            setState((s) => ({ ...s, storefront: sf, edited: true }));
            track("edit", state.published?.slug);
          }}
          published={state.published ? { slug: state.published.slug, hasChanges: state.edited } : null}
          publishing={publishing}
          wantCounts={interest?.counts}
          onPublish={() => {
            // Gentle, non-blocking: the creator's own edits are checked against the same rules, then they decide.
            const w = state.storefront ? publishWarnings(state.input, state.storefront) : [];
            if (w.length) setWarnings(w);
            else void doPublish();
          }}
          onShowLive={() => go("published")}
          onPrice={setPrice}
          onRegenerate={regen}
          onRegenerateAll={() => (state.edited ? setConfirm("redo") : redoAll())}
          onBackToInput={() => go("input")}
        />
      )}

      {state.screen === "published" && state.published && state.storefront && (
        <PublishedScreen
          published={state.published}
          storefront={state.storefront}
          theme={theme}
          interest={interest}
          justPublished={justPublished}
          onKeepEditing={() => go("editor")}
          onRefresh={refreshInterest}
        />
      )}

      <Sheet open={warnings !== null} title="A few things to check" onClose={() => setWarnings(null)}>
        <p className="text-[15px] leading-6 text-stone-600">Some of your edits break the rules we use for the AI&apos;s writing. It is your page, so you decide.</p>
        <ul className="mt-3 space-y-2">
          {(warnings ?? []).map((w) => (
            <li key={w} className="rounded-xl bg-amber-50 px-3 py-2 text-[14px] leading-5 text-amber-950">
              {w}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-3">
          <SecondaryButton onClick={() => setWarnings(null)}>Let me fix them</SecondaryButton>
          <PrimaryButton
            onClick={() => {
              setWarnings(null);
              void doPublish();
            }}
          >
            Publish anyway
          </PrimaryButton>
        </div>
      </Sheet>

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
        body={
          state.published
            ? "This clears your words and draft from this phone. Your published store stays live, but you will need your private edit link to change it again."
            : "This clears your words and your store draft from this phone. It cannot be undone."
        }
        confirm="Yes, clear everything"
        onConfirm={() => {
          setConfirm(null);
          startOver();
        }}
        onClose={() => setConfirm(null)}
      />
      {toast && (state.screen === "editor" || state.screen === "published") && (
        <Toast
          message={toast.message}
          actionLabel={toast.undo ? "Undo" : toast.retry ? "Try again" : undefined}
          onAction={() => (toast.undo ? undo(toast.undo) : toast.retry?.())}
          onDone={() => setToast(null)}
        />
      )}
    </main>
  );
}
