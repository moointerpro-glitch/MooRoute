"use client";

import { Fragment, useState } from "react";
import { Ban, ChevronLeft, ChevronRight, Copy, Pencil, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import type { PlanningData } from "@/server/services/planning-read";
import type { PlanningOverview, RangeResult } from "@/server/services/planning-range";
import type { DraftTrip } from "@/server/services/plans";
import { addDays } from "@/lib/planning-horizon";
import {PlanningDialog} from "./planning-dialog";
import Link from "next/link";
import { DateInput } from "./date-time-inputs";
import { beDate, isoDate, kindLabels } from "./planning-fields";

/** D225 presentation for one service date: summary first, detail on demand. No rule is decided here. */

const utcDay = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const thaiDay = (iso: string) => new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(utcDay(iso));
const shortWeekday = (iso: string) => new Intl.DateTimeFormat("th-TH", { weekday: "short", timeZone: "UTC" }).format(utcDay(iso));
const shortDay = (iso: string) => new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(utcDay(iso));

/** Bangkok clock time of an instant; a different calendar day than the service date is said so. */
export function clock(value: string | null, serviceDate: string) {
  if (!value) return "";
  const local = new Date(Date.parse(value) + 7 * 3_600_000).toISOString(), offset = Math.round((Date.parse(`${local.slice(0, 10)}T00:00:00Z`) - Date.parse(`${serviceDate}T00:00:00Z`)) / 86_400_000);
  return `${local.slice(11, 16)}${offset > 0 ? ` (+${offset} วัน)` : offset < 0 ? ` (${offset} วัน)` : ""}`;
}

const unitText: Record<string, string> = { KG: "กิโลกรัม", TON: "ตัน", BOX: "กล่อง", PIECE: "ชิ้น", LITER: "ลิตร" };
const dayStatus: Record<PlanningOverview["days"][number]["status"], { text: string; tone: string }> = {
  NONE: { text: "ยังไม่มีแผน", tone: "none" }, DRAFT: { text: "ร่าง ยังไม่เผยแพร่", tone: "draft" },
  PUBLISHED: { text: "เผยแพร่แล้ว", tone: "published" }, PUBLISHED_DRAFT: { text: "เผยแพร่แล้ว · มีร่างแก้ไข", tone: "changed" },
};

export function planStatus(data: PlanningData) {
  const latest = data.revisions[0];
  return !latest ? dayStatus.NONE : !data.publishedRevisionId ? dayStatus.DRAFT : latest.id === data.publishedRevisionId ? dayStatus.PUBLISHED : dayStatus.PUBLISHED_DRAFT;
}

/** Stays at the top while scrolling, so the date, plan status and coverage are always in view. */
export function DayBar({ data, date, activeTrips, dirty, busy, dateText, onDateText, onOpen, onGo, today }: {
  data: PlanningData; date: string; activeTrips: number; dirty: boolean; busy: boolean; dateText: string; onDateText: (text: string) => void; onOpen: (iso?: string) => void; onGo: (iso: string) => void; today: string;
}) {
  const status = planStatus(data), required = data.eligible.length * 6, covered = required - data.missing.length;
  return <div className="day-bar">
    <div className="day-bar-main">
      <div className="day-nav" role="group" aria-label="เลื่อนวัน">
        <button type="button" className="secondary-button" disabled={busy || dirty} onClick={() => onGo(addDays(date, -1))} aria-label="วันก่อนหน้า"><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" className="secondary-button" disabled={busy || dirty || date === today} onClick={() => onGo(today)}>วันนี้</button>
        <button type="button" className="secondary-button" disabled={busy || dirty} onClick={() => onGo(addDays(date, 1))} aria-label="วันถัดไป"><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className="day-title">
        <h2 aria-live="polite">แผน{thaiDay(date)}</h2>
        <p>
          <span className={`plan-chip plan-${status.tone}`}>{status.text}</span>
          <span className={`plan-chip ${covered === required && required > 0 ? "plan-published" : "plan-none"}`}>หมูและไก่ครบ {covered}/{required} ช่อง</span>
          <span className="plan-chip plan-neutral">{activeTrips} เที่ยว · {data.eligible.length} สาขา</span>
          {date === today && <span className="plan-chip plan-neutral">วันนี้</span>}
        </p>
      </div>
      <div className="day-open">
        <label>วันที่ให้บริการ (พ.ศ.)<DateInput value={dateText} onChange={onDateText} onPick={(iso) => { if (!dirty) onOpen(iso); }} aria-label="วันที่ให้บริการ (พ.ศ.)" required /></label>
        <button type="button" className="secondary-button" disabled={busy || dirty} onClick={() => onOpen()}>เปิดวันที่</button>
      </div>
    </div>
  </div>;
}

/** Two weeks at a glance: which dates are published, only drafted, or still without a plan. */
export function WeekStrip({ overview, date, dirty, busy, onGo, onShift }: { overview: PlanningOverview | null; date: string; dirty: boolean; busy: boolean; onGo: (iso: string) => void; onShift: (days: number) => void }) {
  if (!overview) return <div className="week-strip" aria-busy="true"><p className="muted">กำลังโหลดภาพรวมรายวัน…</p></div>;
  return <nav className="week-strip" aria-label="ภาพรวมแผนรายวัน ๑๔ วัน">
    <button type="button" className="secondary-button week-shift" disabled={busy} onClick={() => onShift(-7)} aria-label="สัปดาห์ก่อนหน้า"><ChevronLeft size={18} aria-hidden="true" /></button>
    <ol>{overview.days.map((d) => {
      const s = dayStatus[d.status];
      return <li key={d.date}><button type="button" className={`week-day plan-${s.tone}`} aria-current={d.date === date ? "date" : undefined} disabled={busy || dirty} onClick={() => onGo(d.date)}
        aria-label={`${thaiDay(d.date)} ${s.text}${d.status === "NONE" ? "" : ` ครบ ${d.covered} จาก ${d.required} ช่อง`}`}>
        <span className="week-name">{shortWeekday(d.date)}{d.date === overview.today && <em>วันนี้</em>}</span>
        <strong>{shortDay(d.date)}</strong>
        <span className="week-status">{s.text}</span>
        <span className="week-cover">{d.status === "NONE" ? "—" : `${d.covered}/${d.required}`}</span>
      </button></li>;
    })}</ol>
    <button type="button" className="secondary-button week-shift" disabled={busy} onClick={() => onShift(7)} aria-label="สัปดาห์ถัดไป"><ChevronRight size={18} aria-hidden="true" /></button>
  </nav>;
}

export function MissingPlanNotice({ overview, onGo, dirty }: { overview: PlanningOverview | null; onGo: (iso: string) => void; dirty: boolean }) {
  if (!overview?.upcomingMissing.length) return null;
  return <p className="notice-panel missing-plans"><TriangleAlert size={20} aria-hidden="true" />
    <span><strong>ใน ๗ วันข้างหน้ายังไม่มีแผนที่เผยแพร่ {overview.upcomingMissing.length} วัน</strong> วันเหล่านี้ค้นหารอบรถและจัดรถให้คำขอฝากส่งไม่ได้:{" "}
      {overview.upcomingMissing.map((d) => <button key={d} type="button" className="link-button" disabled={dirty} onClick={() => onGo(d)}>{shortWeekday(d)} {shortDay(d)}</button>)}</span></p>;
}

const active = (trips: DraftTrip[]) => trips.filter((t) => !t.cancelled);
const earliest = (values: (string | null)[]) => values.filter((v): v is string => !!v).sort()[0] ?? null;
const latest = (values: (string | null)[]) => values.filter((v): v is string => !!v).sort().at(-1) ?? null;

/** When each round runs on this date, taken from the trips themselves. */
export function RoundSummary({ trips, date }: { trips: DraftTrip[]; date: string }) {
  const rows = [1, 2, 3].map((round) => {
    const list = active(trips).filter((t) => t.kind === "BRANCH_DELIVERY" && t.roundNo === round);
    return { round, list, start: earliest(list.map((t) => t.loadingAt ?? t.departureAt)), firstOut: earliest(list.map((t) => t.departureAt)), lastOut: latest(list.map((t) => t.departureAt)), end: latest(list.map((t) => t.arrivalAt)),
      branches: new Set(list.flatMap((t) => t.stops.map((s) => s.branchId))).size, unknown: list.filter((t) => !t.departureAt || !t.arrivalAt).length };
  });
  const other = active(trips).filter((t) => t.kind !== "BRANCH_DELIVERY").length;
  return <section className="admin-card" aria-labelledby="rounds-heading">
    <h2 id="rounds-heading">รอบและช่วงเวลาของวันนี้</h2>
    <div className="table-scroll"><table className="admin-table data-table round-table">
      <thead><tr><th scope="col">รอบ</th><th scope="col">เริ่มขึ้นของ – ถึงปลายทาง</th><th scope="col">ออกรถ</th><th scope="col">เที่ยว</th><th scope="col">สาขาที่ส่ง</th><th scope="col">หมายเหตุ</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.round}>
        <th scope="row">รอบ {r.round}</th>
        <td className="num">{r.list.length ? `${clock(r.start, date) || "ยังไม่ระบุ"} – ${clock(r.end, date) || "ยังไม่ระบุ"}` : "—"}</td>
        <td className="num">{!r.list.length ? "—" : r.firstOut === r.lastOut ? clock(r.firstOut, date) || "ยังไม่ระบุ" : `${clock(r.firstOut, date)} – ${clock(r.lastOut, date)}`}</td>
        <td className="num">{r.list.length}</td><td className="num">{r.branches}</td>
        <td>{!r.list.length ? <span className="cell-warn">ยังไม่มีเที่ยวในรอบนี้</span> : r.unknown ? <span className="cell-warn">{r.unknown} เที่ยวยังไม่ระบุเวลาออกหรือเวลาถึง</span> : "เวลาครบ"}</td>
      </tr>)}</tbody>
    </table></div>
    {other > 0 && <p className="muted">มีเที่ยวรับเข้าคลัง รถขาย หรือประเภทอื่นอีก {other} เที่ยว ซึ่งไม่นับเป็นรอบส่งสาขา</p>}
  </section>;
}

