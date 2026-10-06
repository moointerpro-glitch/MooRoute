"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

type Kind = { value: string; title: string };

export function ImportUpload({ kinds }: { kinds: Kind[] }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function submit(form: HTMLFormElement) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/imports", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: new FormData(form) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setMessage(data?.message ?? "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง"); return; }
      window.location.assign(`/admin/imports/${data.batchId}${data.existing ? "?existing=1" : ""}`);
    } catch { setMessage("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง"); } finally { setBusy(false); }
  }
  return <form className="admin-form import-upload" onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget); }}>
    <div className="form-grid">
      <label>ประเภทข้อมูล<span className="required">*</span><select name="kind" required defaultValue={kinds[0]?.value}>{kinds.map((k) => <option key={k.value} value={k.value}>{k.title}</option>)}</select></label>
      <label>ชุดหรือวันที่ของเอกสารอ้างอิง<span className="required">*</span><input name="edition" required minLength={3} maxLength={100} placeholder="เช่น ใบจัดรถ 02/10/2569" /></label>
    </div>
    <label>ไฟล์ CSV หรือ XLSX (ไม่เกิน 2 MB, 500 แถว)<span className="required">*</span><input name="file" type="file" required accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /></label>
    <p className="muted">ไฟล์จะถูกพักไว้ให้ตรวจสอบก่อน ยังไม่มีการเปลี่ยนข้อมูลจริงจนกว่าจะกด “นำเข้าจริง” ไฟล์เดียวกันในชุดเดียวกันจะเปิดชุดเดิม ไม่สร้างข้อมูลซ้ำ ไฟล์ PDF และรูปภาพเป็นเอกสารอ้างอิง ต้องถอดความลงแม่แบบและตรวจทานก่อน</p>
    {message && <p className="form-error" role="alert">{message}</p>}
    <button className="primary-button" disabled={busy}><Upload size={18} aria-hidden="true" />{busy ? "กำลังอัปโหลด…" : "อัปโหลดเพื่อตรวจสอบ"}</button>
  </form>;
}
