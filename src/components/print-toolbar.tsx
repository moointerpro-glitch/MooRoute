"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { newUuid } from "@/lib/new-uuid";

type Props = { labelVersionId?: string; format: string; printed: number; formats: { value: string; label: string; href: string }[]; back: { href: string; label: string } };

/** Screen-only controls. A production print is recorded on the server before the browser print dialog opens. */
export function PrintToolbar({ labelVersionId, format, printed, formats, back }: Props) {
  const [reason, setReason] = useState(""), [copies, setCopies] = useState("1"), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function print() {
    setMessage("");
    if (!labelVersionId) { window.print(); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": newUuid() }, body: JSON.stringify({ action: "print", input: { labelVersionId, format, copies: Number(copies) || 1, reason: reason || undefined } }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setMessage(data?.message ?? "บันทึกการพิมพ์ไม่สำเร็จ"); return; }
      window.print();
    } catch { setMessage("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง"); } finally { setBusy(false); }
  }
  return <div className="print-toolbar no-print">
    <Link className="secondary-button print-back" href={back.href}><ArrowLeft size={17} aria-hidden="true" />{back.label}</Link>
    {formats.length > 0 && <nav className="format-switch" aria-label="รูปแบบการพิมพ์">{formats.map((f) => <Link key={f.value} href={f.href} aria-current={f.value === format ? "page" : undefined} className={f.value === format ? "secondary-button selected" : "secondary-button"}>{f.label}</Link>)}</nav>}
    {labelVersionId && <label>จำนวนชุด<input value={copies} inputMode="numeric" onChange={(e) => setCopies(e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>}
    {labelVersionId && printed > 0 && <label className="reprint-reason">เหตุผลการพิมพ์ซ้ำ<span className="required">*</span><input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ฉลากเดิมชำรุด" /></label>}
    <button type="button" className="primary-button" disabled={busy} onClick={() => void print()}><Printer size={18} aria-hidden="true" />{labelVersionId ? (printed > 0 ? "บันทึกและพิมพ์ซ้ำ" : "บันทึกและพิมพ์") : "พิมพ์"}</button>
    {labelVersionId && <p className="field-hint">{printed > 0 ? `ฉลากฉบับนี้พิมพ์แล้ว ${printed} ครั้ง การพิมพ์ซ้ำไม่สร้างรายการใหม่` : "ตั้งค่าเครื่องพิมพ์เป็นขนาดจริง (100%) ไม่มีขอบกระดาษ"}</p>}
    {message && <p className="form-error" role="alert">{message}</p>}
  </div>;
}