/** Coverage per branch, round and category, naming the trip that covers each cell and when it arrives. */
export function CoverageTable({ data, date, dirty, onEdit, onAdd }: { data: PlanningData; date: string; dirty: boolean; onEdit?:(trip:DraftTrip)=>void; onAdd?:()=>void }) {
  const [cell,setCell]=useState<PlanningData["missing"][number]|null>(null);
  const requiredCodes=["PORK","CHICKEN"].filter(code=>!data.categories.some(c=>c.active&&c.code===code));
  const codeOf = new Map(data.categories.map((c) => [c.id, c.code]));
  const covering = (branchId: string, round: number, category: string) => active(data.trips).filter((t) => t.kind === "BRANCH_DELIVERY" && t.roundNo === round && t.stops.some((s) => s.branchId === branchId && s.categoryIds.some((id) => codeOf.get(id) === category && data.categories.some(c=>c.id===id&&c.active))));
  return <section className="admin-card" aria-labelledby="coverage-heading">
    <h2 id="coverage-heading">ความครบถ้วนทุกสาขา</h2>
    <p className="muted">ทุกสาขาที่ใช้งานต้องได้รับทั้งหมูและไก่ในทั้ง ๓ รอบ เที่ยวรับเข้าคลัง รถขาย และเที่ยวที่ยกเลิกไม่นับ · แต่ละช่องบอกเที่ยวที่ส่งและเวลาถึงตามแผน</p>
    {requiredCodes.length>0&&<div className="coverage-guidance" role="alert"><strong>ตรวจรหัสหมวดสินค้าก่อนจัดเที่ยว</strong><p>ยังไม่มีหมวดที่เปิดใช้งานด้วยรหัส {requiredCodes.join(" และ ")} ระบบจึงยังนับหมวดเหล่านี้ไม่ได้ แม้ชื่อจะแสดงว่าหมูหรือไก่ ให้ผู้ดูแลตรวจรหัสของรายการเดิมก่อนสร้างข้อมูลเพิ่ม</p><Link href="/admin/product-categories">เปิดรายการหมวดสินค้า</Link></div>}
    {dirty && <p className="form-error" role="status">มีการแก้ไขที่ยังไม่บันทึก ตารางนี้เป็นผลของฉบับที่บันทึกครั้งล่าสุด</p>}
    <div className="planner-table-scroll" tabIndex={0} role="region" aria-label="ตารางความครบถ้วน เลื่อนแนวนอนได้"><table className="coverage-table data-table">
      <thead><tr><th scope="col" rowSpan={2}>สาขา</th>{[1,2,3].map(n=><th key={n} colSpan={2} scope="colgroup">รอบ {n}</th>)}</tr><tr>{[1,2,3].flatMap(n=>["หมู","ไก่"].map(c=><th key={`${n}${c}`} scope="col">{c}</th>))}</tr></thead>
      <tbody>{data.eligible.map((b) => <tr key={b.id}><th scope="row">{b.name}</th>{[1, 2, 3].flatMap((n) => ["PORK", "CHICKEN"].map((c) => {
        const missing = data.missing.some((m) => m.branchId === b.id && m.roundNo === n && m.categoryCode === c), by = missing ? [] : covering(b.id, n, c);
        return <td key={`${n}${c}`} className={missing ? "cell-missing" : "cell-complete"}>{missing ? <button type="button" className="link-button" disabled={dirty} aria-label={`ดูวิธีแก้ ${b.name} รอบ ${n} ${c==="PORK"?"หมู":"ไก่"}`} onClick={()=>setCell({branchId:b.id,roundNo:n,categoryCode:c})}>ขาด · ดูวิธีแก้</button> : <>✓ ครบ{by[0] && <small>{by[0].code}{by.length > 1 ? ` +${by.length - 1}` : ""}<br />{by[0].arrivalAt ? `ถึง ${clock(by[0].arrivalAt, date)}` : by[0].departureAt ? `ออก ${clock(by[0].departureAt, date)}` : "ยังไม่ระบุเวลา"}</small>}</>}</td>;
      }))}</tr>)}</tbody>
    </table></div>
    {cell&&<PlanningDialog title={`แก้ช่องที่ขาด · รอบ ${cell.roundNo} · ${cell.categoryCode==="PORK"?"หมู":"ไก่"}`} onClose={()=>setCell(null)}><p><strong>{data.branches.find(b=>b.id===cell.branchId)?.name}</strong></p><p>เลือกเที่ยวส่งสาขารอบนี้ แล้วตรวจว่าจุดส่งของสาขานี้เลือกหมวด {cell.categoryCode==="PORK"?"หมู":"ไก่"} ที่เปิดใช้งานและรหัสตรงกับ {cell.categoryCode} จากนั้นบันทึกเที่ยวและตรวจแผน</p>{requiredCodes.includes(cell.categoryCode)&&<p className="form-error">ต้องให้ผู้ดูแลแก้รหัสหมวดสินค้าก่อน การเพิ่มเที่ยวอย่างเดียวจะยังไม่แก้ปัญหานี้</p>}<div className="coverage-trip-options">{data.trips.filter(t=>!t.cancelled&&t.kind==="BRANCH_DELIVERY"&&t.roundNo===cell.roundNo).map(t=><div key={t.tripId}><span>{t.code}<small>{t.stops.some(s=>s.branchId===cell.branchId)?"มีจุดส่งสาขานี้แล้ว — ตรวจหมวดสินค้า":"ยังไม่มีจุดส่งสาขานี้"}</small></span>{onEdit&&<button className="secondary-button" onClick={()=>{setCell(null);onEdit(t);}}>แก้ไขเที่ยวนี้</button>}</div>)}</div>{!data.trips.some(t=>!t.cancelled&&t.kind==="BRANCH_DELIVERY"&&t.roundNo===cell.roundNo)&&<p>ยังไม่มีเที่ยวส่งสาขาในรอบนี้</p>}<div className="dialog-actions"><button className="secondary-button" onClick={()=>setCell(null)}>กลับไปตรวจสอบ</button>{onAdd&&<button className="primary-button" onClick={()=>{setCell(null);onAdd();}}>เพิ่มเที่ยว</button>}</div></PlanningDialog>}
    {!data.eligible.length && <p>ยังไม่มีสาขาที่มีผลในวันนี้ กรุณาตรวจข้อมูลหลักก่อนเผยแพร่</p>}
  </section>;
}

