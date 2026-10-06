"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Info, MapPin, RefreshCw, Route, Search, SlidersHorizontal, X } from "lucide-react";
import type { SearchResult } from "@/server/services/trip-search";
import { TripResults } from "./trip-results";
import { beDate, isoFromBe, shiftDate, thaiLongDate, timeBasisLabels, tripKindLabels } from "@/lib/trip-format";

type Mode = "branch" | "time" | "range";
type Basis = "departure" | "loading";
type Sort = "time_asc" | "time_desc";
export type SearchOptions = { categories: { id: string; code: string; name: string }[]; kinds: string[]; canConsign: boolean };
type Query = { date: string; mode: Mode; branch: string | null; q: string; times: number[]; from: string; to: string; basis: Basis; rounds: number[]; categories: string[]; kinds: string[]; sort: Sort; page: number };
type Candidate = { id: string; code: string; name: string; alias: string | null };

const modes = [
  { id: "branch" as const, title: "ค้นหาจากสาขา", icon: MapPin, heading: "ค้นหาจากชื่อสาขา", description: "พิมพ์ชื่อสาขา รหัสสาขา หรือชื่อเรียกอื่นที่ตรวจสอบแล้ว เพื่อดูรอบรถที่แวะส่งสาขานั้น" },
  { id: "time" as const, title: "เลือกเวลา", icon: Clock3, heading: "เลือกเวลาที่ต้องการ", description: "เลือกได้หนึ่งหรือหลายเวลา ระบบจะแสดงรอบรถที่ตรงกับเวลาใดเวลาหนึ่ง" },
  { id: "range" as const, title: "เลือกช่วงเวลา", icon: CalendarDays, heading: "เลือกช่วงเวลาที่ต้องการ", description: "เลือกเวลาเริ่มต้นและสิ้นสุด เพื่อดูรอบรถที่ให้บริการในช่วงเวลานั้น" },
];
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const minuteOf = (text: string) => /^\d{2}:\d{2}$/.test(text) ? Number(text.slice(0, 2)) * 60 + Number(text.slice(3)) : null;
const ids = (text: string | undefined) => (text ?? "").split(",").map((v) => v.trim()).filter(Boolean);

function initialQuery(params: Record<string, string | undefined>, today: string, options: SearchOptions): Query {
  const mode = (["branch", "time", "range"] as const).find((m) => m === params.mode) ?? "branch";
  const kinds = ids(params.kinds).filter((k) => options.kinds.includes(k));
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : today, mode,
    branch: params.branch && /^[A-Za-z0-9_-]{1,36}$/.test(params.branch) ? params.branch : null, q: (params.q ?? "").slice(0, 100),
    times: ids(params.times).map(Number).filter((n) => Number.isInteger(n) && n >= -1440 && n <= 2879),
    from: minuteOf(params.from ?? "") !== null ? params.from! : "", to: minuteOf(params.to ?? "") !== null ? params.to! : "",
    basis: params.basis === "loading" ? "loading" : "departure",
    rounds: ids(params.rounds).map(Number).filter((n) => [1, 2, 3].includes(n)),
    categories: ids(params.categories).filter((id) => options.categories.some((c) => c.id === id)),
    kinds: kinds.length ? kinds : ["BRANCH_DELIVERY"], sort: params.sort === "time_desc" ? "time_desc" : "time_asc",
    page: Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1),
  };
}
function toParams(q: Query) {
  const p = new URLSearchParams({ date: q.date, mode: q.mode });
  if (q.mode === "branch") { if (q.branch) p.set("branch", q.branch); else if (q.q) p.set("q", q.q); }
  if (q.mode === "time" && q.times.length) p.set("times", q.times.join(","));
  if (q.mode === "range" && q.from && q.to) { p.set("from", q.from); p.set("to", q.to); }
  if (q.mode !== "branch" || q.basis !== "departure") p.set("basis", q.basis);
  if (q.rounds.length) p.set("rounds", q.rounds.join(","));
  if (q.categories.length) p.set("categories", q.categories.join(","));
  if (q.kinds.join(",") !== "BRANCH_DELIVERY") p.set("kinds", q.kinds.join(","));
  if (q.sort !== "time_asc") p.set("sort", q.sort);
  if (q.page > 1) p.set("page", String(q.page));
  return p;
}
function toggle<T>(list: T[], value: T) { return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]; }

