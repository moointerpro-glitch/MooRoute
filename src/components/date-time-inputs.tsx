"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock3 } from "lucide-react";
import { THAI_MONTHS, THAI_WEEKDAYS, THAI_WEEKDAYS_SHORT, addDays, addMonths, bangkokToday, formatBeDate, maskDateText, maskTimeText, monthGrid, normalizeDateText, normalizeTimeText, parseThaiDate, parseTime, thaiDateLabel } from "@/lib/date-input";

/**
 * Dedicated Thai date (วว/ดด/ปปปป พ.ศ.) and 24-hour time (ชช:นน) fields.
 * The visible input keeps the field's `name` and submits the same text format as before, so forms,
 * FormData readers and server parsers are unchanged. Pickers render in a portal so they never become part
 * of a surrounding <label>'s text and are not clipped by scrolling containers.
 */
type FieldProps = {
  id?: string; name?: string; required?: boolean; readOnly?: boolean; disabled?: boolean; placeholder?: string; className?: string;
  "aria-label"?: string; "aria-describedby"?: string; "aria-invalid"?: boolean;
  /** Called when focus leaves the field (and its picker) or Enter is pressed, with normalised text. */
  onCommit?: (text: string) => void;
};

function useText(value: string | undefined, defaultValue: string | undefined, onChange?: (text: string) => void) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const controlled = value !== undefined, text = controlled ? value : inner;
  const setText = useCallback((next: string) => { if (!controlled) setInner(next); onChange?.(next); }, [controlled, onChange]);
  return [text, setText] as const;
}

/** Fixed-position popover under (or above) its anchor; follows scrolling and resizing; closes on outside press. */
function Popover({ anchor, owner, open, onClose, label, children }: { anchor: RefObject<HTMLElement | null>; owner: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect(), box = ref.current;
      if (!a || !box) return;
      const w = box.offsetWidth, h = box.offsetHeight, gap = 6;
      const below = a.bottom + gap + h <= window.innerHeight || a.top - gap - h < 0;
      setStyle({ top: below ? a.bottom + gap : a.top - gap - h, left: Math.max(8, Math.min(a.left, window.innerWidth - w - 8)) });
    };
    place();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, anchor]);
  useEffect(() => {
    if (!open) return;
    const press = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !owner.current?.contains(t)) onClose(); };
    document.addEventListener("pointerdown", press);
    return () => document.removeEventListener("pointerdown", press);
  }, [open, onClose, owner]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(<div ref={ref} role="dialog" aria-label={label} className="picker-popover"
    style={style ? { top: style.top, left: style.left } : { top: -9999, left: -9999 }}>{children}</div>, document.body);
}
const inPicker = (node: EventTarget | null) => node instanceof Element && !!node.closest(".picker-popover");

// ------------------------------------------------------------------ calendar