export interface TripActions { edit: (trip: DraftTrip) => void; copy: (trip: DraftTrip) => void; toggleCancel: (trip: DraftTrip) => void; remove: (trip: DraftTrip) => void }

/** One row per trip, grouped by round. The stops, vehicle booking and load open on demand; the editor opens under its trip. */
export function TripTable({ trips, data, date, canWrite, actions }: {
  trips: DraftTrip[]; data: PlanningData; date: string; canWrite: boolean; actions: TripActions;
}) {
  const [detail,setDetail]=useState<DraftTrip|null>(null);
  const vehicle = (id: string | null) => data.vehicles.find((v) => v.id === id), driver = (id?: string | null) => data.drivers.find((d) => d.id === id);
  const routeName = (id?: string | null) => id ? data.routes.flatMap((r) => r.routeRevision_routeId).find((r) => r.id === id)?.name : undefined;
  const stopName = (s: DraftTrip["stops"][number]) => s.nameSnapshot ?? data.branches.find((b) => b.id === s.branchId)?.name ?? "จุดส่งเดิม";
  const groups = [
    ...[1, 2, 3].map((n) => ({ key: `r${n}`, title: `รอบ ${n}`, list: trips.filter((t) => t.kind === "BRANCH_DELIVERY" && t.roundNo === n) })),
    { key: "other", title: "รับเข้าคลัง รถขาย และอื่น ๆ (ไม่นับความครบถ้วน)", list: trips.filter((t) => t.kind !== "BRANCH_DELIVERY") },
  ].filter((g) => g.list.length);
  const columns = canWrite ? 8 : 7;
  return <><div className="table-scroll" role="region" aria-label="ตารางเที่ยวรถ เลื่อนแนวนอนได้" tabIndex={0}><table className="admin-table data-table trip-table">
    <thead><tr><th scope="col">เที่ยว</th><th scope="col">รถ / พนักงานขับรถ</th><th scope="col">เริ่มขึ้นของ</th><th scope="col">ออกรถ</th><th scope="col">ถึงปลายทาง</th><th scope="col">จุดส่ง</th><th scope="col">สถานะ</th>{canWrite && <th scope="col">จัดการ</th>}</tr></thead>
    {groups.map((g) => <tbody key={g.key}>
      <tr className="round-row"><th colSpan={columns} scope="colgroup">{g.title} · {g.list.filter((t) => !t.cancelled).length} เที่ยว</th></tr>
      {g.list.map((t) => {
        const v = vehicle(t.vehicleId), incomplete = !t.cancelled && (!t.vehicleId || !t.departureAt || !t.occupancyStart || !t.occupancyEnd);
        return <Fragment key={t.tripId}>
          <tr id={`trip-${t.tripId}`} tabIndex={-1} className={`trip-card${t.cancelled ? " trip-cancelled" : ""}`}>
            <th scope="row"><strong>{t.code}</strong><span className="muted cell-sub">{routeName(t.routeRevisionId) ?? kindLabels[t.kind]}</span></th>
            <td><strong>{v?.plateNormalized ?? "ยังไม่ระบุรถ"}</strong><span className="muted cell-sub">{driver(t.driverId)?.name ?? "ยังไม่ระบุพนักงานขับรถ"}</span></td>
            <td className="num">{clock(t.loadingAt, date) || "ยังไม่ระบุ"}</td><td className="num">{clock(t.departureAt, date) || "ยังไม่ระบุ"}</td><td className="num">{clock(t.arrivalAt, date) || "ยังไม่ระบุ"}</td>
            <td><span>{t.stops.length} จุด</span><button type="button" className="link-button" aria-haspopup="dialog" onClick={()=>setDetail(t)}>ดูรายละเอียด</button>
              <span className="muted cell-sub">{t.stops.map(stopName).join(" → ") || "ยังไม่มีจุดส่ง"}</span></td>
            <td><span className={`plan-chip ${t.cancelled ? "plan-none" : incomplete ? "plan-draft" : "plan-published"}`}>{t.cancelled ? "ยกเลิก" : incomplete ? "รถ / เวลายังไม่ครบ" : "รถ / เวลาครบ"}</span></td>
            {canWrite && <td><div className="row-actions">
              <button type="button" className="secondary-button" onClick={() => actions.edit(t)}><Pencil size={15} aria-hidden="true" />แก้ไข</button>
              <button type="button" className="secondary-button" aria-label="คัดลอก" title="คัดลอกเป็นเที่ยวใหม่" onClick={() => actions.copy(t)}><Copy size={16} aria-hidden="true" />คัดลอก</button>
              <button type="button" className="secondary-button" aria-label={t.cancelled ? "คืนเที่ยว" : "ยกเลิกเที่ยว"} title={t.cancelled ? "คืนเที่ยว" : "ยกเลิกเที่ยว (เก็บประวัติ)"} onClick={() => actions.toggleCancel(t)}>{t.cancelled ? <Undo2 size={16} aria-hidden="true" /> : <Ban size={16} aria-hidden="true" />}{t.cancelled?"คืนเที่ยว":"ยกเลิกเที่ยว"}</button>
              <button type="button" className="secondary-button" aria-label="นำเที่ยวออกจากฉบับร่าง" title="ลบเที่ยวที่ยังไม่เคยเผยแพร่" onClick={() => actions.remove(t)}><Trash2 size={16} aria-hidden="true" />นำออก</button>
            </div></td>}
          </tr>
        </Fragment>;
      })}
    </tbody>)}
  </table></div>
  {detail&&<PlanningDialog title={`รายละเอียดเที่ยว ${detail.code}`} onClose={()=>setDetail(null)}><p className="muted">{thaiDay(date)} · {kindLabels[detail.kind]}{detail.roundNo?` · รอบ ${detail.roundNo}`:""}</p><dl className="trip-times"><dt>รถ</dt><dd>{vehicle(detail.vehicleId)?.plateNormalized??"ยังไม่ระบุ"}</dd><dt>พนักงานขับรถ</dt><dd>{driver(detail.driverId)?.name??"ยังไม่ระบุ"}</dd><dt>เริ่มขึ้นของ</dt><dd>{clock(detail.loadingAt,date)||"ยังไม่ระบุ"}</dd><dt>ออกรถ</dt><dd>{clock(detail.departureAt,date)||"ยังไม่ระบุ"}</dd><dt>ถึงปลายทาง</dt><dd>{clock(detail.arrivalAt,date)||"ยังไม่ระบุ"}</dd><dt>ช่วงจองรถ</dt><dd>{clock(detail.occupancyStart,date)||"ยังไม่ระบุ"} – {clock(detail.occupancyEnd,date)||"ยังไม่ระบุ"} · เผื่อ {detail.bufferMinutes} นาที</dd><dt>ความจุรถ</dt><dd>{vehicle(detail.vehicleId)?.capacity??"ยังไม่ระบุ"} {unitText[vehicle(detail.vehicleId)?.capacityUnit??""]}</dd><dt>บรรทุกตามแผน</dt><dd>{detail.plannedLoad??"ยังไม่ระบุ"} {unitText[detail.loadUnit??""]}</dd></dl><h3>จุดส่งและสินค้า</h3><ol className="trip-stops">{detail.stops.map((stop,n)=><li key={n}>{stopName(stop)}<span>{stop.categoryIds.map(id=>{const c=data.categories.find(c=>c.id===id);return c?`${c.name} (${c.code})${c.active?"":" — ปิดใช้งาน"}`:"หมวดเดิม";}).join(" / ")||"ยังไม่ระบุหมวดสินค้า"}</span></li>)}</ol>{detail.notes&&<p>{detail.notes}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={()=>setDetail(null)}>ปิดรายละเอียด</button>{canWrite&&<button className="primary-button" onClick={()=>{setDetail(null);actions.edit(detail);}}>แก้ไขเที่ยวนี้</button>}</div></PlanningDialog>}
  </>;
}

/** Drafts and publication for several dates at once. The server applies every rule per date and reports each result. */
export function RangeTools({ overview, canWrite, canPublish, busy, dirty, run }: {
  overview: PlanningOverview | null; canWrite: boolean; canPublish: boolean; busy: boolean; dirty: boolean; run: (action: "generateRange" | "publishRange", input: { from: string; to: string; reason: string }) => Promise<RangeResult[] | null>;
}) {
  const today = overview?.today ?? "";
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [reason, setReason] = useState(""), [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState<{ title: string; rows: RangeResult[] } | null>(null), [error, setError] = useState("");
  if (!overview || (!canWrite && !canPublish)) return null;
  const fromText = from || beDate(today), toText = to || beDate(addDays(today, 6));
  const submit = async (action: "generateRange" | "publishRange") => {
    setError(""); setResults(null);
    let range;
    try { range = { from: isoDate(fromText), to: isoDate(toText) }; } catch (e) { setError((e as Error).message); return; }
    const rows = await run(action, { ...range, reason: reason.trim() || (action === "generateRange" ? "สร้างร่างล่วงหน้าจากแม่แบบ" : "เผยแพร่แผนที่สร้างจากแม่แบบและตรวจครบแล้ว") });
    if (rows) { setResults({ title: action === "generateRange" ? "ผลการสร้างร่าง" : "ผลการเผยแพร่", rows }); setConfirmed(false); }
  };
  const outcomeText = { done: "สำเร็จ", skipped: "ข้าม", failed: "ไม่สำเร็จ" } as const;
  return <details className="admin-card range-tools">
    <summary><h2>สร้างและเผยแพร่หลายวัน</h2><span className="muted">สร้างร่างล่วงหน้าได้ {overview.draftAheadDays} วัน · เผยแพร่พร้อมกันได้ {overview.publishAheadDays} วัน</span></summary>
    <p className="muted">ระบบสร้างร่างจากแม่แบบประจำให้เฉพาะวันที่ยังไม่มีแผน และเผยแพร่พร้อมกันเฉพาะวันที่เป็นร่างจากแม่แบบล้วนและหมูไก่ครบทุกช่อง วันที่แก้ด้วยมือต้องเปิดตรวจและเผยแพร่ทีละวัน</p>
    <div className="form-grid range-grid">
      <label>ตั้งแต่วันที่ (พ.ศ.)<DateInput value={fromText} onChange={setFrom} aria-label="ตั้งแต่วันที่ (พ.ศ.)" /></label>
      <label>ถึงวันที่ (พ.ศ.)<DateInput value={toText} onChange={setTo} aria-label="ถึงวันที่ (พ.ศ.)" /></label>
      <label>เหตุผล (ไม่บังคับ)<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="เช่น แผนประจำสัปดาห์" /></label>
    </div>
    <div className="planner-actions">
      {canWrite && <button type="button" className="secondary-button" disabled={busy || dirty} onClick={() => void submit("generateRange")}>สร้างร่างจากแม่แบบ</button>}
      {canPublish && <><label className="check-label"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />ดูภาพรวมรายวันด้านบนแล้ว ต้องการเผยแพร่ทุกวันที่พร้อมในช่วงนี้</label>
        <button type="button" className="primary-button" disabled={busy || dirty || !confirmed} onClick={() => void submit("publishRange")}>เผยแพร่วันที่พร้อม</button></>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {results && <div className="table-scroll"><table className="admin-table data-table range-results"><caption>{results.title}</caption>
      <thead><tr><th scope="col">วันที่</th><th scope="col">ผล</th><th scope="col">รายละเอียด</th></tr></thead>
      <tbody>{results.rows.map((r) => <tr key={r.date}><th scope="row">{thaiDay(r.date)}</th><td><span className={`plan-chip ${r.outcome === "done" ? "plan-published" : r.outcome === "failed" ? "plan-none" : "plan-neutral"}`}>{outcomeText[r.outcome]}</span></td><td>{r.message}</td></tr>)}</tbody>
    </table></div>}
  </details>;
}
