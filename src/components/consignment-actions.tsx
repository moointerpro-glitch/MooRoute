"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Ban, CheckCircle2, ChevronLeft, ChevronRight, PackageCheck, Pencil, ScanLine, Truck, Undo2, Warehouse } from "lucide-react";
import type { ConsignmentDetail } from "@/server/services/consignments";
import { actionLabels, CLOSED_INCOMPLETE_LABEL, issueTypes } from "@/server/domain/consignment";
import { unitText } from "@/lib/consignment-format";
import { beDate, isoFromBe, roundLabel, thaiLongDate } from "@/lib/trip-format";
import { DateInput } from "./date-time-inputs";
import { PlanningDialog } from "./planning-dialog";
import { newUuid } from "@/lib/new-uuid";

type Trip = { tripId: string; code: string; routeName: string | null; roundNo: number | null; departureAt: string | null; eligible: boolean; reasons: string[]; capacity: { known: boolean; used: string | null; capacity: string | null; unit: string | null } | null; current: boolean };
type Piece = ConsignmentDetail["packages"][number];
/** One dialog per action (D236): nothing is filled in until the person has chosen what to do. */
type Action = "assign" | "reassign" | "warehouseReceive" | "load" | "depart" | "receive" | "correctiveReceive" | "reportIssue" | "recordReturn" | "resolveIssue" | "close" | "cancel";
type DialogProps = { d: ConsignmentDetail; onClose: () => void; onDone: (message: string) => void };

