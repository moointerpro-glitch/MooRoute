"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, ScanLine } from "lucide-react";
import type { ConsignmentDetail } from "@/server/services/consignments";
import { actionLabels, issueTypes } from "@/server/domain/consignment";
import { unitText } from "@/lib/consignment-format";
import { beDate, isoFromBe, roundLabel } from "@/lib/trip-format";

type Trip = { tripId: string; code: string; routeName: string | null; roundNo: number | null; departureAt: string | null; eligible: boolean; reasons: string[]; capacity: { known: boolean; used: string | null; capacity: string | null; unit: string | null } | null; current: boolean };

async function post(action: string, input: unknown) {
  const response = await fetch("/api/consignments", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ action, input }) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data;
}
const clock = (iso: string | null) => iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) : "ยังไม่ระบุ";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="action-panel" aria-label={title}><h3>{title}</h3>{children}</section>;
}

export function ConsignmentActions({ d }: { d: ConsignmentDetail }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [scan, setScan] = useState("");
  const [issueType, setIssueType] = useState("SHORTAGE");
  const [dateText, setDateText] = useState(beDate(d.requested.serviceDate ?? new Date().toISOString().slice(0, 10)));
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [tripId, setTripId] = useState("");
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);
  const can = (a: string) => d.actions.includes(a);
  const base = { id: d.id, expectedVersion: d.version };

  async function run(action: string, input: unknown, done: string) {
    setBusy(true); setMessage(null);
    try { await post(action, input); setMessage({ tone: "ok", text: done }); setReason(""); setSelected([]); setQuantities({}); router.refresh(); }
    catch (e) { setMessage({ tone: "error", text: (e as Error).message }); } finally { setBusy(false); }
  }
  async function loadTrips() {
    const date = isoFromBe(dateText);
    if (!date) { setMessage({ tone: "error", text: "กรุณาระบุวันที่เป็น วัน/เดือน/ปี พ.ศ." }); return; }
    setTrips(null); setMessage(null);
    const response = await fetch(`/api/consignments/${d.id}/trips?date=${date}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setMessage({ tone: "error", text: data?.message ?? "โหลดรอบรถไม่สำเร็จ" }); return; }
    setTrips(data.trips); if (!data.published) setMessage({ tone: "error", text: "วันที่นี้ยังไม่มีแผนเดินรถที่เผยแพร่" });
  }
  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const packages = (custody: string[]) => d.packages.filter((p) => custody.includes(p.custody));
  function checklist(list: ConsignmentDetail["packages"], all = false) {
    return <fieldset className="package-checks"><legend>{all ? "ตรวจนับหีบห่อให้ครบทุกหีบห่อ" : "เลือกหีบห่อ"}</legend>
      {list.map((p) => <label key={p.id} className="check-row"><input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />{p.label}</label>)}
      {all && <button type="button" className="link-button" onClick={() => setSelected(list.map((p) => p.id))}>เลือกครบทุกหีบห่อ</button>}
    </fieldset>;
  }
  async function onScan() {
    if (scan.includes("/l/")) {
      // A scanned QR is verified on the server: revoked label versions are rejected with the replacement shown.
      const response = await fetch(`/api/labels/lookup?code=${encodeURIComponent(scan.trim())}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      setScan("");
      if (!response.ok) { setMessage({ tone: "error", text: data?.message ?? "ตรวจสอบฉลากไม่สำเร็จ" }); return; }
      if (data.consignment.id !== d.id) { setMessage({ tone: "error", text: `ฉลากนี้เป็นของรายการ ${data.consignment.code} ไม่ใช่รายการนี้` }); return; }
      if (data.state !== "CURRENT") { setMessage({ tone: "error", text: `ฉลากฉบับที่ ${data.number} ถูกยกเลิกแล้ว${data.replacement ? ` กรุณาใช้ฉลากฉบับที่ ${data.replacement.number}` : " กรุณาติดต่อผู้จัดรถ"}` }); return; }
      if (!data.package) { setMessage({ tone: "error", text: "คิวอาร์นี้ไม่ได้ระบุหีบห่อ" }); return; }
      if (data.package.custody !== "VEHICLE") { setMessage({ tone: "error", text: `หีบห่อ ${data.package.label} ไม่ได้อยู่บนรถ` }); return; }
      setSelected((s) => s.includes(data.package.id) ? s : [...s, data.package.id]); setMessage({ tone: "ok", text: `เพิ่ม ${data.package.label} แล้ว (ฉลากฉบับที่ ${data.number})` });
      return;
    }
    const value = scan.trim().toUpperCase(); if (!value) return;
    const match = d.packages.find((p) => p.label.toUpperCase() === value || p.id.toUpperCase() === value);
    if (!match) setMessage({ tone: "error", text: `ไม่พบหีบห่อ “${scan}” ในรายการนี้` });
    else if (match.custody !== "VEHICLE") setMessage({ tone: "error", text: `หีบห่อ ${match.label} ไม่ได้อยู่บนรถ` });
    else { setSelected((s) => s.includes(match.id) ? s : [...s, match.id]); setMessage({ tone: "ok", text: `เพิ่ม ${match.label} แล้ว` }); }
    setScan("");
  }
  const receiptLines = () => [...selected.map((packageId) => ({ packageId, quantity: "1", unit: "PACKAGE" })),
    ...(d.receiptMode === "DETAILED" ? d.items.flatMap((i) => quantities[i.id]?.trim() ? [{ itemId: i.id, quantity: quantities[i.id].trim(), unit: i.unit }] : []) : [])];
  const reasonField = (label = "เหตุผล", required = true) => <label className="reason-field">{label}{required && <span className="required">*</span>}<textarea value={reason} maxLength={500} rows={2} onChange={(e) => setReason(e.target.value)} /></label>;
  const currentTrip = d.assignments.find((a) => a.current);

  const outcome = message && <p ref={messageRef} tabIndex={-1} className={message.tone === "ok" ? "form-success" : "form-error"} role={message.tone === "ok" ? "status" : "alert"}>{message.tone === "ok" && <CheckCircle2 size={16} aria-hidden="true" className="inline-icon" />}{message.text}</p>;
  if (!d.actions.length) return <>{outcome}<p className="muted">ไม่มีการดำเนินการที่คุณทำได้ในสถานะนี้</p></>;
  return <div className="actions-wrap">
    {outcome}
    {can("saveDraft") && <Panel title="ฉบับร่าง"><p>แก้ไขรายละเอียดและส่งคำขอได้จากหน้าแบบฟอร์ม</p><Link className="primary-button" href={`/consign?id=${d.id}`}>แก้ไขและส่งคำขอ</Link></Panel>}
    {(can("assign") || can("reassign")) && <Panel title={can("assign") ? "จัดรถ" : "ย้ายรอบรถ"}>
      <div className="inline-form"><label>วันที่ให้บริการ (พ.ศ.)<input value={dateText} onChange={(e) => setDateText(e.target.value)} inputMode="numeric" /></label><button type="button" className="secondary-button" onClick={() => void loadTrips()}>แสดงรอบรถ</button></div>
      {trips && (trips.length ? <fieldset className="trip-options"><legend>รอบรถที่แวะส่ง {d.branch.name}</legend>{trips.map((t) => <label key={t.tripId} className={t.eligible ? "trip-option" : "trip-option disabled"}>
        <input type="radio" name="trip" value={t.tripId} disabled={!t.eligible || t.current} checked={tripId === t.tripId} onChange={() => setTripId(t.tripId)} />
        <span><strong>{t.routeName ?? t.code}</strong> · {roundLabel(t.roundNo)} · ออก {clock(t.departureAt)} น.{t.current ? " (รอบปัจจุบัน)" : ""}
          <small>{t.eligible ? (t.capacity?.known ? `น้ำหนักรวม ${t.capacity.used}/${t.capacity.capacity} ${unitText(t.capacity.unit ?? "")}` : "ไม่ทราบความจุหรือไม่มีน้ำหนักหีบห่อ จึงไม่ได้ตรวจความจุ") : t.reasons.join(" · ")}</small></span></label>)}</fieldset>
        : <p className="muted">ไม่มีรอบรถที่เผยแพร่ซึ่งแวะส่งสาขานี้ในวันที่เลือก</p>)}
      {reasonField(can("assign") ? "หมายเหตุการจัดรถ" : "เหตุผลการย้าย", can("reassign"))}
      <button type="button" className="primary-button" disabled={busy || !tripId} onClick={() => void run(can("assign") ? "assign" : "reassign", { ...base, tripId, reason: reason || undefined }, can("assign") ? "จัดรถแล้ว" : "ย้ายรอบรถแล้ว และยกเลิกฉลากเดิม")}>{can("assign") ? "จัดรถ" : "ย้ายรอบรถ"}</button>
    </Panel>}
    {can("warehouseReceive") && <Panel title="คลังรับของจากผู้ฝาก">{checklist(packages(["SENDER"]), true)}
      <button type="button" className="primary-button" disabled={busy} onClick={() => void run("warehouseReceive", { ...base, packageIds: selected }, "บันทึกคลังรับของแล้ว")}>ยืนยันคลังรับของ</button></Panel>}
    {can("load") && <Panel title="ขึ้นรถ"><p className="muted small">รอบรถ {currentTrip?.tripCode}</p>{checklist(packages(["WAREHOUSE"]), true)}
      <button type="button" className="primary-button" disabled={busy} onClick={() => void run("load", { ...base, packageIds: selected }, "บันทึกขึ้นรถแล้ว")}>ยืนยันขึ้นรถ</button></Panel>}
    {can("depart") && currentTrip && <Panel title="บันทึกรถออก"><p>บันทึกรถออกสำหรับทุกรายการที่ขึ้นรถแล้วในรอบ {currentTrip.tripCode} ซึ่งคุณมีสิทธิ์</p>
      <button type="button" className="primary-button" disabled={busy} onClick={() => void run("depart", { tripId: currentTrip.tripId }, "บันทึกรถออกแล้ว")}>บันทึกรถออกทั้งรอบ</button></Panel>}
    {(can("receive") || can("correctiveReceive")) && <Panel title={can("receive") ? "สาขารับของ" : "รับของก่อนบันทึกรถออก (หัวหน้างาน)"}>
      <div className="inline-form"><label><ScanLine size={16} aria-hidden="true" className="inline-icon" />สแกนหรือพิมพ์รหัสหีบห่อ<input value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void onScan(); } }} placeholder={d.packages[0]?.label} /></label><button type="button" className="secondary-button" onClick={() => void onScan()}>เพิ่ม</button></div>
      {checklist(packages(["VEHICLE"]))}
      {d.receiptMode === "DETAILED" && <fieldset className="qty-fields"><legend>จำนวนสิ่งของที่รับ</legend>{d.items.map((i) => <label key={i.id}>{i.name} (ค้างรับ {Number(i.sent) - Number(i.received) - Number(i.returned)} {unitText(i.unit)})<span className="input-unit"><input value={quantities[i.id] ?? ""} inputMode="decimal" onChange={(e) => setQuantities((q) => ({ ...q, [i.id]: e.target.value }))} /><span>{unitText(i.unit)}</span></span></label>)}</fieldset>}
      {!can("receive") && reasonField("เหตุผลการแก้ไข")}
      <button type="button" className="primary-button" disabled={busy || receiptLines().length === 0} onClick={() => void run("receive", { consignmentId: d.id, expectedVersion: d.version, lines: receiptLines(), ...(can("receive") ? {} : { correctionReason: reason }) }, "บันทึกรับของแล้ว")}>บันทึกรับของ</button>
    </Panel>}
    {can("reportIssue") && <Panel title="แจ้งปัญหา">
      <label>ประเภทปัญหา<select value={issueType} onChange={(e) => setIssueType(e.target.value)}>{Object.entries(issueTypes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {checklist(d.packages)}{reasonField("รายละเอียดปัญหา")}
      <button type="button" className="danger-button" disabled={busy} onClick={() => void run("reportIssue", { ...base, type: issueType, description: reason, packageIds: selected }, "แจ้งปัญหาแล้ว")}>แจ้งปัญหา</button></Panel>}
    {can("recordReturn") && <Panel title="บันทึกส่งคืน (หัวหน้างาน)">{checklist(d.packages.filter((p) => !p.received && !p.returned && p.custody !== "BRANCH"))}
      {d.receiptMode === "DETAILED" && <fieldset className="qty-fields"><legend>จำนวนสิ่งของที่ส่งคืน</legend>{d.items.map((i) => <label key={i.id}>{i.name}<span className="input-unit"><input value={quantities[i.id] ?? ""} inputMode="decimal" onChange={(e) => setQuantities((q) => ({ ...q, [i.id]: e.target.value }))} /><span>{unitText(i.unit)}</span></span></label>)}</fieldset>}
      {reasonField()}<button type="button" className="secondary-button" disabled={busy} onClick={() => void run("recordReturn", { ...base, reason, packageIds: selected, items: d.items.flatMap((i) => quantities[i.id]?.trim() ? [{ itemId: i.id, quantity: quantities[i.id].trim() }] : []) }, "บันทึกส่งคืนแล้ว")}>บันทึกส่งคืน</button></Panel>}
    {can("resolveIssue") && <Panel title="ปิดปัญหา (หัวหน้างาน)">{reasonField("ผลการแก้ไข")}<button type="button" className="primary-button" disabled={busy} onClick={() => void run("resolveIssue", { ...base, reason }, "ปิดปัญหาแล้ว")}>ปิดปัญหา</button></Panel>}
    {can("close") && <Panel title="ปิดงาน"><p className="muted small">ปิดได้เมื่อรับครบหรือบันทึกส่งคืนครบ และไม่มีปัญหาค้าง</p><button type="button" className="primary-button" disabled={busy} onClick={() => void run("close", base, "ปิดงานแล้ว")}>ปิดงาน</button></Panel>}
    {can("reject") && <Panel title="ไม่อนุมัติคำขอ">{reasonField()}<button type="button" className="danger-button" disabled={busy} onClick={() => void run("reject", { ...base, reason }, "ไม่อนุมัติคำขอแล้ว")}>ไม่อนุมัติ</button></Panel>}
    {(can("cancelRequest") || can("cancelAssigned")) && <Panel title={actionLabels[can("cancelRequest") ? "cancelRequest" : "cancelAssigned"]}>{reasonField()}<button type="button" className="danger-button" disabled={busy} onClick={() => void run("cancel", { ...base, reason }, "ยกเลิกรายการแล้ว")}>ยกเลิกรายการ</button></Panel>}
    <p className="muted small">ข้อมูลรุ่นที่ {d.version} หากมีผู้อื่นแก้ไขก่อน ระบบจะแจ้งให้โหลดหน้าใหม่</p>
  </div>;
}
