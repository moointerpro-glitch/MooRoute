"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { RefreshCw } from "lucide-react";

/** Server renders this browser tab has already shown. A render seen twice came from the back/forward cache. */
const shown = new Set<number>();

/**
 * D237: keeps a work list in step with the workflow without anyone reloading the page.
 * The server data is read again when the page comes back from the back/forward cache (which would otherwise
 * show the list as it was), when the tab or window becomes active again, and, with `intervalMs`, on a timer
 * while the tab is visible. It only re-reads; it never changes anything.
 * `renderedAt` identifies one server render; it is compared with itself, never with this device's clock.
 */
export function AutoRefresh({ renderedAt, renderedLabel, intervalMs, compact = false }: { renderedAt: number; renderedLabel: string; intervalMs?: number; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const last = useRef(0), checked = useRef<number | null>(null);
  const refresh = useCallback((force = false) => {
    // A burst of focus and visibility events counts once.
    if (!force && Date.now() - last.current < 3000) return;
    last.current = Date.now();
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (checked.current === renderedAt) return; // the same effect running twice in development
    checked.current = renderedAt;
    if (shown.has(renderedAt)) refresh(true); else shown.add(renderedAt);
  }, [renderedAt, refresh]);
  useEffect(() => {
    const visible = () => { if (!document.hidden) refresh(); };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) refresh(true); };
    window.addEventListener("focus", visible); document.addEventListener("visibilitychange", visible); window.addEventListener("pageshow", restored);
    const timer = intervalMs ? window.setInterval(() => { if (!document.hidden) refresh(); }, intervalMs) : null;
    return () => { window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); window.removeEventListener("pageshow", restored); if (timer) window.clearInterval(timer); };
  }, [intervalMs, refresh]);

  return <p className={compact ? "auto-refresh compact" : "auto-refresh"}>
    <span role="status" aria-live="off">{pending ? "กำลังอัปเดต…" : `อัปเดตล่าสุด ${renderedLabel} น.`}{intervalMs ? ` · อัปเดตเองทุก ${Math.round(intervalMs / 1000)} วินาที` : ""}</span>
    <button type="button" className="link-button" disabled={pending} onClick={() => refresh(true)}><RefreshCw size={14} aria-hidden="true" className={pending ? "spin" : undefined} />อัปเดตตอนนี้</button>
  </p>;
}