function Calendar({ selected, min, max, required, onPick, onClear, onClose }: { selected: string | null; min?: string; max?: string; required?: boolean; onPick: (iso: string) => void; onClear: () => void; onClose: () => void }) {
  const today = bangkokToday();
  const [focusDay, setFocusDay] = useState(selected ?? today);
  const grid = monthGrid(Number(focusDay.slice(0, 4)), Number(focusDay.slice(5, 7)));
  const month = Number(focusDay.slice(5, 7)), year = Number(focusDay.slice(0, 4));
  const gridRef = useRef<HTMLTableElement>(null);
  const allowed = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  useEffect(() => { gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus({ preventScroll: true }); }, [focusDay]);
  function key(e: KeyboardEvent<HTMLButtonElement>, iso: string) {
    const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(iso, -1), ArrowRight: () => addDays(iso, 1), ArrowUp: () => addDays(iso, -7), ArrowDown: () => addDays(iso, 7),
      Home: () => addDays(iso, -weekday), End: () => addDays(iso, 6 - weekday),
      PageUp: () => addMonths(iso, e.shiftKey ? -12 : -1), PageDown: () => addMonths(iso, e.shiftKey ? 12 : 1),
    };
    if (moves[e.key]) { e.preventDefault(); setFocusDay(moves[e.key]()); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }
  return <div className="calendar">
    <div className="calendar-head">
      <button type="button" className="picker-nav" aria-label="ปีก่อนหน้า" onClick={() => setFocusDay(addMonths(focusDay, -12))}><ChevronsLeft size={16} aria-hidden="true" /></button>
      <button type="button" className="picker-nav" aria-label="เดือนก่อนหน้า" onClick={() => setFocusDay(addMonths(focusDay, -1))}><ChevronLeft size={16} aria-hidden="true" /></button>
      <strong aria-live="polite">{THAI_MONTHS[month - 1]} {year + 543}</strong>
      <button type="button" className="picker-nav" aria-label="เดือนถัดไป" onClick={() => setFocusDay(addMonths(focusDay, 1))}><ChevronRight size={16} aria-hidden="true" /></button>
      <button type="button" className="picker-nav" aria-label="ปีถัดไป" onClick={() => setFocusDay(addMonths(focusDay, 12))}><ChevronsRight size={16} aria-hidden="true" /></button>
    </div>
    <table ref={gridRef} role="grid" aria-label={`ปฏิทิน ${THAI_MONTHS[month - 1]} พ.ศ. ${year + 543}`}>
      <thead><tr>{THAI_WEEKDAYS_SHORT.map((d, i) => <th key={d} scope="col" abbr={THAI_WEEKDAYS[i]}>{d}</th>)}</tr></thead>
      <tbody>{grid.map((week) => <tr key={week[0]}>{week.map((iso) => {
        const outside = Number(iso.slice(5, 7)) !== month;
        return <td key={iso}><button type="button" data-day={iso} tabIndex={iso === focusDay ? 0 : -1} disabled={!allowed(iso)}
          className={["calendar-day", outside && "is-outside", iso === today && "is-today", iso === selected && "is-selected"].filter(Boolean).join(" ")}
          aria-label={thaiDateLabel(iso)} aria-pressed={iso === selected} aria-current={iso === today ? "date" : undefined}
          onClick={() => onPick(iso)} onKeyDown={(e) => key(e, iso)}>{Number(iso.slice(8, 10))}</button></td>;
      })}</tr>)}</tbody>
    </table>
    <div className="picker-foot">
      <button type="button" className="link-button" disabled={!allowed(today)} onClick={() => onPick(today)}>วันนี้</button>
      {!required && <button type="button" className="link-button" onClick={onClear}>ล้างวันที่</button>}
      <button type="button" className="link-button" onClick={onClose}>ปิด</button>
    </div>
    <p className="picker-help">ลูกศรเลื่อนวัน · Page Up/Down เลื่อนเดือน · Enter เลือก · Esc ปิด</p>
  </div>;
}

