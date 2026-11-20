import type { FunnelEvent } from "@/lib/stores";

/** Fire-and-forget funnel event. Never blocks or breaks the page. */
export function track(event: FunnelEvent, slug?: string) {
  try {
    const body = JSON.stringify({ event, slug });
    if (navigator.sendBeacon?.(new URL("/api/event", location.origin), new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/event", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {}
}
