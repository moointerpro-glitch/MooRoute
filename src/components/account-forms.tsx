"use client";

import { useState } from "react";
import { KeyRound, Save } from "lucide-react";
import type { MyAccount } from "@/server/services/account";

async function post(action: "profile" | "password", input: Record<string, unknown>) {
  const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ action, input }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data;
}

/** Contact defaults used when this person creates a consignment. */
export function ProfileForm({ account }: { account: MyAccount }) {
  const [phone, setPhone] = useState(account.phone), [warehouse, setWarehouse] = useState(account.defaultWarehouseId), [version, setVersion] = useState(account.version);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return <form className="admin-card admin-form" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setMessage(null);
    try { const r = await post("profile", { phone, defaultWarehouseId: warehouse, expectedVersion: version }); setVersion(r.version); setMessage({ ok: true, text: "บันทึกข้อมูลติดต่อแล้ว จะใช้เป็นค่าเริ่มต้นตอนฝากของ" }); }
    catch (error) { setMessage({ ok: false, text: (error as Error).message }); } finally { setBusy(false); }
  }}>
    <h2>ข้อมูลติดต่อสำหรับฝากของ</h2>
    <p className="muted">ระบบเติมข้อมูลนี้ให้อัตโนมัติเมื่อคุณสร้างคำขอฝากของใหม่ และแก้ไขในคำขอแต่ละใบได้</p>
    <div className="form-grid">
      <label>เบอร์ติดต่อ<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={32} placeholder="เช่น 081-234-5678" /></label>
      <label>คลังต้นทางประจำ<select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
        <option value="">ไม่กำหนด (เลือกเองทุกครั้ง)</option>
        {account.warehouses.map((w) => <option key={w.id} value={w.id} disabled={!w.active}>{w.name} ({w.code}){w.active ? "" : " · ปิดใช้งาน"}</option>)}
      </select></label>
    </div>
    {message && <p className={message.ok ? "form-success" : "form-error"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
    <div className="form-actions"><button className="primary-button" disabled={busy}><Save size={17} aria-hidden="true" />{busy ? "กำลังบันทึก…" : "บันทึกข้อมูลติดต่อ"}</button></div>
  </form>;
}

export function PasswordForm() {
  const [current, setCurrent] = useState(""), [next, setNext] = useState(""), [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const mismatch = confirm !== "" && confirm !== next, short = next !== "" && next.length < 12;
  return <form className="admin-card admin-form" onSubmit={async (e) => {
    e.preventDefault(); if (mismatch || short) return; setBusy(true); setMessage(null);
    try { await post("password", { currentPassword: current, newPassword: next }); setCurrent(""); setNext(""); setConfirm(""); setMessage({ ok: true, text: "เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นที่เคยเข้าสู่ระบบถูกออกจากระบบทั้งหมด" }); }
    catch (error) { setMessage({ ok: false, text: (error as Error).message }); } finally { setBusy(false); }
  }}>
    <h2>เปลี่ยนรหัสผ่าน</h2>
    <p className="muted">รหัสผ่านใหม่ยาวอย่างน้อย ๑๒ ตัวอักษร เมื่อเปลี่ยนแล้ว อุปกรณ์อื่นจะถูกออกจากระบบ</p>
    <div className="form-grid">
      <label>รหัสผ่านปัจจุบัน<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required maxLength={128} /></label>
      <span aria-hidden="true" />
      <label>รหัสผ่านใหม่<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={short || undefined} aria-describedby="new-password-hint" />
        <span id="new-password-hint" className={short ? "field-error" : "field-hint"}>{short ? "ยังสั้นเกินไป ต้องอย่างน้อย ๑๒ ตัวอักษร" : "อย่างน้อย ๑๒ ตัวอักษร"}</span></label>
      <label>ยืนยันรหัสผ่านใหม่<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required maxLength={128} aria-invalid={mismatch || undefined} />
        {mismatch && <span className="field-error">รหัสผ่านทั้งสองช่องไม่ตรงกัน</span>}</label>
    </div>
    {message && <p className={message.ok ? "form-success" : "form-error"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
    <div className="form-actions"><button className="primary-button" disabled={busy || mismatch || short}><KeyRound size={17} aria-hidden="true" />{busy ? "กำลังเปลี่ยน…" : "เปลี่ยนรหัสผ่าน"}</button></div>
  </form>;
}