export function DateInput({ value, defaultValue, onChange, onPick, min, max, ...field }: FieldProps & { value?: string; defaultValue?: string; onChange?: (text: string) => void; onPick?: (iso: string) => void; min?: string; max?: string }) {
  const [text, setText] = useText(value, defaultValue, onChange);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null), input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const autoId = useId(), id = field.id ?? `date-${autoId}`;
  const iso = parseThaiDate(text), invalid = text.trim() !== "" && !iso;
  const locked = field.readOnly || field.disabled;
  useEffect(() => { input.current?.setCustomValidity(invalid ? "กรุณากรอกวันที่เป็น วว/ดด/ปปปป (พ.ศ.) เช่น 06/10/2569" : ""); }, [invalid]);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  function commit(next = text) { const normal = normalizeDateText(next); if (normal !== next) setText(normal); field.onCommit?.(normal); }
  function pick(day: string) { const t = formatBeDate(day); setText(t); setOpen(false); input.current?.focus(); onPick?.(day); field.onCommit?.(t); }
  function blur(e: FocusEvent<HTMLInputElement>) { if (!wrap.current?.contains(e.relatedTarget) && !inPicker(e.relatedTarget)) commit(); }
  return <span ref={wrap} className={`dt-field date-field${field.className ? ` ${field.className}` : ""}`}>
    <input ref={input} id={id} name={field.name} value={text} required={field.required} readOnly={field.readOnly} disabled={field.disabled}
      inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={10} placeholder={field.placeholder ?? "วว/ดด/ปปปป"}
      aria-label={field["aria-label"]} aria-describedby={field["aria-describedby"]} aria-invalid={field["aria-invalid"] ?? (invalid || undefined)}
      onChange={(e) => setText(maskDateText(e.target.value))} onBlur={blur}
      onKeyDown={(e) => { if (e.key === "Enter" && field.onCommit) { e.preventDefault(); commit(); } else if (e.key === "ArrowDown" && e.altKey && !locked) { e.preventDefault(); setOpen(true); } else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); } }} />
    {!locked && <button ref={trigger} type="button" className="dt-trigger" aria-label="เลือกวันที่จากปฏิทิน" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(!open)}><CalendarDays size={18} aria-hidden="true" /></button>}
    <Popover anchor={wrap} owner={wrap} open={open} onClose={close} label="เลือกวันที่">
      <Calendar selected={iso} min={min} max={max} required={field.required} onPick={pick} onClose={close} onClear={() => { setText(""); setOpen(false); input.current?.focus(); field.onCommit?.(""); }} />
    </Popover>
  </span>;
}

// ------------------------------------------------------------------ time

function TimeList({ selected, step, onPick, onClose }: { selected: string | null; step: number; onPick: (time: string) => void; onClose: () => void }) {
  const slots = Array.from({ length: Math.floor(1440 / step) }, (_, i) => `${String(Math.floor((i * step) / 60)).padStart(2, "0")}:${String((i * step) % 60).padStart(2, "0")}`);
  const nearest = selected ?? (() => { const now = new Date(Date.now() + 7 * 3_600_000), m = now.getUTCHours() * 60 + now.getUTCMinutes(); return slots[Math.min(slots.length - 1, Math.round(m / step))]; })();
  const list = useRef<HTMLDivElement>(null);
  // Scroll only inside the list; the page itself must not move when the picker opens.
  useEffect(() => { const box = list.current, b = box?.querySelector<HTMLButtonElement>(`[data-time="${nearest}"]`) ?? box?.querySelector("button"); if (!box || !b) return; box.scrollTop = b.offsetTop - box.clientHeight / 2 + b.offsetHeight / 2; b.focus({ preventScroll: true }); }, [nearest]);
  function key(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const go = (n: number) => { e.preventDefault(); const b = list.current?.querySelectorAll<HTMLButtonElement>("button")[Math.max(0, Math.min(slots.length - 1, n))]; b?.focus({ preventScroll: true }); b?.scrollIntoView({ block: "nearest" }); };
    if (e.key === "ArrowDown") go(i + 1); else if (e.key === "ArrowUp") go(i - 1); else if (e.key === "PageDown") go(i + 4); else if (e.key === "PageUp") go(i - 4);
    else if (e.key === "Home") go(0); else if (e.key === "End") go(slots.length - 1); else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }
  return <div ref={list} className="time-list" aria-label="เวลาแบบ ๒๔ ชั่วโมง">{slots.map((t, i) =>
    <button key={t} type="button" data-time={t} tabIndex={t === nearest ? 0 : -1} aria-pressed={t === selected} className={t === selected ? "is-selected" : undefined}
      onClick={() => onPick(t)} onKeyDown={(e) => key(e, i)}>{t} น.</button>)}
    <p className="picker-help">พิมพ์เวลาอื่นในช่องได้ เช่น 08:15</p>
  </div>;
}

