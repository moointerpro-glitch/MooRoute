"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, PackagePlus, Plus, Send, Save, Trash2, Truck, UserRound } from "lucide-react";
import { itemUnits, LEGACY_PACKAGING, PACKAGING_LIMITS, packagingContents, packagingCountText, packagingKinds, packagingTotal, quantityPattern, receiptModeLabels, submissionProblems, type PackagingLine } from "@/server/domain/consignment";
import { beDate, roundLabel, thaiLongDate } from "@/lib/trip-format";
import { blankPackRow, type PackRow } from "@/lib/consignment-format";
import { parseThaiDate } from "@/lib/date-input";
import { DateInput } from "./date-time-inputs";
import { newUuid } from "@/lib/new-uuid";

type Option = { id: string; code: string; name: string };
type BranchOption = Option & { contactName: string | null; contactPhone: string | null; hasRecipient: boolean };
export type ConsignOptions = { departments: Option[]; warehouses: Option[]; categories: Option[]; branches: BranchOption[]; senderName: string; senderPhone: string; defaultWarehouseId: string };
const untouched = (r: PackRow) => !r.kind && !r.customName.trim() && !r.count.trim() && !r.name.trim() && !r.quantity.trim() && !r.unit && !r.description.trim();
const toLine = (r: PackRow): PackagingLine => ({ kind: r.kind, customName: r.kind === "OTHER" ? r.customName.trim() || null : null, count: /^\d{1,3}$/.test(r.count.trim()) ? Number(r.count.trim()) : 0,
  name: r.name.trim() || null, quantity: r.quantity.trim() || null, unit: r.unit || null, description: r.description.trim() || null, weight: null });
export type ConsignInitial = {
  id: string | null; code: string | null; version: number; departmentId: string; sourceWarehouseId: string; destinationBranchId: string; requestedServiceDate: string;
  requestedRoundNo: number | null; requestedTripId: string | null; tripLabel: string | null; tripProblems: string[];
  senderName: string; senderPhone: string; recipientName: string; recipientPhone: string; notes: string; receiptMode: "PACKAGES" | "DETAILED";
  categoryId: string; packaging: PackRow[]; attachments: { id: string; name: string; size: number }[];
  /** Items of a draft made with the earlier form that could not be placed on a row; shown so they can be typed in. */
  unplacedItems: string[];
};

