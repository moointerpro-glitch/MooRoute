"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { beDate } from "@/lib/trip-format";
import { parseThaiDate } from "@/lib/date-input";
import { DateInput } from "./date-time-inputs";

type Option = { id: string; name: string; code?: string };
export type FilterValues = { q: string; status: string; branch: string; category: string; date: string; trip: string; mine: boolean };
type Props = {
  initial: FilterValues; branches: Option[]; categories: Option[];
  /** History chooses a finished status here; tracking chooses it with the status chips above the list. */
  statusOptions?: { value: string; label: string }[];
  label: string;
};

/** How long typing must pause before the list is searched again. */
const TYPING_PAUSE_MS = 400;

/**
 * D236: the list follows the filters without a search button. Choices apply at once; typed text applies after a
 * short pause (or immediately on Enter). The address keeps every filter, so a result can be bookmarked or shared,
 * and the server still validates each value.
 */
export function ConsignmentFilters({ initial, branches, categories, statusOptions, label }: Props) {
  const router = useRouter(), pathname = usePathname();
  const [values, setValues] = useState(initial);
  const [dateText, setDateText] = useState(initial.date ? beDate(initial.date) : "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | null>(null), applied = useRef(JSON.stringify(initial));
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  // The status chips are links: when one is followed, the form adopts that status without losing typed text.
  useEffect(() => { setValues((v) => v.status === initial.status ? v : { ...v, status: initial.status }); }, [initial.status]);

  function go(next: FilterValues) {
    const key = JSON.stringify(next);
    if (key === applied.current) return;
    applied.current = key;
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.status) params.set("status", next.status);
    if (next.branch) params.set("branch", next.branch);
    if (next.category) params.set("category", next.category);
    if (next.date) params.set("date", next.date);
    if (next.trip.trim()) params.set("trip", next.trip.trim());
    if (next.mine) params.set("mine", "1");
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }
  /** A choice (select, checkbox, date) applies immediately; typing waits for a pause. */
  function change(patch: Partial<FilterValues>, typing = false) {
    const next = { ...values, ...patch };
    setValues(next);
    if (timer.current) window.clearTimeout(timer.current);
    if (typing) timer.current = window.setTimeout(() => go(next), TYPING_PAUSE_MS); else go(next);
  }
  function commitDate(text: string) {
    const iso = text.trim() ? parseThaiDate(text) : "";
    if (iso === null) return; // an unfinished or invalid date is left for the person to correct; the field marks it
    if (iso !== values.date) change({ date: iso });
  }
  function clear() {
    if (timer.current) window.clearTimeout(timer.current);
    const empty: FilterValues = { q: "", status: statusOptions ? "" : values.status, branch: "", category: "", date: "", trip: "", mine: false };
    setValues(empty); setDateText(""); go(empty);
  }
  const active = !!(values.q || values.branch || values.category || values.date || values.trip || values.mine || (statusOptions && values.status));

  return <form className="history-filters" role="search" aria-label={label} onSubmit={(e) => { e.preventDefault(); if (timer.current) window.clearTimeout(timer.current); go(values); }}>
    <label className="filter-search">เลขที่ หรือสิ่งที่ฝาก<span className="search-input"><Search size={17} aria-hidden="true" /><input value={values.q} maxLength={100} placeholder="พิมพ์เพื่อค้นหา เช่น FS-2569 หรือ โปสเตอร์" onChange={(e) => change({ q: e.target.value }, true)} autoComplete="off" />
      {values.q && <button type="button" className="clear-button" aria-label="ล้างคำค้นหา" onClick={() => change({ q: "" })}><X size={16} aria-hidden="true" /></button>}</span></label>
    {statusOptions && <label>สถานะ<select value={values.status} onChange={(e) => change({ status: e.target.value })}><option value="">ทุกสถานะ</option>{statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>}
    <label>สาขาปลายทาง<select value={values.branch} onChange={(e) => change({ branch: e.target.value })}><option value="">ทุกสาขา</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</select></label>
    <label>หมวดสิ่งของ<select value={values.category} onChange={(e) => change({ category: e.target.value })}><option value="">ทุกหมวด</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>วันที่ส่ง (พ.ศ.)<DateInput value={dateText} onChange={(text) => { setDateText(text); if (!text.trim()) commitDate(""); }} onCommit={commitDate} onPick={(iso) => change({ date: iso })} /></label>
    <label>รหัสรอบรถ<input value={values.trip} maxLength={64} onChange={(e) => change({ trip: e.target.value }, true)} autoComplete="off" /></label>
    <label className="checkbox-label"><input type="checkbox" checked={values.mine} onChange={(e) => change({ mine: e.target.checked })} />เฉพาะรายการของฉัน</label>
    <div className="filter-actions">
      <span className="filter-status" role="status" aria-live="polite">{pending ? <><Loader2 size={15} aria-hidden="true" className="spin" />กำลังค้นหา…</> : "ผลลัพธ์อัปเดตอัตโนมัติ"}</span>
      <button type="button" className="secondary-button" disabled={!active} onClick={clear}>ล้างตัวกรอง</button>
    </div>
  </form>;
}