export function TimeInput({ value, defaultValue, onChange, step = 30, ...field }: FieldProps & { value?: string; defaultValue?: string; onChange?: (text: string) => void; step?: number }) {
  const [text, setText] = useText(value, defaultValue, onChange);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null), input = useRef<HTMLInputElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const autoId = useId(), id = field.id ?? `time-${autoId}`;
  const time = parseTime(text), invalid = text.trim() !== "" && !time;
  const locked = field.readOnly || field.disabled;
  useEffect(() => { input.current?.setCustomValidity(invalid ? "กรุณากรอกเวลาแบบ ๒๔ ชั่วโมง ชช:นน เช่น 08:30" : ""); }, [invalid]);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  function commit(next = text) { const normal = normalizeTimeText(next); if (normal !== next) setText(normal); field.onCommit?.(normal); }
  function pick(t: string) { setText(t); setOpen(false); input.current?.focus(); field.onCommit?.(t); }
  function blur(e: FocusEvent<HTMLInputElement>) { if (!wrap.current?.contains(e.relatedTarget) && !inPicker(e.relatedTarget)) commit(); }
  return <span ref={wrap} className={`dt-field time-field${field.className ? ` ${field.className}` : ""}`} data-filled={time ? "true" : undefined}>
    <input ref={input} id={id} name={field.name} value={text} required={field.required} readOnly={field.readOnly} disabled={field.disabled}
      inputMode="numeric" autoComplete="off" spellCheck={false} maxLength={5} placeholder={field.placeholder ?? "ชช:นน"}
      aria-label={field["aria-label"]} aria-describedby={field["aria-describedby"]} aria-invalid={field["aria-invalid"] ?? (invalid || undefined)}
      onChange={(e) => setText(maskTimeText(e.target.value))} onBlur={blur}
      onKeyDown={(e) => { if (e.key === "Enter" && field.onCommit) { e.preventDefault(); commit(); } else if (e.key === "ArrowDown" && e.altKey && !locked) { e.preventDefault(); setOpen(true); } else if (e.key === "Escape" && open) { e.preventDefault(); setOpen(false); } }} />
    {!locked && <button ref={trigger} type="button" className="dt-trigger" aria-label="เลือกเวลาจากรายการ" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(!open)}><Clock3 size={18} aria-hidden="true" /></button>}
    <Popover anchor={wrap} owner={wrap} open={open} onClose={close} label="เลือกเวลา"><TimeList selected={time} step={step} onPick={pick} onClose={close} /></Popover>
  </span>;
}

// ------------------------------------------------------------------ date + time

/**
 * Date and time side by side. The hidden input carries `name` with "วว/ดด/ปปปป ชช:นน" (or "" when both are empty),
 * exactly the text the previous single field accepted.
 */
export function DateTimeInput({ name, label, defaultValue = "", required, readOnly }: { name: string; label: string; defaultValue?: string; required?: boolean; readOnly?: boolean }) {
  const [initialDate = "", initialTime = ""] = defaultValue.trim().split(/\s+/);
  const [date, setDate] = useState(initialDate), [time, setTime] = useState(initialTime);
  const dateRef = useRef<HTMLSpanElement>(null);
  const half = (date.trim() === "") !== (time.trim() === "");
  useEffect(() => { dateRef.current?.querySelector("input")?.setCustomValidity(half ? "กรุณากรอกทั้งวันที่และเวลา หรือเว้นว่างทั้งสองช่อง" : (date && !parseThaiDate(date) ? "กรุณากรอกวันที่เป็น วว/ดด/ปปปป (พ.ศ.)" : "")); }, [half, date]);
  return <span className="dt-pair">
    <span ref={dateRef}><DateInput value={date} onChange={setDate} required={required} readOnly={readOnly} /></span>
    <TimeInput value={time} onChange={setTime} required={required} readOnly={readOnly} aria-label={`${label} เวลา`} />
    <input type="hidden" name={name} value={date.trim() || time.trim() ? `${normalizeDateText(date)} ${normalizeTimeText(time)}`.trim() : ""} />
  </span>;
}
