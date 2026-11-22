"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function PrimaryButton(props: { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; className?: string }) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`min-h-[52px] w-full rounded-2xl bg-stone-900 px-5 text-[17px] font-semibold text-white shadow-sm transition hover:bg-stone-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

export function SecondaryButton(props: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`min-h-[48px] w-full rounded-2xl border border-stone-300 bg-white px-5 text-base font-medium text-stone-800 active:bg-stone-50 disabled:opacity-50 ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

export function ChipButton(props: { children: ReactNode; selected?: boolean; onClick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={props.selected}
      onClick={props.onClick}
      className={`min-h-[44px] rounded-full border px-4 text-[15px] font-medium transition ${
        props.selected
          ? "border-stone-900 bg-stone-900 text-white"
          : props.muted
            ? "border-stone-200 bg-stone-50 text-stone-400"
            : "border-stone-300 bg-white text-stone-800 active:bg-stone-100"
      }`}
    >
      {props.children}
    </button>
  );
}

/** Bottom sheet with a backdrop. Closes on backdrop tap or Escape. */
export function Sheet(props: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={props.title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-stone-900/40" onClick={props.onClose} />
      <div className="relative w-full max-w-[480px] rounded-t-3xl bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <button type="button" onClick={props.onClose} className="min-h-[44px] min-w-[44px] text-base text-stone-500">
            Close
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function ConfirmSheet(props: { open: boolean; title: string; body: string; confirm: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={props.open} title={props.title} onClose={props.onClose}>
      <p className="mb-5 text-base leading-6 text-stone-600">{props.body}</p>
      <div className="flex flex-col gap-3">
        <PrimaryButton onClick={props.onConfirm}>{props.confirm}</PrimaryButton>
        <SecondaryButton onClick={props.onClose}>Keep what I have</SecondaryButton>
      </div>
    </Sheet>
  );
}

export function Toast(props: { message: string; actionLabel?: string; onAction?: () => void; onDone: () => void }) {
  const done = useRef(props.onDone);
  useEffect(() => {
    done.current = props.onDone;
  });
  useEffect(() => {
    const t = setTimeout(() => done.current(), 7000);
    return () => clearTimeout(t);
  }, [props.message]);
  return (
    <div role="status" className="fixed inset-x-0 bottom-[92px] z-30 flex justify-center px-4">
      <div className="flex w-full max-w-[440px] items-center justify-between gap-3 rounded-2xl bg-stone-900 px-4 py-2 text-[15px] text-white shadow-lg">
        <span className="py-2">{props.message}</span>
        {props.actionLabel && (
          <button type="button" onClick={props.onAction} className="min-h-[44px] px-2 font-semibold text-orange-300">
            {props.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Tap-to-edit text. Shows the text; one tap turns it into a box with the same look.
 * Empty edits are ignored, so a block can never be blanked by mistake.
 */
export function Editable(props: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  className?: string;
  maxLength?: number;
  singleLine?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const align = props.className?.includes("text-center") ? "" : "text-left";
  const base = `w-full rounded-lg ${align} ${props.className ?? ""}`;
  if (editing)
    return (
      <textarea
        aria-label={props.label}
        autoFocus
        defaultValue={props.value}
        maxLength={props.maxLength}
        rows={props.singleLine ? 1 : Math.max(2, Math.ceil(props.value.length / 34))}
        onKeyDown={(e) => {
          if (props.singleLine && e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          const v = e.target.value.replace(/\s+\n/g, "\n").trim();
          if (v && v !== props.value) props.onChange(v);
          setEditing(false);
        }}
        className={`autogrow ${base} resize-none border border-store bg-white px-2 py-1 !text-[16px] outline-none ring-2 ring-store/20`}
      />
    );
  return (
    <button
      type="button"
      aria-label={`Edit ${props.label}`}
      onClick={() => setEditing(true)}
      className={`editable ${base} -mx-1.5 block px-1.5 py-0.5`}
      style={{ width: "calc(100% + 12px)" }}
    >
      {props.value}
      <span aria-hidden="true" className="pencil flex h-6 w-6 items-center justify-center rounded-full bg-store text-white shadow">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
    </button>
  );
}

export function RegenIcon(props: { onClick: () => void; label: string; onDark?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={props.label}
      className={`flex min-h-[36px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold transition active:scale-95 ${
        props.onDark ? "bg-white/90 text-store-deep shadow-sm" : "border border-stone-200 bg-white text-stone-700"
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 4v5h-5" />
      </svg>
      New version
    </button>
  );
}
