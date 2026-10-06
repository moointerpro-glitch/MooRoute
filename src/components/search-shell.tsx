"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronDown, Clock3, Info, MapPin, Route, Search, SlidersHorizontal } from "lucide-react";

const modes = [
  { id: "branch", title: "ค้นหาจากสาขา", icon: MapPin, heading: "ต้องการส่งของไปสาขาไหน?", description: "ค้นหาด้วยชื่อสาขา รหัสสาขา หรือชื่อเรียกอื่นที่ตรวจสอบแล้ว" },
  { id: "time", title: "เลือกเวลา", icon: Clock3, heading: "เลือกรอบรถตามเวลาที่ต้องการ", description: "เลือกได้หลายเวลา โดยระบบจะรวมรอบรถที่ตรงกับเวลาใดเวลาหนึ่ง" },
  { id: "range", title: "เลือกช่วงเวลา", icon: CalendarDays, heading: "ค้นหารอบรถในช่วงเวลาที่สะดวก", description: "ผลลัพธ์จะรวมเวลาเริ่มต้นและเวลาสิ้นสุดของช่วงที่เลือก" },
] as const;

export function SearchShell({ dateLabel }: { dateLabel: string }) {
  const [active, setActive] = useState(0);
  const [timeBasis, setTimeBasis] = useState("departure");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  function navigateTabs(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % modes.length;
    else if (event.key === "ArrowLeft") next = (index + modes.length - 1) % modes.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = modes.length - 1;
    else return;
    event.preventDefault(); setActive(next); tabs.current[next]?.focus();
  }
  const mode = modes[active];
  return <section className="search-card" aria-label="ค้นหารอบรถ">
    <div className="search-card-top"><div className="section-heading"><SlidersHorizontal size={19} aria-hidden="true" /><h2>ค้นหารอบรถของคุณ</h2></div><span className="muted small">เลือกวิธีค้นหาที่สะดวก</span></div>
    <div className="common-filters">
      <div className="filter"><span className="field-label">วันที่ให้บริการ</span><div className="read-only-field"><CalendarDays size={17} aria-hidden="true" /><span>{dateLabel}</span></div></div>
      <div className="filter"><label htmlFor="round">รอบส่งสินค้า</label><div className="select-wrap"><select id="round" disabled aria-describedby="search-unavailable"><option>ทุกรอบ (1, 2, 3)</option></select><ChevronDown size={16} aria-hidden="true" /></div></div>
      <div className="filter"><label htmlFor="category">หมวดสินค้า</label><div className="select-wrap"><select id="category" disabled aria-describedby="search-unavailable"><option>ทุกหมวดสินค้า</option></select><ChevronDown size={16} aria-hidden="true" /></div></div>
    </div>
    <div className="search-tabs" role="tablist" aria-label="วิธีค้นหา">
      {modes.map((item, i) => <button key={item.id} ref={(element) => { tabs.current[i] = element; }}
        id={`tab-${item.id}`} role="tab" type="button" aria-selected={active === i} aria-controls={`panel-${item.id}`}
        tabIndex={active === i ? 0 : -1} onKeyDown={(event) => navigateTabs(event, i)} onClick={() => setActive(i)}>
        <item.icon size={19} aria-hidden="true" /><span>{item.title}</span>
      </button>)}
    </div>
    {modes.filter((_, index) => index !== active).map((item) => <div key={item.id} role="tabpanel" id={`panel-${item.id}`} aria-labelledby={`tab-${item.id}`} hidden />)}
    <div role="tabpanel" id={`panel-${mode.id}`} aria-labelledby={`tab-${mode.id}`} tabIndex={0} className="search-panel">
      <div className="panel-heading"><span className="panel-icon"><mode.icon size={24} aria-hidden="true" /></span><div><h3>{mode.heading}</h3><p>{mode.description}</p></div></div>
      {active === 0 ? <div className="branch-search"><div className="input-with-icon"><Search size={20} aria-hidden="true" /><input aria-label="ชื่อหรือรหัสสาขา" disabled placeholder="พิมพ์ชื่อสาขาหรือรหัสสาขา" aria-describedby="search-unavailable" /></div><button className="primary-button" disabled><Search size={19} aria-hidden="true" />ค้นหา</button></div>
        : <div className="time-fields"><div className="filter time-basis"><label htmlFor="time-basis">เวลาที่ใช้ค้นหา</label><div className="select-wrap"><select id="time-basis" value={timeBasis} onChange={(event) => setTimeBasis(event.target.value)}><option value="departure">เวลาออกรถ</option><option value="loading">เวลาเริ่มขึ้นของ</option></select><ChevronDown size={16} aria-hidden="true" /></div></div>
          {active === 1 ? <p className="no-times"><Clock3 size={18} aria-hidden="true" />รายการเวลาจะแสดงเมื่อเปิดใช้งานข้อมูลรอบรถ</p>
            : <div className="range-fields"><div className="filter"><label htmlFor="range-start">เวลาเริ่มต้น</label><input id="range-start" placeholder="ชั่วโมง : นาที" disabled /></div><span className="range-separator" aria-hidden="true">—</span><div className="filter"><label htmlFor="range-end">เวลาสิ้นสุด</label><input id="range-end" placeholder="ชั่วโมง : นาที" disabled /></div><button className="primary-button" disabled><Search size={19} aria-hidden="true" />ค้นหา</button></div>}
        </div>}
      <p className="availability-note" id="search-unavailable"><Info size={17} aria-hidden="true" /><span>กรุณาเข้าสู่ระบบเพื่อค้นหารอบรถที่เผยแพร่ตามสิทธิ์ของคุณ <a className="inline-link" href="/login?next=/">เข้าสู่ระบบ</a></span></p>
    </div>
    <div className="results-empty"><span className="empty-icon"><Route size={30} strokeWidth={1.6} aria-hidden="true" /></span><div><h3>พื้นที่แสดงรอบรถ</h3><p>หลังเข้าสู่ระบบ คุณจะเห็นรอบรถที่เผยแพร่<br className="desktop-break" />พร้อมเวลา สาขาที่ผ่าน และรายละเอียดการขนส่งที่นี่</p></div></div>
  </section>;
}
