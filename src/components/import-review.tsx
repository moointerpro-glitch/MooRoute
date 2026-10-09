"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {AdminDialog} from "./admin-form-boundary";
import type { ImportDetail } from "@/server/services/imports";
import { newUuid } from "@/lib/new-uuid";

type Field = { name: string; label: string; required: boolean };
export const importActionLabels: Record<string, string> = { CREATE: "เพิ่มใหม่", UPDATE: "ปรับปรุงของเดิม", SKIP: "ข้าม", MERGED: "รวมกับแถวซ้ำ", BLOCKED: "ต้องแก้ไข", UNDECIDED: "รอตัดสินใจ" };
const tone: Record<string, string> = { CREATE: "tone-done", UPDATE: "tone-active", SKIP: "tone-muted", MERGED: "tone-muted", BLOCKED: "tone-alert", UNDECIDED: "tone-draft" };

export function ImportReview({ d, fields }: { d: ImportDetail; fields: Field[] }) {
  const router = useRouter();
  const [mappingOpen,setMappingOpen]=useState(false);
  const [confirmation,setConfirmation]=useState<{title:string;description:string;action:string;input:Record<string,unknown>;done:string}|null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>(d.mapping);
  const [busy, setBusy] = useState(false), [reason, setReason] = useState(""), [onlyProblems, setOnlyProblems] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);
  const open = d.status === "STAGED" || d.status === "VALIDATED";
  async function run(action: string, input: Record<string, unknown>, done: string) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/imports/${d.id}`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": newUuid() }, body: JSON.stringify({ action, input: { expectedVersion: d.version, ...input } }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "ดำเนินการไม่สำเร็จ");
      setMessage({ tone: "ok", text: done }); router.refresh();return true;
    } catch (e) { setMessage({ tone: "error", text: (e as Error).message });return false; } finally { setBusy(false); }
  }
  // A schedule template is decided as a whole, so one click applies to every row of its group.
  const groupRows = (row: ImportDetail["rows"][number]) => row.group ? d.rows.filter((r) => r.group === row.group).map((r) => r.rowNumber) : [row.rowNumber];
  const decide = (rowNumbers: number[], decision: string | null, done: string) => run("decide", { rowNumbers, decision }, done);
  const blocked = d.rows.filter((r) => r.action === "BLOCKED"), undecided = d.rows.filter((r) => r.action === "UNDECIDED");
  const visible = onlyProblems ? d.rows.filter((r) => ["BLOCKED", "UNDECIDED"].includes(r.action)) : d.rows;
  const s = d.summary;

  return <div className="import-review">
    {message && <p ref={messageRef} tabIndex={-1} className={message.tone === "ok" ? "form-success" : "form-error"} role={message.tone === "ok" ? "status" : "alert"}>{message.text}</p>}
    <section className="admin-card" aria-labelledby="summary-title"><h2 id="summary-title">สรุปผลการตรวจสอบ</h2>
      <ul className="import-summary">
        <li><strong>{s.rows}</strong> แถวในไฟล์</li>{s.groups !== null && <li><strong>{s.groups}</strong> แม่แบบ</li>}
        <li><strong>{s.create}</strong> เพิ่มใหม่</li><li><strong>{s.update}</strong> ปรับปรุง</li><li><strong>{s.merged}</strong> รวมกับแถวซ้ำ</li><li><strong>{s.skip}</strong> ข้าม</li>
        <li className={s.errors ? "bad" : undefined}><strong>{s.errors}</strong> ต้องแก้ไข</li><li className={s.undecided ? "bad" : undefined}><strong>{s.undecided}</strong> รอตัดสินใจ</li>
      </ul>
      {open && <div className="form-actions">
        <button type="button" className="primary-button" disabled={busy || d.status !== "VALIDATED"} onClick={() => setConfirmation({title:"ยืนยันนำเข้าข้อมูลจริง",description:`เพิ่ม ${s.create} รายการ ปรับปรุง ${s.update} รายการ และข้าม ${s.skip} รายการ การยืนยันจะเปลี่ยนข้อมูลในระบบตามผลตรวจชุดนี้`,action:"commit",input:{},done:"นำเข้าข้อมูลแล้ว"})}>นำเข้าจริง</button>
        {blocked.length > 0 && <button type="button" className="secondary-button" disabled={busy} onClick={() => void decide([...new Set(blocked.flatMap(groupRows))], "SKIP", "ข้ามแถวที่ผิดพลาดแล้ว")}>ข้ามแถวที่ต้องแก้ไขทั้งหมด ({blocked.length})</button>}
        {undecided.length > 0 && <button type="button" className="secondary-button" disabled={busy} onClick={() => void decide([...new Set(undecided.flatMap(groupRows))], "UPDATE", "เลือกปรับปรุงรายการซ้ำแล้ว")}>ปรับปรุงรายการที่มีอยู่แล้วทั้งหมด ({undecided.length})</button>}
      </div>}
      {open && d.status !== "VALIDATED" && <p className="field-error">ยังนำเข้าไม่ได้ จนกว่าจะไม่มีแถวที่ต้องแก้ไขหรือรอตัดสินใจ แก้ไฟล์ต้นทางแล้วอัปโหลดเป็นชุดใหม่ หรือเลือกข้ามแถวนั้น</p>}
    </section>

    {open&&<section className="admin-card admin-heading"><div><h2>จับคู่คอลัมน์</h2><p className="muted">จับคู่แล้ว {Object.values(d.mapping).filter(Boolean).length} ช่อง · เปิดหน้าต่างเพื่อตรวจหรือแก้ไข</p></div><button className="secondary-button" disabled={busy} onClick={()=>{setMapping(d.mapping);setMessage(null);setMappingOpen(true);}}>แก้ไขการจับคู่คอลัมน์</button></section>}
    {mappingOpen&&<AdminDialog title="จับคู่คอลัมน์" busy={busy} onClose={()=>{setMapping(d.mapping);setMappingOpen(false);}}><fieldset disabled={busy} className="admin-form-fields">
      <p className="muted">เลือกคอลัมน์ในไฟล์ให้ตรงกับช่องข้อมูลที่อนุญาต คอลัมน์อื่นจะเก็บไว้เป็นหลักฐานแต่ไม่ถูกนำไปใช้</p>
      <div className="mapping-grid">{fields.map((f) => <label key={f.name}>{f.label}{f.required && <span className="required">*</span>}
        <select value={mapping[f.name] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f.name]: e.target.value || null }))}><option value="">ไม่ใช้</option>{d.headers.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>)}</div>
      <button type="button" className="secondary-button" disabled={busy} onClick={async()=>{if(await run("remap",{mapping},"ตรวจสอบใหม่ตามการจับคู่แล้ว"))setMappingOpen(false);}}>บันทึกการจับคู่และตรวจสอบอีกครั้ง</button>
{message?.tone==="error"&&<p className="form-error" role="alert">{message.text}</p>}<button type="button" className="secondary-button" disabled={busy} onClick={()=>{setMapping(d.mapping);setMappingOpen(false);}}>ยกเลิกการจับคู่</button></fieldset></AdminDialog>}

    <section className="admin-card" aria-labelledby="rows-title"><div className="admin-heading"><h2 id="rows-title">ข้อมูลรายแถว</h2>
      <label className="checkbox-label"><input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />แสดงเฉพาะแถวที่ต้องจัดการ</label></div>
      <div className="table-scroll" role="region" aria-label="ตารางข้อมูลรายแถว เลื่อนแนวนอนได้" tabIndex={0}><table className="admin-table import-table">
        <thead><tr><th scope="col">แถว</th><th scope="col">ผล</th><th scope="col">ข้อมูลต้นทาง</th><th scope="col">รายละเอียด</th>{open && <th scope="col">ตัดสินใจ</th>}</tr></thead>
        <tbody>{visible.map((r) => <tr key={r.rowNumber}>
          <th scope="row">{r.rowNumber}</th>
          <td><span className={`status-pill ${tone[r.action] ?? "tone-muted"}`}>{importActionLabels[r.action] ?? r.action}</span></td>
          <td className="source-cells">{d.headers.slice(0, 6).map((h) => r.cells[h]).filter(Boolean).join(" · ") || "—"}</td>
          <td>{r.errors?.length > 0 && <ul className="row-errors">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            {r.duplicate && <p className="row-note">{r.duplicate.info}</p>}{r.notes?.map((n) => <p key={n} className="row-note">{n}</p>)}</td>
          {open && <td className="row-decide">
            {r.duplicate?.type === "EXISTING" && r.action !== "BLOCKED" && <button type="button" className="link-button" disabled={busy} onClick={() => void decide(groupRows(r), "UPDATE", `เลือกปรับปรุงแถว ${r.rowNumber}`)}>ปรับปรุง</button>}
            {r.action !== "SKIP" && r.action !== "MERGED" && r.action !== "CREATE" && <button type="button" className="link-button" disabled={busy} onClick={() => void decide(groupRows(r), "SKIP", `ข้ามแถว ${r.rowNumber}`)}>ข้าม</button>}
            {r.decision && <button type="button" className="link-button" disabled={busy} onClick={() => void decide(groupRows(r), null, `ล้างการตัดสินใจแถว ${r.rowNumber}`)}>ล้าง</button>}
          </td>}
        </tr>)}</tbody>
      </table></div>
      {visible.length === 0 && <p className="empty-list">ไม่มีแถวที่ต้องจัดการ</p>}
    </section>

    {open && <section className="admin-card" aria-labelledby="reject-title"><h2 id="reject-title">ยกเลิกชุดนำเข้านี้</h2>
      <label className="reason-field">เหตุผล<span className="required">*</span><input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></label>
      <button type="button" className="danger-button" disabled={busy} onClick={() => {if(reason.trim().length<3){setMessage({tone:"error",text:"กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร"});return;}setConfirmation({title:"ยืนยันยกเลิกชุดนำเข้า",description:"ชุดนี้จะไม่ถูกนำเข้าข้อมูลจริง หลักฐานและประวัติการตรวจสอบยังเก็บไว้",action:"reject",input:{reason},done:"ยกเลิกชุดนำเข้าแล้ว"});}}>ยกเลิกชุดนี้ (ไม่นำเข้า)</button>
    </section>}
  {confirmation&&<AdminDialog title={confirmation.title} busy={busy} onClose={()=>setConfirmation(null)}><p>{confirmation.description}</p>{message?.tone==="error"&&<p className="form-error" role="alert">{message.text}</p>}<div className="dialog-actions"><button className="secondary-button" disabled={busy} onClick={()=>setConfirmation(null)}>กลับไปตรวจสอบ</button><button className="primary-button" disabled={busy} onClick={async()=>{if(await run(confirmation.action,confirmation.input,confirmation.done))setConfirmation(null);}}>ยืนยันดำเนินการ</button></div></AdminDialog>}
  </div>;
}