async function post(action: string, input: unknown) {
  const response = await fetch("/api/consignments", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": newUuid() }, body: JSON.stringify({ action, input }) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data;
}
const clock = (iso: string | null) => iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : "ยังไม่ระบุ";
const shiftDate = (iso: string, days: number) => { const date = new Date(`${iso}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };

/** Runs one server action for a dialog: keeps the dialog open with the Thai error, or reports success and closes. */
function useSubmit(onDone: (message: string) => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function submit(action: string, input: unknown, done: string) {
    setBusy(true); setError("");
    try { await post(action, input); onDone(done); } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  const alert = error ? <p ref={errorRef} tabIndex={-1} className="form-error" role="alert">{error}</p> : null;
  return { busy, error, setError, submit, alert };
}
function Footer({ onClose, busy, children }: { onClose: () => void; busy: boolean; children: ReactNode }) {
  return <div className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>ปิดโดยไม่บันทึก</button>{children}</div>;
}
function Reason({ label, value, onChange, required = true, hint }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; hint?: string }) {
  return <label className="reason-field">{label}{required && <span className="required">*</span>}<textarea value={value} maxLength={500} rows={3} onChange={(e) => onChange(e.target.value)} />{hint && <span className="field-hint">{hint}</span>}</label>;
}
/** Pieces are listed the way they are labelled ("กล่อง 1/3"), never by the internal code. */
function Checklist({ list, selected, onChange, all = false }: { list: Piece[]; selected: string[]; onChange: (ids: string[]) => void; all?: boolean }) {
  const picked = list.filter((p) => selected.includes(p.id)).length;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return <fieldset className="package-checks"><legend>{all ? `ตรวจนับให้ครบทั้ง ${list.length}` : "เลือกบรรจุภัณฑ์ที่เกี่ยวข้อง"} <span className="muted">(เลือกแล้ว {picked}/{list.length})</span></legend>
    {all && list.length > 1 && <button type="button" className="link-button" onClick={() => onChange(picked === list.length ? [] : list.map((p) => p.id))}>{picked === list.length ? "ยกเลิกการเลือกทั้งหมด" : "เลือกครบทั้งหมด"}</button>}
    <div className="package-check-list">{list.map((p) => <label key={p.id} className="check-row"><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} /><span>{p.name}{p.description && <small>{p.description}</small>}</span></label>)}</div>
    {!list.length && <p className="muted small">ไม่มีบรรจุภัณฑ์ที่อยู่ในขั้นตอนนี้</p>}
  </fieldset>;
}

function AssignDialog({ d, onClose, onDone, move }: DialogProps & { move: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(d.requested.serviceDate ?? today), [dateText, setDateText] = useState(beDate(d.requested.serviceDate ?? today));
  const [trips, setTrips] = useState<Trip[] | null>(null), [notice, setNotice] = useState(""), [tripId, setTripId] = useState(""), [reason, setReason] = useState("");
  const { busy, submit, alert } = useSubmit(onDone);
  // The list follows the date: it loads when the dialog opens and again whenever a valid date is chosen.
  useEffect(() => {
    const controller = new AbortController();
    setTrips(null); setNotice(""); setTripId("");
    fetch(`/api/consignments/${d.id}/trips?date=${date}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) { setTrips([]); setNotice(data?.message ?? "โหลดรอบรถไม่สำเร็จ"); return; }
        setTrips(data.trips); if (!data.published) setNotice("วันที่นี้ยังไม่มีแผนเดินรถที่เผยแพร่");
      }).catch((error: unknown) => { if ((error as Error)?.name !== "AbortError") { setTrips([]); setNotice("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง"); } });
    return () => controller.abort();
  }, [d.id, date]);
  const choose = useCallback((iso: string) => { setDate(iso); setDateText(beDate(iso)); }, []);
  const commit = (text: string) => { const iso = isoFromBe(text); if (iso) setDate(iso); };
  const requested = d.requested.serviceDate;
  return <PlanningDialog title={move ? `ย้ายรอบรถ ${d.code}` : `จัดรถ ${d.code}`} onClose={onClose} busy={busy}>
    <p className="dialog-lead">ปลายทาง <strong>{d.branch.name} ({d.branch.code})</strong> · {d.packagingCount}{requested ? ` · ผู้ฝากต้องการส่ง ${beDate(requested)}${d.requested.roundNo ? ` ${roundLabel(d.requested.roundNo)}` : ""}` : ""}</p>
    <div className="dialog-date">
      <label htmlFor="assign-date">วันที่ให้บริการ (พ.ศ.)</label>
      <div className="date-stepper">
        <button type="button" className="icon-button" aria-label="วันก่อนหน้า" onClick={() => choose(shiftDate(date, -1))}><ChevronLeft size={18} aria-hidden="true" /></button>
        <DateInput id="assign-date" value={dateText} onChange={setDateText} onCommit={commit} onPick={choose} />
        <button type="button" className="icon-button" aria-label="วันถัดไป" onClick={() => choose(shiftDate(date, 1))}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <p className="field-hint">{thaiLongDate(date)}{requested && requested !== date && <> · <button type="button" className="link-button" onClick={() => choose(requested)}>กลับไปวันที่ผู้ฝากต้องการ</button></>}</p>
    </div>
    {trips === null ? <p className="muted" role="status">กำลังโหลดรอบรถ…</p>
      : trips.length ? <fieldset className="trip-options"><legend>เลือกรอบรถที่แวะส่ง {d.branch.name}</legend>{trips.map((t) => <label key={t.tripId} className={`trip-option${t.eligible && !t.current ? "" : " disabled"}${tripId === t.tripId ? " selected" : ""}`}>
        <input type="radio" name="trip" value={t.tripId} disabled={!t.eligible || t.current} checked={tripId === t.tripId} onChange={() => setTripId(t.tripId)} />
        <span><strong>{t.routeName ?? t.code}</strong> · {roundLabel(t.roundNo)} · ออก {clock(t.departureAt)} น.{t.current ? " (รอบปัจจุบัน)" : ""}
          <small>{t.eligible ? (t.capacity?.known ? `น้ำหนักรวม ${t.capacity.used}/${t.capacity.capacity} ${unitText(t.capacity.unit ?? "")}` : `รหัสรอบ ${t.code}`) : t.reasons.join(" · ")}</small></span></label>)}</fieldset>
        : <p className="muted">{notice || "ไม่มีรอบรถที่เผยแพร่ซึ่งแวะส่งสาขานี้ในวันที่เลือก"}</p>}
    {trips !== null && trips.length > 0 && notice && <p className="field-error" role="alert">{notice}</p>}
    {move ? <Reason label="เหตุผลการย้าย" value={reason} onChange={setReason} hint="ฉลากเดิมจะถูกยกเลิกและต้องออกฉบับใหม่" /> : <Reason label="หมายเหตุการจัดรถ (ไม่บังคับ)" value={reason} onChange={setReason} required={false} />}
    {alert}
    <Footer onClose={onClose} busy={busy}><button type="button" className="primary-button" disabled={busy || !tripId} onClick={() => void submit(move ? "reassign" : "assign", { id: d.id, expectedVersion: d.version, tripId, reason: reason.trim() || undefined }, move ? "ย้ายรอบรถแล้ว และยกเลิกฉลากเดิม" : "จัดรถแล้ว")}>{move ? "ยืนยันย้ายรอบรถ" : "ยืนยันจัดรถ"}</button></Footer>
  </PlanningDialog>;
}