type Status = { state: "loading" } | { state: "error"; message: string; unauthenticated: boolean } | { state: "ready" };

export function TripSearch({ today, options, params }: { today: string; options: SearchOptions; params: Record<string, string | undefined> }) {
  const [query, setQuery] = useState(() => initialQuery(params, today, options));
  const [result, setResult] = useState<SearchResult | null>(null);
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [dateText, setDateText] = useState(() => beDate(query.date));
  const [dateError, setDateError] = useState("");
  const [branchText, setBranchText] = useState(query.q);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [suggestions, setSuggestions] = useState<Candidate[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [activeOption, setActiveOption] = useState(-1);
  const [rangeDraft, setRangeDraft] = useState({ from: query.from, to: query.to });
  const [rangeError, setRangeError] = useState("");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const uid = useId(), listId = `${uid}-branches`;
  const update = useCallback((change: Partial<Query>) => setQuery((q) => ({ ...q, page: 1, ...change })), []);

  useEffect(() => {
    const controller = new AbortController(), search = toParams(query);
    window.history.replaceState(null, "", `?${search.toString()}`);
    setStatus({ state: "loading" });
    fetch(`/api/search?${search.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        // A newer search can abort this one while its body is still being read. A superseded response
        // must not touch the state: clearing the result would unmount the filters and drop keyboard focus.
        if (controller.signal.aborted) return;
        if (!response.ok || !data) { setStatus({ state: "error", message: data?.message ?? "ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง", unauthenticated: response.status === 401 }); return; }
        setResult(data as SearchResult); setStatus({ state: "ready" });
      })
      .catch((error: unknown) => { if ((error as Error)?.name !== "AbortError") setStatus({ state: "error", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบเครือข่ายแล้วลองอีกครั้ง", unauthenticated: false }); });
    return () => controller.abort();
  }, [query, attempt]);

  // Resolve the selected branch label when the page opens with ?branch=.
  useEffect(() => {
    const branch = result?.resolution.branch;
    if (branch && query.branch === branch.id && selected?.id !== branch.id) {
      setSelected({ ...branch, alias: null }); setBranchText(`${branch.name} (${branch.code})`);
    }
  }, [result, query.branch, selected]);

  useEffect(() => {
    const text = branchText.trim();
    if (!text || (selected && branchText === `${selected.name} (${selected.code})`)) { setSuggestions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/search/branches?q=${encodeURIComponent(text)}`, { cache: "no-store", signal: controller.signal })
        .then((r) => r.ok ? r.json() : { candidates: [] }).then((data) => { setSuggestions(data.candidates ?? []); setActiveOption(-1); })
        .catch(() => {});
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [branchText, selected]);

  const modeIndex = modes.findIndex((m) => m.id === query.mode), mode = modes[modeIndex];
  function navigateTabs(event: KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: (index + 1) % 3, ArrowLeft: (index + 2) % 3, Home: 0, End: 2 };
    if (!(event.key in keys)) return;
    event.preventDefault(); update({ mode: modes[keys[event.key]].id }); tabs.current[keys[event.key]]?.focus();
  }
  function applyDate(iso: string) { setDateText(beDate(iso)); setDateError(""); update({ date: iso, times: [] }); }
  function commitDateText() {
    const iso = isoFromBe(dateText);
    if (!iso) { setDateError("กรุณาระบุวันที่เป็น วัน/เดือน/ปี พ.ศ. เช่น " + beDate(today)); return; }
    if (iso !== query.date) applyDate(iso); else setDateError("");
  }
  function chooseBranch(candidate: Candidate) {
    setSelected(candidate); setBranchText(`${candidate.name} (${candidate.code})`); setListOpen(false); setSuggestions([]);
    update({ mode: "branch", branch: candidate.id, q: "" });
  }
  function submitBranch() {
    if (listOpen && activeOption >= 0 && suggestions[activeOption]) { chooseBranch(suggestions[activeOption]); return; }
    setListOpen(false);
    if (selected && branchText === `${selected.name} (${selected.code})`) update({ branch: selected.id, q: "" });
    else { setSelected(null); update({ branch: null, q: branchText.trim() }); }
  }
  function clearBranch() { setSelected(null); setBranchText(""); setSuggestions([]); update({ branch: null, q: "" }); }
  function onBranchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setListOpen(true); setActiveOption((i) => (i + 1) % suggestions.length); }
    else if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setListOpen(true); setActiveOption((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
    else if (event.key === "Enter") { event.preventDefault(); submitBranch(); }
    else if (event.key === "Escape") setListOpen(false);
  }
  function submitRange() {
    const from = minuteOf(rangeDraft.from), to = minuteOf(rangeDraft.to);
    if (from === null || to === null) { setRangeError("กรุณาเลือกทั้งเวลาเริ่มต้นและเวลาสิ้นสุด"); return; }
    if (to < from) { setRangeError("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่มต้น ระบบยังไม่รองรับช่วงเวลาข้ามวัน"); return; }
    setRangeError(""); update({ mode: "range", from: rangeDraft.from, to: rangeDraft.to });
  }
  function clearAll() {
    setSelected(null); setBranchText(""); setRangeDraft({ from: "", to: "" }); setRangeError("");
    update({ branch: null, q: "", times: [], from: "", to: "", rounds: [], categories: [], kinds: ["BRANCH_DELIVERY"] });
  }

  const facets = result?.facets, span = facets?.span;
  const rangeOptions = useMemo(() => {
    const values = new Set<number>([...Array.from({ length: 48 }, (_, i) => i * 30), 1439, ...(facets?.times ?? []).filter((t) => t.offset >= 0 && t.offset < 1440).map((t) => t.offset)]);
    for (const v of [rangeDraft.from, rangeDraft.to]) { const m = minuteOf(v); if (m !== null) values.add(m); }
    return [...values].sort((a, b) => a - b).map(clock);
  }, [facets, rangeDraft]);
  const basisLabel = timeBasisLabels[query.basis];
  const showing = result && result.total ? `${(result.page - 1) * result.pageSize + 1}–${Math.min(result.total, result.page * result.pageSize)}` : "0";
  const filterText = [
    query.mode === "branch" && result?.resolution.branch ? `สาขา “${result.resolution.branch.name}”` : query.mode === "branch" && query.q ? `คำค้น “${query.q}”` : null,
    query.mode === "time" && query.times.length ? `${basisLabel} ${query.times.map((t) => facets?.times.find((f) => f.offset === t)?.label ?? clock(((t % 1440) + 1440) % 1440)).join(", ")}` : null,
    query.mode === "range" && query.from ? `${basisLabel} ${query.from}–${query.to} น.` : null,
  ].filter(Boolean).join(" · ");
  const busy = status.state === "loading";

  const basisSelect = <div className="filter time-basis"><label htmlFor={`${uid}-basis`}>ประเภทเวลาที่ใช้ค้นหา</label><div className="select-wrap">
    <select id={`${uid}-basis`} value={query.basis} onChange={(e) => update({ basis: e.target.value as Basis, times: [] })}>
      <option value="departure">เวลาออกรถ</option><option value="loading">เวลาเริ่มขึ้นของ</option>
    </select><ChevronDown size={16} aria-hidden="true" /></div>
    <p className="field-hint">เวลาเริ่มขึ้นของและเวลาออกรถเป็นคนละเวลา</p></div>;

  return <div className="container home-content">
    <section className="hero" aria-labelledby="page-title">
      <div><div className="eyebrow"><span />ทุกเส้นทาง เพื่อทุกสาขา</div><h1 id="page-title">ค้นหาเส้นทางเดินรถ <span>หมูอินเตอร์</span></h1><p>ค้นหาสายรถตามสาขา เวลา และช่วงเวลา</p></div>
      <div className="today-card"><CalendarDays size={20} aria-hidden="true" /><div><span>วันที่ให้บริการ</span><time dateTime={query.date}>{thaiLongDate(query.date)}</time></div></div>
    </section>
    <div className="metrics" aria-label="ข้อมูลรอบรถของวันที่เลือก" aria-busy={busy}>
      <div className="metric"><span className="metric-icon"><Route aria-hidden="true" /></span><div>
        <div className="metric-value" data-testid="metric-trips">{facets ? <>{facets.tripCount.toLocaleString("th-TH")} <span>รอบรถ</span></> : "—"}</div>
        <h2>รอบรถที่เผยแพร่</h2><p>{result && !result.published ? "ยังไม่มีแผนที่เผยแพร่ในวันนี้" : "ตามวันที่ รอบ หมวดสินค้า และสิทธิ์ของคุณ"}</p></div></div>
      <div className="metric"><span className="metric-icon"><Clock3 aria-hidden="true" /></span><div>
        <div className="metric-value" data-testid="metric-span">{span ? `${span.fromLabel} – ${span.toLabel}` : "—"}</div>
        <h2>ช่วง{basisLabel}</h2><p>{facets?.unknownCount ? `ยังไม่ระบุ${basisLabel} ${facets.unknownCount} รอบ` : "คำนวณจากรอบรถที่เผยแพร่จริง"}</p></div></div>
      <div className="metric"><span className="metric-icon"><Search aria-hidden="true" /></span><div>
        <div className="metric-value">3 <span>รูปแบบ</span></div><h2>รองรับการค้นหา</h2><p>ค้นหาจากสาขา / เลือกเวลา / เลือกช่วงเวลา</p></div></div>
    </div>

    <section className="search-card" aria-label="ค้นหารอบรถ">
      <div className="search-card-top"><div className="section-heading"><SlidersHorizontal size={19} aria-hidden="true" /><h2>ค้นหารอบรถของคุณ</h2></div><span className="muted small">ตัวกรองต่างกลุ่มต้องตรงทุกข้อ ส่วนตัวเลือกในกลุ่มเดียวกันตรงข้อใดข้อหนึ่งก็ได้</span></div>
      <div className="common-filters search-filters">
        <div className="filter">
          <label htmlFor={`${uid}-date`}>วันที่ให้บริการ (พ.ศ.)</label>
          <div className="date-control">
            <button type="button" className="icon-button" aria-label="วันก่อนหน้า" onClick={() => applyDate(shiftDate(query.date, -1))}><ChevronLeft size={18} aria-hidden="true" /></button>
            <input id={`${uid}-date`} value={dateText} inputMode="numeric" placeholder="วว/ดด/ปปปป" aria-describedby={`${uid}-date-help`} aria-invalid={!!dateError}
              onChange={(e) => setDateText(e.target.value)} onBlur={commitDateText} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDateText(); } }} />
            <button type="button" className="icon-button" aria-label="วันถัดไป" onClick={() => applyDate(shiftDate(query.date, 1))}><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
          <p id={`${uid}-date-help`} className={dateError ? "field-error" : "field-hint"} role={dateError ? "alert" : undefined}>{dateError || <>{thaiLongDate(query.date)}{query.date !== today && <> · <button type="button" className="link-button" onClick={() => applyDate(today)}>กลับไปวันนี้</button></>}</>}</p>
        </div>
        <fieldset className="filter chip-field"><legend>รอบ</legend><div className="toggle-chips">
          {[1, 2, 3].map((r) => <label key={r} className="toggle-chip"><input type="checkbox" checked={query.rounds.includes(r)} onChange={() => update({ rounds: toggle(query.rounds, r).sort() })} /><span>รอบ {r}</span></label>)}
        </div><p className="field-hint">{query.rounds.length ? `เลือก ${query.rounds.length} รอบ` : "ทุกรอบ"}</p></fieldset>
        <fieldset className="filter chip-field"><legend>หมวดสินค้า</legend><div className="toggle-chips">
          {options.categories.map((c) => <label key={c.id} className="toggle-chip"><input type="checkbox" checked={query.categories.includes(c.id)} onChange={() => update({ categories: toggle(query.categories, c.id) })} /><span>{c.name}</span></label>)}
        </div><p className="field-hint">{query.categories.length ? "สาขาและหมวดสินค้าต้องอยู่จุดส่งเดียวกัน" : "ทุกหมวดสินค้า"}</p></fieldset>
        <fieldset className="filter chip-field"><legend>ประเภทรอบรถ</legend><div className="toggle-chips">
          {options.kinds.map((k) => <label key={k} className="toggle-chip"><input type="checkbox" checked={query.kinds.includes(k)} disabled={query.kinds.length === 1 && query.kinds.includes(k)} onChange={() => update({ kinds: toggle(query.kinds, k) })} /><span>{tripKindLabels[k]}</span></label>)}
        </div><p className="field-hint">ค่าเริ่มต้น: รอบส่งสินค้าสาขาที่เผยแพร่แล้ว</p></fieldset>
      </div>

      <div className="search-tabs" role="tablist" aria-label="วิธีค้นหา">
        {modes.map((item, i) => <button key={item.id} ref={(el) => { tabs.current[i] = el; }} id={`tab-${item.id}`} role="tab" type="button"
          aria-selected={modeIndex === i} aria-controls={`panel-${item.id}`} tabIndex={modeIndex === i ? 0 : -1}
          onKeyDown={(e) => navigateTabs(e, i)} onClick={() => update({ mode: item.id })}><item.icon size={19} aria-hidden="true" /><span>{item.title}</span></button>)}
      </div>
      {modes.filter((m) => m.id !== query.mode).map((m) => <div key={m.id} role="tabpanel" id={`panel-${m.id}`} aria-labelledby={`tab-${m.id}`} hidden />)}
      <div role="tabpanel" id={`panel-${mode.id}`} aria-labelledby={`tab-${mode.id}`} tabIndex={0} className="search-panel">
        <div className="panel-heading"><span className="panel-icon"><mode.icon size={24} aria-hidden="true" /></span><div><h3>{mode.heading}</h3><p>{mode.description}</p></div></div>

        {query.mode === "branch" && <div className="branch-search">
          <div className="input-with-icon combobox">
            <Search size={20} aria-hidden="true" />
            <input role="combobox" aria-label="ชื่อสาขา รหัสสาขา หรือชื่อเรียกอื่น" aria-autocomplete="list" aria-expanded={listOpen && suggestions.length > 0} aria-controls={listId}
              aria-activedescendant={listOpen && activeOption >= 0 ? `${listId}-${activeOption}` : undefined} value={branchText} placeholder="พิมพ์ชื่อสาขาหรือรหัสสาขา" autoComplete="off" maxLength={100}
              onChange={(e) => { setBranchText(e.target.value); setListOpen(true); if (selected) setSelected(null); }} onKeyDown={onBranchKey} onFocus={() => setListOpen(true)} onBlur={() => window.setTimeout(() => setListOpen(false), 150)} />
            {branchText && <button type="button" className="clear-button" aria-label="ล้างคำค้นหาสาขา" onClick={clearBranch}><X size={18} aria-hidden="true" /></button>}
            <ul id={listId} role="listbox" aria-label="สาขาที่ตรงกับคำค้น" className="suggestions" hidden={!listOpen || !suggestions.length}>
              {suggestions.map((s, i) => <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === activeOption} className={i === activeOption ? "active" : undefined}
                onMouseDown={(e) => { e.preventDefault(); chooseBranch(s); }}><strong>{s.name}</strong><span>{s.code}{s.alias ? ` · ชื่อเรียกอื่น: ${s.alias}` : ""}</span></li>)}
            </ul>
          </div>
          <button type="button" className="primary-button" onClick={submitBranch}><Search size={19} aria-hidden="true" />ค้นหา</button>
        </div>}

        {query.mode === "time" && <div className="time-fields">{basisSelect}
          <fieldset className="time-chip-field"><legend className="field-label">{basisLabel}ที่มีในวันที่เลือก</legend>
            {facets?.times.length ? <div className="time-chips">{facets.times.map((t) => <label key={t.offset} className="time-chip">
              <input type="checkbox" checked={query.times.includes(t.offset)} onChange={() => update({ times: toggle(query.times, t.offset).sort((a, b) => a - b) })} />
              <span>{query.times.includes(t.offset) ? <Check size={15} aria-hidden="true" /> : null}{t.label}</span></label>)}</div>
              : <p className="no-times"><Clock3 size={18} aria-hidden="true" />{busy ? "กำลังโหลดรายการเวลา…" : `ไม่มี${basisLabel}ในรอบรถที่เผยแพร่ตามตัวกรองนี้`}</p>}
            {query.times.length > 0 && <button type="button" className="link-button" onClick={() => update({ times: [] })}>ล้างเวลาที่เลือก ({query.times.length})</button>}
          </fieldset>
        </div>}

        {query.mode === "range" && <div className="time-fields">{basisSelect}
          <div className="range-block">
            <div className="range-fields">
              <div className="filter"><label htmlFor={`${uid}-from`}>เริ่มต้น</label><div className="select-wrap"><select id={`${uid}-from`} value={rangeDraft.from} onChange={(e) => setRangeDraft((r) => ({ ...r, from: e.target.value }))} aria-describedby={`${uid}-range-help`}>
                <option value="">เลือกเวลา</option>{rangeOptions.map((t) => <option key={t} value={t}>{t} น.</option>)}</select><ChevronDown size={16} aria-hidden="true" /></div></div>
              <span className="range-separator" aria-hidden="true">–</span>
              <div className="filter"><label htmlFor={`${uid}-to`}>สิ้นสุด</label><div className="select-wrap"><select id={`${uid}-to`} value={rangeDraft.to} onChange={(e) => setRangeDraft((r) => ({ ...r, to: e.target.value }))} aria-describedby={`${uid}-range-help`}>
                <option value="">เลือกเวลา</option>{rangeOptions.map((t) => <option key={t} value={t}>{t} น.</option>)}</select><ChevronDown size={16} aria-hidden="true" /></div></div>
              <button type="button" className="primary-button" onClick={submitRange}><Search size={19} aria-hidden="true" />ค้นหา</button>
            </div>
            {rangeError ? <p className="field-error" role="alert">{rangeError}</p> :
              <p id={`${uid}-range-help`} className="field-hint">รวมเวลาเริ่มต้นและเวลาสิ้นสุด{span ? ` · ${basisLabel}ที่มีในวันนี้ ${span.fromLabel}–${span.toLabel} น.` : ""}</p>}
          </div>
        </div>}
      </div>

      <div className="results" aria-labelledby={`${uid}-results`}>
        <div className="results-head">
          <h2 id={`${uid}-results`} className="sr-only">ผลการค้นหารอบรถ</h2>
          <p className="count-badge" role="status" aria-live="polite"><Check size={15} aria-hidden="true" />{busy ? "กำลังค้นหา…" : `พบ ${(result?.total ?? 0).toLocaleString("th-TH")} รอบรถ`}</p>
          <div className="select-wrap sort-select"><label htmlFor={`${uid}-sort`} className="sr-only">เรียงลำดับ</label>
            <select id={`${uid}-sort`} value={query.sort} onChange={(e) => update({ sort: e.target.value as Sort })}>
              <option value="time_asc">เรียงตาม{basisLabel} (เร็ว → ช้า)</option><option value="time_desc">เรียงตาม{basisLabel} (ช้า → เร็ว)</option>
            </select><ChevronDown size={16} aria-hidden="true" /></div>
        </div>
        <div aria-busy={busy}>
          {status.state === "error" ? <div className="results-state error-state" role="alert"><AlertCircle size={28} aria-hidden="true" /><div><h3>ค้นหาไม่สำเร็จ</h3><p>{status.message}</p>
            {status.unauthenticated ? <Link className="secondary-button" href="/login?next=/">เข้าสู่ระบบอีกครั้ง</Link> : <button type="button" className="secondary-button" onClick={() => setAttempt((n) => n + 1)}><RefreshCw size={16} aria-hidden="true" />ลองอีกครั้ง</button>}</div></div>
          : !result ? <div className="results-loading" role="status"><span className="sr-only">กำลังโหลดรอบรถ</span>{[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton-row" />)}</div>
          : result.resolution.status === "AMBIGUOUS" ? <div className="results-state"><Info size={26} aria-hidden="true" /><div><h3>พบหลายสาขาที่ตรงกับ “{result.applied.query}”</h3><p>กรุณาเลือกสาขาที่ต้องการ ระบบจะไม่เลือกแทนเพื่อป้องกันการส่งผิดสาขา</p>
            <div className="candidate-list">{result.resolution.candidates.map((c) => <button key={c.id} type="button" className="secondary-button" onClick={() => chooseBranch(c)}>{c.name} ({c.code}){c.alias ? ` · ${c.alias}` : ""}</button>)}</div></div></div>
          : result.resolution.status === "NOT_FOUND" ? <div className="results-state"><MapPin size={26} aria-hidden="true" /><div><h3>ไม่พบสาขาที่ตรงกับคำค้น</h3><p>ตรวจสอบตัวสะกด ลองใช้รหัสสาขา หรือดูรายชื่อใน <Link href="/branches">สาขาทั้งหมด</Link></p></div></div>
          : !result.published ? <div className="results-state"><CalendarDays size={26} aria-hidden="true" /><div><h3>ยังไม่มีแผนเดินรถที่เผยแพร่</h3><p>{thaiLongDate(result.serviceDate)} ยังไม่มีรอบรถที่เผยแพร่ กรุณาเลือกวันอื่นหรือติดต่อผู้จัดรถ</p></div></div>
          : result.total === 0 ? <div className="results-state"><Route size={26} aria-hidden="true" /><div><h3>ไม่พบรอบรถที่ตรงกับเงื่อนไข</h3><p>ลองเลือกเวลาอื่น ขยายช่วงเวลา หรือล้างตัวกรองบางรายการ</p><button type="button" className="secondary-button" onClick={clearAll}>ล้างตัวกรองทั้งหมด</button></div></div>
          : <div className={busy ? "results-body is-refreshing" : "results-body"}>
            <TripResults rows={result.rows} branchId={result.resolution.branch?.id} caption={`ผลการค้นหารอบรถ ${filterText || "ทั้งหมด"}`} />
            <div className="results-foot">
              <span>แสดง {showing} จาก {result.total.toLocaleString("th-TH")} รายการ{filterText ? ` · ${filterText}` : ""}</span>
              <nav className="pager" aria-label="เลือกหน้าผลการค้นหา">
                <button type="button" className="secondary-button" disabled={result.page <= 1 || busy} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}>ก่อนหน้า</button>
                <span aria-current="page">หน้า {result.page} จาก {result.pageCount}</span>
                <button type="button" className="secondary-button" disabled={result.page >= result.pageCount || busy} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}>ถัดไป</button>
              </nav>
            </div>
          </div>}
        </div>
      </div>
    </section>
  </div>;
}
