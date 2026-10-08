"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronUp, Clock3, X } from "lucide-react";

const ROW_HEIGHT = 44;
const twoDigits = (value: number) => String(value).padStart(2, "0");

/** A bounded, minute-accurate wheel. Scrolling never changes the parent field until confirmation. */
function TimeWheel({ label, max, value, onChange, autoFocus = false }: { label: string; max: number; value: number; onChange: (value: number) => void; autoFocus?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null);
  const lastScrollValue = useRef<number | null>(null);
  useLayoutEffect(() => {
    // A wheel scroll already positioned itself; don't fight native touch momentum or scroll snapping.
    if (viewport.current && lastScrollValue.current !== value) viewport.current.scrollTop = value * ROW_HEIGHT;
    lastScrollValue.current = value;
  }, [value]);
  useEffect(() => { if (autoFocus) viewport.current?.focus({ preventScroll: true }); }, [autoFocus]);
  function change(next: number) { onChange(Math.max(0, Math.min(max, next))); }
  function key(event: KeyboardEvent) {
    const next: Record<string, number> = { ArrowUp: value + 1, ArrowDown: value - 1, PageUp: value + 5, PageDown: value - 5, Home: 0, End: max };
    if (event.key in next) { event.preventDefault(); change(next[event.key]); }
  }
  return <div className="time-wheel">
    <span className="time-wheel-label">{label}</span>
    <button type="button" className="time-wheel-step" aria-label={`เพิ่ม${label}`} disabled={value === max} onClick={() => change(value + 1)}><ChevronUp size={20} aria-hidden="true" /></button>
    <div className="time-wheel-track">
      <div ref={viewport} className="time-wheel-viewport" role="spinbutton" tabIndex={0} aria-label={label}
        aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${twoDigits(value)} ${label}`} onKeyDown={key}
        onScroll={() => {
          const next = Math.max(0, Math.min(max, Math.round((viewport.current?.scrollTop ?? 0) / ROW_HEIGHT)));
          lastScrollValue.current = next;
          if (next !== value) onChange(next);
        }}>
        <div aria-hidden="true">{Array.from({ length: max + 1 }, (_, n) => <button key={n} type="button" tabIndex={-1}
          className={`time-wheel-value${n === value ? " is-current" : ""}`} onClick={() => { change(n); viewport.current?.focus({ preventScroll: true }); }}>{twoDigits(n)}</button>)}</div>
      </div>
      <span className="time-wheel-selection" aria-hidden="true" />
    </div>
    <button type="button" className="time-wheel-step" aria-label={`ลด${label}`} disabled={value === 0} onClick={() => change(value - 1)}><ChevronDown size={20} aria-hidden="true" /></button>
  </div>;
}

export function TimePicker({ selected, required, onPick, onClear, onClose }: { selected: string | null; required?: boolean; onPick: (value: string) => void; onClear: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(() => {
    const now = new Date(Date.now() + 7 * 3_600_000);
    return selected ? selected.split(":").map(Number) : [now.getUTCHours(), now.getUTCMinutes()];
  });
  const root = useRef<HTMLDivElement>(null);
  const time = `${twoDigits(draft[0])}:${twoDigits(draft[1])}`;
  function key(event: KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key === "Tab") {
      const controls = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), [tabindex="0"]') ?? [])];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  return <div ref={root} className="time-picker" onKeyDown={key}>
    <div className="time-picker-head"><span className="time-picker-icon"><Clock3 size={20} aria-hidden="true" /></span>
      <div><strong>เลือกเวลา</strong><span>เวลาแบบ 24 ชั่วโมง</span></div>
      <button type="button" className="time-picker-close" aria-label="ยกเลิกการเลือกเวลา" onClick={onClose}><X size={19} aria-hidden="true" /></button>
    </div>
    <p className="time-picker-hint">เลื่อนขึ้น–ลง หรือกดลูกศรเพื่อปรับเวลา</p>
    <div className="time-picker-wheels">
      <TimeWheel label="ชั่วโมง" max={23} value={draft[0]} onChange={hour => setDraft(previous => [hour, previous[1]])} autoFocus />
      <span className="time-picker-colon" aria-hidden="true">:</span>
      <TimeWheel label="นาที" max={59} value={draft[1]} onChange={minute => setDraft(previous => [previous[0], minute])} />
    </div>
    <div className="time-picker-actions">
      {!required && <button type="button" className="time-picker-clear" onClick={onClear}>ล้างเวลา</button>}
      <button type="button" className="time-picker-cancel" onClick={onClose}>ยกเลิก</button>
      <button type="button" className="time-picker-confirm" onClick={() => onPick(time)}><Check size={17} aria-hidden="true" />ใช้เวลา {time}</button>
    </div>
  </div>;
}