function HandoverDialog({ d, onClose, onDone, action }: DialogProps & { action: "warehouseReceive" | "load" }) {
  const warehouse = action === "warehouseReceive", list = d.packages.filter((p) => p.custody === (warehouse ? "SENDER" : "WAREHOUSE"));
  const [selected, setSelected] = useState<string[]>([]);
  const { busy, submit, alert } = useSubmit(onDone);
  const trip = d.assignments.find((a) => a.current);
  return <PlanningDialog title={warehouse ? "คลังรับของจากผู้ฝาก" : "นำของขึ้นรถ"} onClose={onClose} busy={busy}>
    <p className="dialog-lead">{warehouse ? `รับของจาก ${d.contacts.senderName ?? d.requester} เข้า ${d.warehouse.name}` : `ขึ้นรถรอบ ${trip?.tripCode ?? "—"} ไป ${d.branch.name}`} · ต้องนับให้ครบทั้งหมด หากขาดให้ปิดหน้าต่างนี้แล้วใช้ “แจ้งปัญหา”</p>
    <Checklist list={list} selected={selected} onChange={setSelected} all />
    {alert}
    <Footer onClose={onClose} busy={busy}><button type="button" className="primary-button" disabled={busy} onClick={() => void submit(action, { id: d.id, expectedVersion: d.version, packageIds: selected }, warehouse ? "บันทึกคลังรับของแล้ว" : "บันทึกขึ้นรถแล้ว")}>{warehouse ? "ยืนยันคลังรับของ" : "ยืนยันขึ้นรถ"}</button></Footer>
  </PlanningDialog>;
}

function DepartDialog({ d, onClose, onDone }: DialogProps) {
  const { busy, submit, alert } = useSubmit(onDone), trip = d.assignments.find((a) => a.current);
  return <PlanningDialog title="บันทึกรถออก" onClose={onClose} busy={busy}>
    <p className="dialog-lead">บันทึกว่ารถรอบ <strong>{trip?.tripCode ?? "—"}</strong> ออกจากต้นทางแล้ว ระบบจะบันทึกให้ทุกรายการที่ขึ้นรถแล้วในรอบนี้ซึ่งคุณมีสิทธิ์ ไม่ใช่เฉพาะรายการนี้</p>
    {alert}
    <Footer onClose={onClose} busy={busy}><button type="button" className="primary-button" disabled={busy || !trip} onClick={() => void submit("depart", { tripId: trip!.tripId }, "บันทึกรถออกแล้ว")}>ยืนยันรถออกทั้งรอบ</button></Footer>
  </PlanningDialog>;
}

