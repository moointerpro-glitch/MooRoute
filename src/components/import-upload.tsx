"use client";

import { useState } from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {AdminFormBoundary} from "./admin-form-boundary";
import { ArrowLeft, Upload } from "lucide-react";
import { newUuid } from "@/lib/new-uuid";

type Kind = { value: string; title: string };

export function ImportUpload({ kinds }: { kinds: Kind[] }) {
  const router=useRouter(),[dirty,setDirty]=useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [fileName,setFileName]=useState("");
  async function submit(form: HTMLFormElement) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/imports", { method: "POST", headers: { "Idempotency-Key": newUuid() }, body: new FormData(form) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setMessage(data?.message ?? "อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง"); return; }
      setDirty(false);router.push(`/admin/imports/${data.batchId}${data.existing ? "?existing=1" : ""}`);
    } catch { setMessage("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง"); } finally { setBusy(false); }
  }
  return <AdminFormBoundary dirty={dirty} busy={busy} onDirty={()=>setDirty(true)} backHref="/admin/imports"><form className="admin-form import-upload" onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget); }}><fieldset disabled={busy} className="admin-form-fields">
    <div className="form-grid">
      <label><span>ประเภทข้อมูล<span className="required">*</span></span><select name="kind" required defaultValue={kinds[0]?.value}>{kinds.map((k) => <option key={k.value} value={k.value}>{k.title}</option>)}</select></label>
      <label><span>ชุดหรือวันที่ของเอกสารอ้างอิง<span className="required">*</span></span><input name="edition" required minLength={3} maxLength={100} placeholder="เช่น ใบจัดรถ 02/10/2569" /></label>
    </div>
    <label className="admin-file-picker"><span>ไฟล์ CSV หรือ XLSX (ไม่เกิน 2 MB, 500 แถว)<span className="required">*</span></span><span className="admin-file-control"><span className="secondary-button">เลือกไฟล์</span><span aria-live="polite">{fileName||"ยังไม่ได้เลือกไฟล์"}</span><input name="file" type="file" required accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>setFileName(e.target.files?.[0]?.name??"")} /></span></label>
    <p className="muted">ไฟล์จะถูกพักไว้ให้ตรวจสอบก่อน ยังไม่มีการเปลี่ยนข้อมูลจริงจนกว่าจะกด “นำเข้าจริง” ไฟล์เดียวกันในชุดเดียวกันจะเปิดชุดเดิม ไม่สร้างข้อมูลซ้ำ ไฟล์ PDF และรูปภาพเป็นเอกสารอ้างอิง ต้องถอดความลงแม่แบบและตรวจทานก่อน</p>
    {message && <p className="form-error" role="alert">{message}</p>}
    <div className="form-actions admin-editor-footer"><Link href="/admin/imports" className="secondary-button admin-back-button"><ArrowLeft size={18} aria-hidden="true"/>กลับประวัติชุดนำเข้า</Link><button className="primary-button" disabled={busy}><Upload size={18} aria-hidden="true" />{busy ? "กำลังอัปโหลด…" : "อัปโหลดเพื่อตรวจสอบ"}</button>
  </div></fieldset></form></AdminFormBoundary>;
}
