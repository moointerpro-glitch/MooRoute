"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { newUuid } from "@/lib/new-uuid";

type Props = { consignmentId: string; version: number; canIssue: boolean; canCorrect: boolean; blocked: string | null; masterChanged: boolean };

export function LabelActions({ consignmentId, version, canIssue, canCorrect, blocked, masterChanged }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [reason, setReason] = useState(""), [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);
  async function run(action: string, input: unknown, done: string) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/labels", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": newUuid() }, body: JSON.stringify({ action, input }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "ดำเนินการไม่สำเร็จ");
      setMessage({ tone: "ok", text: done }); setReason(""); router.refresh();
    } catch (e) { setMessage({ tone: "error", text: (e as Error).message }); } finally { setBusy(false); }
  }
  return <div className="actions-wrap">
    {message && <p ref={messageRef} tabIndex={-1} className={message.tone === "ok" ? "form-success" : "form-error"} role={message.tone === "ok" ? "status" : "alert"}>{message.text}</p>}
    {canIssue && <section className="action-panel" aria-label="ออกฉลาก"><h3>ออกฉลากฉบับใหม่</h3>
      {blocked ? <p className="field-error">{blocked}</p> : <p className="muted small">ฉลากใช้ที่อยู่และผู้ติดต่อที่บันทึกไว้ตอนจัดรถ และแก้ไขไม่ได้หลังออก</p>}
      <button type="button" className="primary-button" disabled={busy || !!blocked} onClick={() => void run("issue", { consignmentId, expectedVersion: version }, "ออกฉลากแล้ว")}>ออกฉลาก</button></section>}
    {canCorrect && <section className="action-panel" aria-label="แก้ไขที่อยู่บนฉลาก"><h3>แก้ไขที่อยู่บนฉลาก</h3>
      <p className="muted small">{masterChanged ? "ข้อมูลสาขาถูกแก้ไขหลังจัดรถ " : ""}ระบบจะบันทึกที่อยู่และผู้ติดต่อจากข้อมูลสาขาปัจจุบันใหม่ ยกเลิกฉลากเดิมทุกฉบับ และต้องออกฉลากใหม่</p>
      <label className="reason-field">เหตุผล<span className="required">*</span><textarea value={reason} rows={2} maxLength={500} onChange={(e) => setReason(e.target.value)} /></label>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => void run("correctAddress", { id: consignmentId, expectedVersion: version, reason }, "บันทึกที่อยู่ใหม่และยกเลิกฉลากเดิมแล้ว")}>อัปเดตที่อยู่และยกเลิกฉลากเดิม</button></section>}
  </div>;
}