function ReceiveDialog({ d, onClose, onDone, corrective }: DialogProps & { corrective: boolean }) {
  const list = d.packages.filter((p) => p.custody === "VEHICLE");
  const [selected, setSelected] = useState<string[]>([]), [quantities, setQuantities] = useState<Record<string, string>>({}), [scan, setScan] = useState(""), [reason, setReason] = useState("");
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const { busy, submit, alert } = useSubmit(onDone);
  const add = (piece: Piece, suffix = "") => { setSelected((s) => s.includes(piece.id) ? s : [...s, piece.id]); setNote({ tone: "ok", text: `เพิ่ม ${piece.name} แล้ว${suffix}` }); };
  async function onScan() {
    const text = scan.trim(); setScan("");
    if (!text) return;
    if (text.includes("/l/")) {
      // A scanned QR is verified on the server: revoked label versions are rejected with the replacement shown.
      const response = await fetch(`/api/labels/lookup?code=${encodeURIComponent(text)}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setNote({ tone: "error", text: data?.message ?? "ตรวจสอบฉลากไม่สำเร็จ" }); return; }
      if (data.consignment.id !== d.id) { setNote({ tone: "error", text: `ฉลากนี้เป็นของรายการ ${data.consignment.code} ไม่ใช่รายการนี้` }); return; }
      if (data.state !== "CURRENT") { setNote({ tone: "error", text: `ฉลากฉบับที่ ${data.number} ถูกยกเลิกแล้ว${data.replacement ? ` กรุณาใช้ฉลากฉบับที่ ${data.replacement.number}` : " กรุณาติดต่อผู้วางแผนขนส่ง"}` }); return; }
      const piece = data.package ? d.packages.find((p) => p.id === data.package.id) : undefined;
      if (!piece) { setNote({ tone: "error", text: "คิวอาร์นี้ไม่ได้ระบุเลขบนฉลาก" }); return; }
      if (piece.custody !== "VEHICLE") { setNote({ tone: "error", text: `${piece.name} ไม่ได้อยู่บนรถ` }); return; }
      add(piece, ` (ฉลากฉบับที่ ${data.number})`); return;
    }
    // Typing the piece number printed large on the label ("2", or "2/3") is enough; the full code also works.
    const value = text.toUpperCase(), number = value.match(/^(\d{1,3})(?:\/\d{1,3})?$/);
    const match = d.packages.find((p) => number ? p.sequence === Number(number[1]) : p.code.toUpperCase() === value || p.id.toUpperCase() === value);
    if (!match) setNote({ tone: "error", text: `ไม่พบเลข “${text}” ในใบฝากนี้` });
    else if (match.custody !== "VEHICLE") setNote({ tone: "error", text: `${match.name} ไม่ได้อยู่บนรถ` });
    else add(match);
  }
  const lines = [...selected.map((packageId) => ({ packageId, quantity: "1", unit: "PACKAGE" })),
    ...(d.receiptMode === "DETAILED" ? d.items.flatMap((i) => quantities[i.id]?.trim() ? [{ itemId: i.id, quantity: quantities[i.id].trim(), unit: i.unit }] : []) : [])];
  return <PlanningDialog title={corrective ? "รับของก่อนบันทึกรถออก (ผู้วางแผนขนส่ง)" : `สาขารับของ ${d.code}`} onClose={onClose} busy={busy}>
    <p className="dialog-lead">{corrective ? "ใช้เมื่อรถออกจริงแล้วแต่ไม่มีการบันทึกรถออก ระบบจะบันทึกเป็นการแก้ไขพร้อมเหตุผล" : `รับที่ ${d.branch.name} เลือกเฉพาะที่ได้รับจริง ส่วนที่ยังไม่มาถึงรับภายหลังได้`}</p>
    <div className="inline-form"><label><ScanLine size={16} aria-hidden="true" className="inline-icon" />สแกนคิวอาร์ หรือพิมพ์เลขบนฉลาก<input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void onScan(); } }} placeholder="เช่น 1" /></label><button type="button" className="secondary-button" onClick={() => void onScan()}>เพิ่ม</button></div>
    {note && <p className={note.tone === "ok" ? "form-success" : "form-error"} role={note.tone === "ok" ? "status" : "alert"}>{note.text}</p>}
    <Checklist list={list} selected={selected} onChange={setSelected} />
    {d.receiptMode === "DETAILED" && <fieldset className="qty-fields"><legend>จำนวนข้างในที่รับ</legend>{d.items.map((i) => <label key={i.id}>{i.name} (ค้างรับ {Number(i.sent) - Number(i.received) - Number(i.returned)} {unitText(i.unit)})<span className="input-unit"><input value={quantities[i.id] ?? ""} inputMode="decimal" onChange={(e) => setQuantities((q) => ({ ...q, [i.id]: e.target.value }))} /><span>{unitText(i.unit)}</span></span></label>)}</fieldset>}
    {corrective && <Reason label="เหตุผลการแก้ไข" value={reason} onChange={setReason} />}
    {alert}
    <Footer onClose={onClose} busy={busy}><button type="button" className="primary-button" disabled={busy || lines.length === 0} onClick={() => void submit("receive", { consignmentId: d.id, expectedVersion: d.version, lines, ...(corrective ? { correctionReason: reason } : {}) }, "บันทึกรับของแล้ว")}>บันทึกรับของ</button></Footer>
  </PlanningDialog>;
}

function IssueDialog({ d, onClose, onDone }: DialogProps) {
  const [type, setType] = useState("SHORTAGE"), [selected, setSelected] = useState<string[]>([]), [description, setDescription] = useState("");
  const { busy, submit, alert } = useSubmit(onDone);
  return <PlanningDialog title={`แจ้งปัญหา ${d.code}`} onClose={onClose} busy={busy}>
    <p className="dialog-lead">รายการจะเปลี่ยนเป็น “พบปัญหา” จนกว่าผู้วางแผนขนส่งจะตรวจและแก้ไข ขั้นตอนที่ทำไปแล้วยังอยู่ครบ</p>
    <label>ประเภทปัญหา<select value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(issueTypes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <Checklist list={d.packages} selected={selected} onChange={setSelected} />
    <Reason label="รายละเอียดปัญหา" value={description} onChange={setDescription} />
    {alert}
    <Footer onClose={onClose} busy={busy}><button type="button" className="danger-button" disabled={busy} onClick={() => void submit("reportIssue", { id: d.id, expectedVersion: d.version, type, description, packageIds: selected }, "แจ้งปัญหาแล้ว")}>ยืนยันแจ้งปัญหา</button></Footer>
  </PlanningDialog>;
}

function ReturnDialog({ d, onClose, onDone }: DialogProps) {
  const list = d.packages.filter((p) => !p.received && !p.returned && p.custody !== "BRANCH");
  const [selected, setSelected] = useState<string[]>([]), [quantities, setQuantities] = useState<Record<string, string>>({}), [reason, setReason] = useState("");
  const { busy, submit, alert } = useSubmit(onDone);
  return <PlanningDialog title={`บันทึกส่งคืน ${d.code}`} onClose={onClose} busy={busy}>
    <p className="dialog-lead">ส่งคืนได้เฉพาะที่สาขายังไม่ได้รับ สิ่งที่ส่งคืนแล้วจะไม่นับเป็นจัดส่งสำเร็จ</p>
    <Checklist list={list} selected={selected} onChange={setSelected} />
    {d.receiptMode === "DETAILED" && <fieldset className="qty-fields"><legend>จำนวนข้างในที่ส่งคืน</legend>{d.items.map((i) => <label key={i.id}>{i.name}<span className="input-unit"><input value={quantities[i.id] ?? ""} inputMode="decimal" onChange={(e) => setQuantities((q) => ({ ...q, [i.id]: e.target.value }))} /><span>{unitText(i.unit)}</span></span></label>)}</fieldset>}
    <Reason label="เหตุผล" value={reason} onChange={setReason} />
    {alert}
    <Footer onClose={onClose} busy={busy}><button type="button" className="primary-button" disabled={busy} onClick={() => void submit("recordReturn", { id: d.id, expectedVersion: d.version, reason, packageIds: selected, items: d.items.flatMap((i) => quantities[i.id]?.trim() ? [{ itemId: i.id, quantity: quantities[i.id].trim() }] : []) }, "บันทึกส่งคืนแล้ว")}>ยืนยันส่งคืน</button></Footer>
  </PlanningDialog>;
}

function ReasonDialog({ d, onClose, onDone, kind }: DialogProps & { kind: "resolveIssue" | "cancel" }) {
  const [reason, setReason] = useState("");
  const { busy, submit, alert } = useSubmit(onDone), cancel = kind === "cancel";
  return <PlanningDialog title={cancel ? `ยกเลิกรายการ ${d.code}` : `ปิดปัญหา ${d.code}`} onClose={onClose} busy={busy}>
    <p className="dialog-lead">{cancel ? "รายการที่ยกเลิกแล้วเปิดกลับมาใช้ไม่ได้ ผู้ฝากจะเห็นเหตุผลนี้ในประวัติ" : "ยืนยันว่าตรวจและแก้ไขปัญหาแล้ว รายการจะกลับไปขั้นตอนเดิมตามจำนวนที่รับจริง"}</p>
    <Reason label={cancel ? "เหตุผลการยกเลิก" : "ผลการแก้ไข"} value={reason} onChange={setReason} />
    {alert}
    <Footer onClose={onClose} busy={busy}><button type="button" className={cancel ? "danger-button" : "primary-button"} disabled={busy} onClick={() => void submit(kind, { id: d.id, expectedVersion: d.version, reason }, cancel ? "ยกเลิกรายการแล้ว" : "ปิดปัญหาแล้ว")}>{cancel ? "ยืนยันยกเลิกรายการ" : "ยืนยันปิดปัญหา"}</button></Footer>
  </PlanningDialog>;
}

function CloseDialog({ d, onClose, onDone }: DialogProps) {
  const { busy, submit, alert } = useSubmit(onDone);
  const returned = d.packages.filter((p) => p.returned).length;
  return <PlanningDialog title={d.incomplete ? CLOSED_INCOMPLETE_LABEL : "ยืนยันจัดส่งสำเร็จ"} onClose={onClose} busy={busy}>
    <p className="dialog-lead">สาขารับแล้ว <strong>{d.receivedPackages} จาก {d.packages.length}</strong>{returned > 0 && ` · ส่งคืน ${returned}`}</p>
    <p>{d.incomplete ? "มีของที่ส่งคืน รายการนี้จะปิดเป็น “ปิดงาน (ส่งไม่ครบ)” และแก้ไขภายหลังไม่ได้" : "ยืนยันว่าของถึงสาขาครบถ้วน รายการนี้จะปิดเป็น “จัดส่งสำเร็จ” และแก้ไขภายหลังไม่ได้"}</p>
    {alert}
    <Footer onClose={onClose} busy={busy}><button type="button" className="primary-button" disabled={busy} onClick={() => void submit("close", { id: d.id, expectedVersion: d.version }, d.incomplete ? "ปิดงานแล้ว" : "จัดส่งสำเร็จ")}>{d.incomplete ? "ยืนยันปิดงาน" : "ยืนยันจัดส่งสำเร็จ"}</button></Footer>
  </PlanningDialog>;
}

export function ConsignmentActions({ d }: { d: ConsignmentDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState<Action | null>(null);
  const [message, setMessage] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);
  const can = (a: string) => d.actions.includes(a);
  const close = () => setOpen(null);
  const done = (text: string) => { setOpen(null); setMessage(text); router.refresh(); };
  const canCancel = can("cancelRequest") || can("cancelPending") || can("cancelAssigned");
  // One "ยกเลิกรายการ" entry however many cancel rules apply; the server picks the rule from the status.
  const cancelRules = ["cancelRequest", "cancelPending", "cancelAssigned"];
  const blocked = d.blockedActions.filter((b, index, all) => !cancelRules.includes(b.action) || (!canCancel && all.findIndex((x) => cancelRules.includes(x.action)) === index))
    // A reviewer may cancel up to warehouse receipt; say that once, instead of one line per underlying rule.
    .map((b) => cancelRules.includes(b.action) && d.blockedActions.some((x) => x.action === "cancelAssigned") ? { ...b, reason: "ยกเลิกได้ถึงขั้นคลังรับของเท่านั้น เมื่อของขึ้นรถแล้วให้ใช้ “แจ้งปัญหา” และบันทึกส่งคืน" } : b);
  const button = (action: Action, label: string, icon: ReactNode, tone: "primary-button" | "secondary-button" | "danger-button" = "primary-button") =>
    <button key={action} type="button" className={`${tone} action-button`} onClick={() => { setMessage(""); setOpen(action); }}>{icon}{label}</button>;
  const props = { d, onClose: close, onDone: done };

  return <div className="actions-wrap">
    {message && <p ref={messageRef} tabIndex={-1} className="form-success" role="status"><CheckCircle2 size={16} aria-hidden="true" className="inline-icon" />{message}</p>}
    {d.actions.length === 0 && <p className="muted">ไม่มีการดำเนินการที่คุณทำได้ในสถานะนี้</p>}
    <div className="action-buttons">
      {can("saveDraft") && <Link className="primary-button action-button" href={`/consign?id=${d.id}`}><Pencil size={17} aria-hidden="true" />แก้ไขและส่งคำขอ</Link>}
      {can("assign") && button("assign", "จัดรถ", <Truck size={17} aria-hidden="true" />)}
      {can("warehouseReceive") && button("warehouseReceive", "คลังรับของ", <Warehouse size={17} aria-hidden="true" />)}
      {can("load") && button("load", "ขึ้นรถ", <Truck size={17} aria-hidden="true" />)}
      {can("depart") && button("depart", "บันทึกรถออก", <Truck size={17} aria-hidden="true" />)}
      {can("receive") && button("receive", "สาขารับของ", <PackageCheck size={17} aria-hidden="true" />)}
      {can("resolveIssue") && button("resolveIssue", "ปิดปัญหา", <CheckCircle2 size={17} aria-hidden="true" />)}
      {can("close") && button("close", d.incomplete ? CLOSED_INCOMPLETE_LABEL : "ยืนยันจัดส่งสำเร็จ", <CheckCircle2 size={17} aria-hidden="true" />)}
      {can("reassign") && button("reassign", "ย้ายรอบรถ", <Truck size={17} aria-hidden="true" />, "secondary-button")}
      {can("correctiveReceive") && !can("receive") && button("correctiveReceive", "รับของก่อนบันทึกรถออก", <PackageCheck size={17} aria-hidden="true" />, "secondary-button")}
      {can("recordReturn") && button("recordReturn", "บันทึกส่งคืน", <Undo2 size={17} aria-hidden="true" />, "secondary-button")}
      {can("reportIssue") && button("reportIssue", "แจ้งปัญหา", <AlertTriangle size={17} aria-hidden="true" />, "secondary-button")}
      {canCancel && button("cancel", "ยกเลิกรายการ", <Ban size={17} aria-hidden="true" />, "danger-button")}
    </div>
    {blocked.length > 0 && <details className="action-panel blocked-actions"><summary>ขั้นตอนที่ยังดำเนินการไม่ได้</summary><ul>{blocked.map(({ action, reason }) => <li key={action}><button type="button" disabled aria-describedby={`blocked-${action}`}>{cancelRules.includes(action) ? "ยกเลิกรายการ" : action === "close" ? "ยืนยันจัดส่งสำเร็จ" : actionLabels[action]}</button><p id={`blocked-${action}`} className="muted small">{reason}</p></li>)}</ul></details>}
    <p className="muted small">ข้อมูลรุ่นที่ {d.version} หากมีผู้อื่นแก้ไขก่อน ระบบจะแจ้งให้โหลดหน้าใหม่</p>

    {open === "assign" && <AssignDialog {...props} move={false} />}
    {open === "reassign" && <AssignDialog {...props} move />}
    {(open === "warehouseReceive" || open === "load") && <HandoverDialog {...props} action={open} />}
    {open === "depart" && <DepartDialog {...props} />}
    {open === "receive" && <ReceiveDialog {...props} corrective={false} />}
    {open === "correctiveReceive" && <ReceiveDialog {...props} corrective />}
    {open === "reportIssue" && <IssueDialog {...props} />}
    {open === "recordReturn" && <ReturnDialog {...props} />}
    {(open === "resolveIssue" || open === "cancel") && <ReasonDialog {...props} kind={open} />}
    {open === "close" && <CloseDialog {...props} />}
  </div>;
}