async function post(action: string, input: unknown) {
  const response = await fetch("/api/consignments", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": newUuid() }, body: JSON.stringify({ action, input }) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data;
}

export function ConsignForm({ options, initial, today }: { options: ConsignOptions; initial: ConsignInitial; today: string }) {
  const [form, setForm] = useState(initial);
  const [dateText, setDateText] = useState(initial.requestedServiceDate ? beDate(initial.requestedServiceDate) : "");
  const [busy, setBusy] = useState<"" | "save" | "submit" | "upload">("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [countConfirmed, setCountConfirmed] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);
  const set = <K extends keyof ConsignInitial>(key: K, value: ConsignInitial[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setPack = (index: number, change: Partial<PackRow>) => { setCountConfirmed(false); setForm((f) => ({ ...f, packaging: f.packaging.map((row, i) => i === index ? { ...row, ...change } : row) })); };
  // Rows left completely empty are ignored; a partly filled row is reported so nothing is dropped silently.
  const lines = useMemo(() => form.packaging.filter((r) => !untouched(r)).map(toLine), [form.packaging]);
  const total = packagingTotal(lines), needsConfirm = total > PACKAGING_LIMITS.confirmAbove, counted = lines.some((l) => l.quantity);
  const rowProblems = useMemo(() => form.packaging.flatMap((r, i) => untouched(r) ? [] : [
    ...(r.kind ? [] : [`แถวที่ ${i + 1}: กรุณาเลือกบรรจุภัณฑ์`]),
    ...(r.kind === "OTHER" && !r.customName.trim() ? [`แถวที่ ${i + 1}: กรุณาพิมพ์ชื่อบรรจุภัณฑ์`] : []),
    ...(/^\d{1,3}$/.test(r.count.trim()) && Number(r.count) >= 1 && Number(r.count) <= PACKAGING_LIMITS.pieces ? [] : [`แถวที่ ${i + 1}: จำนวนต้องเป็นตัวเลข 1 ถึง ${PACKAGING_LIMITS.pieces}`]),
    ...(!r.quantity.trim() || (quantityPattern.test(r.quantity.trim()) && Number(r.quantity) > 0) ? [] : [`แถวที่ ${i + 1}: จำนวนข้างในต้องเป็นตัวเลขมากกว่าศูนย์ หรือเว้นว่าง`]),
    ...(!!r.quantity.trim() === !!r.unit ? [] : [`แถวที่ ${i + 1}: กรุณากรอกจำนวนข้างในและหน่วยให้ครบคู่ หรือเว้นว่างทั้งสองช่อง`]),
  ]), [form.packaging]);
  const branch = options.branches.find((b) => b.id === form.destinationBranchId);
  const requestedDate = parseThaiDate(dateText);
  const receiptMode = counted ? form.receiptMode : "PACKAGES";
  const problems = useMemo(() => [...(options.departments.some(d=>d.id===form.departmentId)?[]:["กรุณาเลือกแผนกผู้ส่งที่เปิดใช้งาน"]), ...rowProblems,
    ...(total > PACKAGING_LIMITS.pieces ? [`จำนวนรวมต้องไม่เกิน ${PACKAGING_LIMITS.pieces} ต่อหนึ่งคำขอ กรุณาแยกเป็นหลายคำขอ`] : []),
    ...submissionProblems({ items: [], packaging: lines, receiptMode, categoryId: options.categories.some((c) => c.id === form.categoryId) ? form.categoryId : null, senderName: form.senderName.trim() || null, senderPhone: form.senderPhone.trim() || null, requestedServiceDate: requestedDate }, today,
    !!(branch?.hasRecipient || ((form.recipientName.trim() || branch?.contactName) && (form.recipientPhone.trim() || branch?.contactPhone))))], [form, lines, total, receiptMode, rowProblems, requestedDate, today, branch, options.departments, options.categories]);

  function payload() {
    if(!options.departments.some(d=>d.id===form.departmentId))throw new Error("กรุณาเลือกแผนกผู้ส่งที่เปิดใช้งาน");
    if (dateText.trim() && !requestedDate) throw new Error("กรุณาระบุวันที่ต้องการส่งเป็น วัน/เดือน/ปี พ.ศ.");
    return { id: form.id, expectedVersion: form.version, departmentId: form.departmentId, sourceWarehouseId: form.sourceWarehouseId, destinationBranchId: form.destinationBranchId,
      requestedServiceDate: requestedDate, requestedRoundNo: form.requestedRoundNo, requestedTripId: form.requestedTripId,
      senderName: form.senderName, senderPhone: form.senderPhone, recipientName: form.recipientName, recipientPhone: form.recipientPhone, notes: form.notes,
      receiptMode, categoryId: form.categoryId || null, packaging: lines };
  }
  async function save(): Promise<{ id: string; version: number }> {
    const result = await post("saveDraft", payload());
    setForm((f) => ({ ...f, id: result.id, version: result.version, code: result.code }));
    window.history.replaceState(null, "", `/consign?id=${result.id}`);
    return result;
  }
  async function onSave() {
    setBusy("save"); setMessage(null);
    try { const r = await save(); setMessage({ tone: "ok", text: `บันทึกฉบับร่างแล้ว (รุ่น ${r.version})` }); }
    catch (e) { setMessage({ tone: "error", text: (e as Error).message }); } finally { setBusy(""); }
  }
  async function onSubmit() {
    setBusy("submit"); setMessage(null);
    try {
      const saved = await save();
      await post("submit", { id: saved.id, expectedVersion: saved.version });
      window.location.assign(`/consignments/${saved.id}?submitted=1`);
    } catch (e) { setMessage({ tone: "error", text: (e as Error).message }); setBusy(""); }
  }
  async function onUpload(file: File | null) {
    if (!file || !form.id) return;
    setBusy("upload"); setMessage(null);
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch(`/api/consignments/${form.id}/attachments`, { method: "POST", headers: { "Idempotency-Key": newUuid() }, body });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "แนบไฟล์ไม่สำเร็จ");
      set("attachments", [...form.attachments, { id: data.id, name: file.name, size: file.size }]);
      setMessage({ tone: "ok", text: "แนบไฟล์แล้ว" });
    } catch (e) { setMessage({ tone: "error", text: (e as Error).message }); } finally { setBusy(""); }
  }

  return <form className="consign-form" onSubmit={(e) => { e.preventDefault(); void onSubmit(); }} noValidate>
    <section className="form-section" aria-labelledby="sec-sender"><h2 id="sec-sender"><UserRound size={19} aria-hidden="true" />ผู้ฝากและต้นทาง</h2>
      <div className="form-grid">
        <label><span>แผนกผู้ส่ง<span className="required">*</span></span><select value={form.departmentId} onChange={(e) => set("departmentId", e.target.value)} required aria-describedby="sender-department-hint">
          <option value="">เลือกแผนกผู้ส่งสำหรับครั้งนี้</option>{form.departmentId&&!options.departments.some(d=>d.id===form.departmentId)&&<option value={form.departmentId} disabled>แผนกเดิมปิดใช้งานแล้ว กรุณาเลือกใหม่</option>}{options.departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}</select><span id="sender-department-hint" className="field-hint">เลือกใหม่ได้ในแต่ละครั้ง ไม่ต้องผูกกับบัญชี ผู้มีสิทธิ์ดูรายการของแผนกที่เลือกจะเห็นคำขอนี้หลังส่ง</span></label>
        <label>คลังต้นทาง<span className="required">*</span><select value={form.sourceWarehouseId} onChange={(e) => set("sourceWarehouseId", e.target.value)} required>
          <option value="">เลือกคลังต้นทาง</option>{options.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}</select></label>
        <label>ชื่อผู้ฝาก<span className="required">*</span><input value={form.senderName} maxLength={191} onChange={(e) => set("senderName", e.target.value)} autoComplete="name" /></label>
        <label>เบอร์ติดต่อผู้ฝาก<span className="required">*</span><input value={form.senderPhone} maxLength={32} inputMode="tel" onChange={(e) => set("senderPhone", e.target.value)} autoComplete="tel" /></label>
      </div>
      {!options.warehouses.length && <p className="field-error">ยังไม่มีคลังต้นทางที่ใช้งานได้ กรุณาติดต่อผู้ดูแลเพื่อเพิ่มข้อมูลคลัง</p>}
    </section>

    <section className="form-section" aria-labelledby="sec-destination"><h2 id="sec-destination"><Truck size={19} aria-hidden="true" />ปลายทางและรอบรถ</h2>
      <div className="form-grid">
        <label>สาขาปลายทาง<span className="required">*</span><select value={form.destinationBranchId} onChange={(e) => setForm((f) => ({ ...f, destinationBranchId: e.target.value, requestedTripId: null, tripLabel: null, tripProblems: [] }))} required>
          <option value="">เลือกสาขาปลายทาง</option>{options.branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</select></label>
        <label>วันที่ต้องการส่ง (พ.ศ.)<span className="required">*</span><DateInput value={dateText} onChange={setDateText} min={today} aria-describedby="date-hint" />
          <span id="date-hint" className="field-hint">{requestedDate ? thaiLongDate(requestedDate) : dateText ? "รูปแบบวันที่ไม่ถูกต้อง" : "เช่น " + beDate(today)}</span></label>
        <label>รอบที่ต้องการ<select value={form.requestedRoundNo ?? ""} onChange={(e) => set("requestedRoundNo", e.target.value ? Number(e.target.value) : null)}>
          <option value="">ไม่ระบุ ให้ผู้วางแผนขนส่งเลือก</option>{[1, 2, 3].map((r) => <option key={r} value={r}>{roundLabel(r)}</option>)}</select></label>
        <div className="trip-pick">
          <span className="field-label">รอบรถที่เลือกจากหน้าค้นหา</span>
          {form.requestedTripId ? <p className="picked-trip"><strong>{form.tripLabel ?? form.requestedTripId}</strong> <button type="button" className="link-button" onClick={() => setForm((f) => ({ ...f, requestedTripId: null, tripLabel: null, tripProblems: [] }))}>ไม่ระบุรอบรถ</button></p>
            : <p className="field-hint">ไม่ได้เลือก ผู้วางแผนขนส่งจะเลือกรอบรถที่เหมาะสมให้ <Link href="/">ค้นหารอบรถ</Link></p>}
          {form.tripProblems.length > 0 && <ul className="field-error reason-list" role="alert">{form.tripProblems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
        <label>ชื่อผู้รับ<input value={form.recipientName} maxLength={191} placeholder={branch?.contactName ?? (branch?.hasRecipient ? "เว้นว่างเพื่อใช้ผู้ติดต่อสาขาที่บันทึกไว้" : "ยังไม่มีผู้ติดต่อของสาขา")} onChange={(e) => set("recipientName", e.target.value)} /></label>
        <label>เบอร์ผู้รับ<input value={form.recipientPhone} maxLength={32} inputMode="tel" placeholder={branch?.contactPhone ?? (branch?.hasRecipient ? "เว้นว่างเพื่อใช้เบอร์สาขาที่บันทึกไว้" : "ยังไม่มีเบอร์ของสาขา")} onChange={(e) => set("recipientPhone", e.target.value)} /></label>
      </div>
      <p className="field-hint">หากเว้นว่าง ระบบจะใช้ผู้ติดต่อของสาขา และบันทึกข้อมูล ณ เวลาจัดรถไว้เป็นหลักฐาน</p>
    </section>

    <section className="form-section" aria-labelledby="sec-packaging"><h2 id="sec-packaging"><PackagePlus size={19} aria-hidden="true" />สิ่งที่ฝากส่ง<span className="required">*</span></h2>
      <p className="field-hint">กรอกทีละแถวตามของจริงที่จะส่งมอบ ระบบออกฉลากให้ตาม “จำนวน” ของแต่ละแถว เช่น กล่อง 3 ได้ฉลาก 3 ใบ</p>
      {form.unplacedItems.length > 0 && <p className="sample-help" role="note">ฉบับร่างนี้สร้างด้วยแบบฟอร์มเดิม มีรายการที่ยังไม่อยู่ในตาราง: {form.unplacedItems.join(", ")} กรุณากรอกลงในแถวที่ตรงกัน แล้วบันทึกอีกครั้ง</p>}
      <div className="form-grid">
        <label>หมวดสิ่งของ<span className="required">*</span><select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} aria-describedby="category-hint">
          <option value="">เลือกหมวดสิ่งของ</option>{form.categoryId && !options.categories.some((c) => c.id === form.categoryId) && <option value={form.categoryId} disabled>หมวดเดิมปิดใช้งานแล้ว กรุณาเลือกใหม่</option>}
          {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <span id="category-hint" className="field-hint">เลือกครั้งเดียวสำหรับทั้งใบฝาก ใช้ค้นหาและกรองรายการภายหลัง</span></label>
      </div>
      {!options.categories.length && <p className="field-error">ยังไม่มีหมวดสิ่งของที่ใช้งานได้ กรุณาติดต่อผู้ดูแลเพื่อเพิ่มหมวดสิ่งของสำหรับฝากส่ง</p>}
      <ol className="item-rows">{form.packaging.map((row, index) => <li key={index} className="pack-row">
        <div className="pack-kind">
          <label>บรรจุภัณฑ์<span className="required">*</span><select value={row.kind} onChange={(e) => setPack(index, { kind: e.target.value })} aria-label={`บรรจุภัณฑ์ของแถวที่ ${index + 1}`}>
            <option value="">เลือก</option>{row.kind === LEGACY_PACKAGING && <option value={LEGACY_PACKAGING}>หีบห่อ (ไม่ระบุชนิด)</option>}
            {Object.entries(packagingKinds).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {row.kind === "OTHER" && <label>ชื่อบรรจุภัณฑ์<input value={row.customName} maxLength={PACKAGING_LIMITS.customName} placeholder="เช่น ถัง แฟ้ม ตะกร้า" onChange={(e) => setPack(index, { customName: e.target.value })} aria-label={`ชื่อบรรจุภัณฑ์ของแถวที่ ${index + 1}`} /></label>}
        </div>
        <label>จำนวน<span className="required">*</span><input value={row.count} inputMode="numeric" onChange={(e) => setPack(index, { count: e.target.value.replace(/\D/g, "").slice(0, 3) })} aria-label={`จำนวนของแถวที่ ${index + 1}`} /></label>
        <label className="pack-name">ชื่อรายการ<span className="required">*</span><input value={row.name} maxLength={191} placeholder="ข้างในคืออะไร เช่น โปสเตอร์โปรโมชัน" onChange={(e) => setPack(index, { name: e.target.value })} aria-label={`ชื่อรายการของแถวที่ ${index + 1}`} /></label>
        <label>จำนวนข้างใน<input value={row.quantity} inputMode="decimal" placeholder="ไม่บังคับ" onChange={(e) => setPack(index, { quantity: e.target.value })} aria-label={`จำนวนข้างในของแถวที่ ${index + 1}`} /></label>
        <label>หน่วย<select value={row.unit} onChange={(e) => setPack(index, { unit: e.target.value })} aria-label={`หน่วยของแถวที่ ${index + 1}`}>
          <option value="">—</option>{Object.entries(itemUnits).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="pack-note">รายละเอียด<input value={row.description} maxLength={PACKAGING_LIMITS.description} placeholder="หมายเหตุ เช่น ระวังพับ" onChange={(e) => setPack(index, { description: e.target.value })} aria-label={`รายละเอียดของแถวที่ ${index + 1}`} /></label>
        <button type="button" className="icon-action" aria-label={`ลบแถวที่ ${index + 1}`} disabled={form.packaging.length === 1} onClick={() => { setCountConfirmed(false); set("packaging", form.packaging.filter((_, i) => i !== index)); }}><Trash2 size={18} aria-hidden="true" /></button>
      </li>)}</ol>
      <div className="pack-foot">
        <button type="button" className="secondary-button" disabled={form.packaging.length >= PACKAGING_LIMITS.lines} onClick={() => set("packaging", [...form.packaging, { ...blankPackRow }])}><Plus size={17} aria-hidden="true" />เพิ่มแถว</button>
        <p className="pack-total" role="status">{total > 0 ? <strong>{packagingCountText(lines)}</strong> : "ยังไม่ได้ระบุสิ่งที่ฝากส่ง"}</p>
      </div>
      {counted && <label className="check-row"><input type="checkbox" checked={form.receiptMode === "DETAILED"} onChange={(e) => set("receiptMode", e.target.checked ? "DETAILED" : "PACKAGES")} />ให้สาขานับจำนวนข้างในตอนรับของด้วย (เปลี่ยนไม่ได้หลังส่งคำขอ)</label>}
      <label className="notes-field">หมายเหตุถึงคลังและสาขา<textarea value={form.notes} maxLength={1000} rows={3} onChange={(e) => set("notes", e.target.value)} /></label>
    </section>

    <section className="form-section" aria-labelledby="sec-files"><h2 id="sec-files"><FileUp size={19} aria-hidden="true" />เอกสารแนบ</h2>
      {form.id ? <>
        <label className="file-input">เลือกไฟล์ JPG, PNG หรือ PDF (ไม่เกิน 10 MB, สูงสุด 5 ไฟล์)<input type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy !== "" || form.attachments.length >= 5} onChange={(e) => { void onUpload(e.target.files?.[0] ?? null); e.target.value = ""; }} /></label>
        {form.attachments.length > 0 && <ul className="attachment-list">{form.attachments.map((a) => <li key={a.id}><a href={`/api/attachments/${a.id}`}>{a.name}</a> <span className="muted small">{Math.ceil(a.size / 1024).toLocaleString("th-TH")} KB</span></li>)}</ul>}
      </> : <p className="field-hint">บันทึกฉบับร่างก่อน จึงจะแนบไฟล์ได้ ไฟล์จะเก็บเป็นส่วนตัวและเปิดได้เฉพาะผู้มีสิทธิ์</p>}
    </section>

    <section className="form-section review" aria-labelledby="sec-review"><h2 id="sec-review"><CheckCircle2 size={19} aria-hidden="true" />ตรวจสอบก่อนส่ง</h2>
      <dl className="fact-list">
        <div><dt>แผนกผู้ส่ง</dt><dd>{options.departments.find(d=>d.id===form.departmentId)?.name ?? "ยังไม่เลือกแผนกที่เปิดใช้งาน"}</dd></div>
        <div><dt>ปลายทาง</dt><dd>{branch ? `${branch.name} (${branch.code})` : "ยังไม่เลือก"}</dd></div>
        <div><dt>วันที่ / รอบ</dt><dd>{requestedDate ? thaiLongDate(requestedDate) : "ยังไม่ระบุ"} · {form.requestedRoundNo ? roundLabel(form.requestedRoundNo) : "ไม่ระบุรอบ"}</dd></div>
        <div><dt>หมวดสิ่งของ</dt><dd>{options.categories.find((c) => c.id === form.categoryId)?.name ?? "ยังไม่เลือก"}</dd></div>
        <div><dt>สิ่งที่ฝากส่ง</dt><dd>{total > 0 ? packagingCountText(lines) : "ยังไม่ระบุ"}</dd></div>
        {packagingContents(lines).length > 0 && <div><dt>ข้างใน</dt><dd>{packagingContents(lines).join(", ")}</dd></div>}
        <div><dt>การตรวจรับ</dt><dd>{receiptModeLabels[receiptMode]}</dd></div>
      </dl>
      {needsConfirm && problems.length === 0 && <label className="check-row count-confirm"><input type="checkbox" checked={countConfirmed} onChange={(e) => setCountConfirmed(e.target.checked)} />จำนวนรวม {total.toLocaleString("th-TH")} ถูกต้อง ระบบจะออกฉลาก {total.toLocaleString("th-TH")} ใบ</label>}
      {problems.length > 0 ? <ul className="problem-list" aria-label="สิ่งที่ต้องแก้ก่อนส่งคำขอ">{problems.map((p) => <li key={p}><AlertCircle size={15} aria-hidden="true" />{p}</li>)}</ul>
        : <p className="ok-line"><CheckCircle2 size={16} aria-hidden="true" />ข้อมูลครบ พร้อมส่งให้ผู้วางแผนขนส่งตรวจสอบ</p>}
      {message && <p ref={messageRef} tabIndex={-1} className={message.tone === "ok" ? "form-success" : "form-error"} role={message.tone === "ok" ? "status" : "alert"}>{message.text}</p>}
      <div className="form-actions">
        <button type="button" className="secondary-button" disabled={busy !== ""} onClick={() => void onSave()}><Save size={17} aria-hidden="true" />{busy === "save" ? "กำลังบันทึก…" : "บันทึกฉบับร่าง"}</button>
        <button type="submit" className="primary-button" disabled={busy !== "" || problems.length > 0 || (needsConfirm && !countConfirmed)}><Send size={17} aria-hidden="true" />{busy === "submit" ? "กำลังส่ง…" : "ส่งคำขอ"}</button>
      </div>
      {form.code && <p className="muted small">เลขที่ฉบับร่าง {form.code}</p>}
    </section>
  </form>;
}
