"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ArrowLeft, Check, Copy, KeyRound, Power, Save, ShieldCheck, UserPlus } from "lucide-react";
import {AdminDialog,AdminFormBoundary} from "./admin-form-boundary";
import { ACCOUNT_TYPES } from "@/lib/account-display";
import type { UserDetail, UserFormOptions } from "@/server/services/users";
import { newUuid } from "@/lib/new-uuid";

async function post<T>(action: string, input: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": newUuid() }, body: JSON.stringify({ action, input }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data as T;
}

const option = (o: { id: string; code: string; name: string }) => <option key={o.id} value={o.id}>{o.name} ({o.code})</option>;

/** Shown once after creating an account or issuing a new password. Nothing keeps it afterwards. */
export function PasswordReveal({ email, password, title }: { email: string; password: string; title: string }) {
  const [copied, setCopied] = useState(false), id = useId();
  return <div className="password-reveal" role="status">
    <h2><ShieldCheck size={20} aria-hidden="true" />{title}</h2>
    <p>ส่งข้อมูลนี้ให้เจ้าของบัญชีทางช่องทางที่ปลอดภัย <strong>รหัสนี้แสดงครั้งเดียว</strong> ปิดหน้านี้แล้วจะดูอีกไม่ได้ ถ้าหายให้ออกรหัสใหม่</p>
    <dl>
      <div><dt>อีเมลเข้าสู่ระบบ</dt><dd>{email}</dd></div>
      <div><dt>รหัสผ่านชั่วคราว</dt><dd><code id={id}>{password}</code>
        <button type="button" className="secondary-button" onClick={async () => {
          try { await navigator.clipboard.writeText(password); setCopied(true); }
          catch { const range = document.createRange(); range.selectNodeContents(document.getElementById(id)!); getSelection()?.removeAllRanges(); getSelection()?.addRange(range); }
        }}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? "คัดลอกแล้ว" : "คัดลอก"}</button></dd></div>
    </dl>
    <p className="muted">แนะนำให้เจ้าของบัญชีเข้าสู่ระบบแล้วเปลี่ยนรหัสผ่านที่ “บัญชีของฉัน” ทันที</p>
  </div>;
}

type Values = { name: string; email: string; typeCode: string; departmentId: string; branchId: string; warehouseId: string; driverId: string; reason: string };

/** Create or edit an account: one account type and the scope that type needs. */
export function UserForm({ options, user, backHref="/admin/users" }: { options: UserFormOptions; user?: UserDetail; backHref?:string }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ name: user?.name ?? "", email: user?.email ?? "", typeCode: user?.access.typeCode ?? "", departmentId: user?.access.departmentId ?? "",
    branchId: user?.access.branchId ?? "", warehouseId: user?.access.warehouseId ?? "", driverId: user?.access.driverId ?? "", reason: "" });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [created, setCreated] = useState<{ id: string; password: string | null } | null>(null);
  const [dirty,setDirty]=useState(false);
  const set = (key: keyof Values, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const type = values.typeCode, selfAdmin = !!user?.self && user.access.typeCode === "ADMINISTRATOR";
  const missing = !values.name.trim() ? "กรอกชื่อที่แสดง" : !user && !values.email.trim() ? "กรอกอีเมล" : !type ? "เลือกประเภทบัญชี"
    : type === "BRANCH_RECEIVER" && !values.branchId ? "เลือกสาขาที่ประจำ" : type === "WAREHOUSE" && !values.warehouseId && !values.driverId ? "เลือกคลังที่ประจำ หรือคนขับ"
    : user && values.reason.trim().length < 3 ? "ระบุเหตุผลการเปลี่ยนแปลง" : "";

  if (created) return <div className="admin-card">
    {created.password ? <PasswordReveal email={values.email.trim().toLowerCase()} password={created.password} title="สร้างบัญชีแล้ว" />
      : <p className="form-success" role="status">สร้างบัญชีแล้ว (ส่งคำขอซ้ำ จึงไม่แสดงรหัสผ่านอีก ให้ออกรหัสผ่านใหม่ที่หน้าบัญชี)</p>}
    <div className="form-actions"><Link className="primary-button" href={`/admin/users/${created.id}?returnTo=${encodeURIComponent(backHref)}`}>เปิดหน้าบัญชีนี้</Link><button type="button" className="secondary-button" onClick={() => { setCreated(null); setMessage(null); setDirty(false); setValues({name:"",email:"",typeCode:"",departmentId:"",branchId:"",warehouseId:"",driverId:"",reason:""}); }}>เพิ่มบัญชีอีก</button><Link className="secondary-button admin-back-button" href={backHref}><ArrowLeft size={18} aria-hidden="true"/>กลับรายชื่อผู้ใช้</Link></div>
  </div>;

  return <AdminFormBoundary dirty={dirty} busy={busy} onDirty={()=>setDirty(true)} backHref={backHref}><form className="admin-card admin-form user-form" onSubmit={async (e) => {
    e.preventDefault(); if (missing) { setMessage({ ok: false, text: `ยังบันทึกไม่ได้: ${missing}` }); return; }
    setBusy(true); setMessage(null);
    const access = { typeCode: type, departmentId: values.departmentId, branchId: values.branchId || null, warehouseId: values.warehouseId || null, driverId: values.driverId || null };
    try {
      if (user) {
        await post("update", { id: user.id, expectedVersion: user.version, name: values.name, reason: values.reason, ...access });
        setDirty(false);setMessage({ ok: true, text: "บันทึกแล้ว สิทธิ์ใหม่มีผลทันทีในคำขอถัดไปของผู้ใช้" }); set("reason", ""); router.refresh();
      } else {
        const r = await post<{ id: string; temporaryPassword: string | null }>("create", { name: values.name, email: values.email, ...access });
        setDirty(false);setCreated({ id: r.id, password: r.temporaryPassword });
      }
    } catch (error) { setMessage({ ok: false, text: (error as Error).message }); } finally { setBusy(false); }
  }}><fieldset disabled={busy} className="admin-form-fields">
    <fieldset className="user-fieldset"><legend>ข้อมูลบัญชี</legend>
      <div className="form-grid">
        <label><span>ชื่อที่แสดง<span className="required">*</span></span><input value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={120} required autoComplete="off" placeholder="เช่น สมหญิง ใจดี" /></label>
        <label><span>อีเมลเข้าสู่ระบบ{!user && <span className="required">*</span>}</span><input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} maxLength={191} required={!user} readOnly={!!user} autoComplete="off" placeholder="name@company.co.th" aria-describedby="email-hint" />
          <span id="email-hint" className="field-hint">{user ? "อีเมลเปลี่ยนไม่ได้ ถ้าผิดให้ปิดบัญชีนี้แล้วสร้างใหม่" : "ใช้เป็นชื่อเข้าสู่ระบบ ระบบสร้างรหัสผ่านชั่วคราวให้"}</span></label>
      </div>
    </fieldset>

    <fieldset className="user-fieldset"><legend>ประเภทบัญชี<span className="required">*</span></legend>
      {selfAdmin && <p className="field-hint">นี่คือบัญชีของคุณ เปลี่ยนออกจากผู้ดูแลระบบไม่ได้</p>}
      <div className="type-cards" role="radiogroup" aria-label="ประเภทบัญชี">
        {ACCOUNT_TYPES.map((t) => <label key={t.code} className={type === t.code ? "type-card selected" : "type-card"}>
          <input type="radio" name="typeCode" value={t.code} checked={type === t.code} disabled={selfAdmin && t.code !== "ADMINISTRATOR"} onChange={() => set("typeCode", t.code)} />
          <strong>{t.name}</strong><span>{t.does}</span><small>ขอบเขต: {t.scope}</small>
        </label>)}
      </div>
    </fieldset>

    <fieldset className="user-fieldset"><legend>ขอบเขตข้อมูล</legend>
      <div className="form-grid">
        <label><span>แผนกต้นสังกัด (ไม่จำเป็น)</span><select value={values.departmentId} onChange={(e) => set("departmentId", e.target.value)} aria-describedby="dept-hint">
          <option value="">ไม่กำหนดแผนก</option>{options.departments.map(option)}</select>
          <span id="dept-hint" className="field-hint">ใช้กำหนดสิทธิ์ดูรายการของแผนกสำหรับพนักงานทั่วไป ส่วนแผนกผู้ส่งเลือกเองตอนฝากแต่ละครั้งได้</span></label>
        {type === "BRANCH_RECEIVER" && <label><span>สาขาที่ประจำ<span className="required">*</span></span><select value={values.branchId} onChange={(e) => set("branchId", e.target.value)} required>
          <option value="">เลือกสาขา</option>{options.branches.map(option)}</select></label>}
        {type === "WAREHOUSE" && <>
          <label>คลังที่ประจำ<select value={values.warehouseId} onChange={(e) => set("warehouseId", e.target.value)}><option value="">ไม่ได้ประจำคลัง</option>{options.warehouses.map(option)}</select>
            <span className="field-hint">รับของ ขึ้นรถ ออกฉลาก และบันทึกรถออกจากคลังนี้</span></label>
          <label>เป็นคนขับ (ข้อมูลพนักงานขับรถ)<select value={values.driverId} onChange={(e) => set("driverId", e.target.value)}><option value="">ไม่ใช่คนขับ</option>{options.drivers.map(option)}</select>
            <span className="field-hint">บันทึกรถออกและแจ้งปัญหาในรอบที่ตนเองขับ เลือกคลัง คนขับ หรือทั้งสองอย่าง</span></label>
        </>}
        {(type === "DISPATCHER" || type === "ADMINISTRATOR") && <p className="scope-note">ประเภทนี้ทำงานกับข้อมูลทั้งบริษัท ไม่ต้องเลือกสาขาหรือคลัง</p>}
        {type === "REQUESTER" && <p className="scope-note">พนักงานทั่วไปเห็นรายการของตัวเอง หากกำหนดแผนก จะดูคำขอที่ส่งแล้วของแผนกนั้นได้ด้วย การเลือกแผนกตอนฝากไม่เพิ่มสิทธิ์ดูรายการคนอื่น</p>}
      </div>
    </fieldset>

    {user && <label><span>เหตุผลการเปลี่ยนแปลง<span className="required">*</span></span><input value={values.reason} onChange={(e) => set("reason", e.target.value)} maxLength={300} placeholder="เช่น ย้ายไปประจำคลังสินค้าแช่แข็ง" /></label>}
    {message && <p className={message.ok ? "form-success" : "form-error"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
    <div className="form-actions admin-editor-footer">
      <button className="primary-button" disabled={busy}>{user ? <Save size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}{busy ? "กำลังบันทึก…" : user ? "บันทึกการเปลี่ยนแปลง" : "สร้างบัญชี"}</button>
      {!user&&<Link className="secondary-button admin-back-button" href={backHref}><ArrowLeft size={18} aria-hidden="true"/>กลับรายชื่อผู้ใช้</Link>}
    </div>
  </fieldset></form></AdminFormBoundary>;
}

/** Disable / re-enable and temporary password, each with a reason and an explicit confirmation step. */
export function UserActions({ user }: { user: UserDetail }) {
  const router = useRouter();
  const [mode, setMode] = useState<"" | "reset" | "deactivate" | "reactivate">(""), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [password, setPassword] = useState<string | null>(null);
  const run = async () => {
    if (reason.trim().length < 3) { setError("ระบุเหตุผลอย่างน้อย ๓ ตัวอักษร"); return; }
    setBusy(true); setError("");
    try {
      const r = await post<{ temporaryPassword?: string | null }>(mode === "reset" ? "resetPassword" : mode, { id: user.id, expectedVersion: user.version, reason });
      if (mode === "reset") setPassword(r.temporaryPassword ?? null);
      setMode(""); setReason(""); router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  if (password) return <div className="admin-card"><PasswordReveal email={user.email} password={password} title="ออกรหัสผ่านชั่วคราวใหม่แล้ว" />
    <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setPassword(null)}>เสร็จแล้ว ปิดรหัสผ่าน</button></div></div>;
  const confirmText = { reset: "ออกรหัสผ่านใหม่และให้ออกจากระบบทุกอุปกรณ์", deactivate: "ปิดใช้งานและให้ออกจากระบบทุกอุปกรณ์", reactivate: "เปิดใช้งานอีกครั้ง", "": "" }[mode];
  return <div className="admin-card user-actions">
    <h2>การจัดการบัญชี</h2>
    {user.self ? <p className="muted">นี่คือบัญชีของคุณ เปลี่ยนรหัสผ่านได้ที่ <Link href="/account">บัญชีของฉัน</Link> และปิดใช้งานบัญชีตัวเองไม่ได้</p> : <>
      <div className="form-actions">
        {user.active && <button type="button" className="secondary-button" onClick={() => setMode("reset")}><KeyRound size={17} aria-hidden="true" />ออกรหัสผ่านชั่วคราวใหม่</button>}
        {user.active ? <button type="button" className="danger-button" onClick={() => setMode("deactivate")}><Power size={17} aria-hidden="true" />ปิดใช้งานบัญชี</button>
          : <button type="button" className="primary-button" onClick={() => setMode("reactivate")}><Power size={17} aria-hidden="true" />เปิดใช้งานอีกครั้ง</button>}
      </div>
      {mode && <AdminDialog title={confirmText} busy={busy} onClose={()=>{setMode("");setReason("");setError("");}}><div className="delete-confirm admin-form"><strong>{user.name} · {user.email}</strong>
        <p>{mode === "deactivate" ? "บัญชีจะเข้าสู่ระบบไม่ได้ทันที ประวัติงานทั้งหมดยังเก็บไว้ เปิดใช้งานคืนได้ภายหลัง" : mode === "reset" ? "รหัสผ่านเดิมจะใช้ไม่ได้ทันที ระบบแสดงรหัสใหม่ให้ครั้งเดียว" : "บัญชีจะเข้าสู่ระบบได้อีกครั้งด้วยรหัสผ่านเดิม ถ้าไม่แน่ใจให้ออกรหัสผ่านใหม่หลังเปิดใช้งาน"}</p>
        <label><span>เหตุผล<span className="required">*</span></span><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus placeholder={mode === "deactivate" ? "เช่น ลาออก" : "เช่น ลืมรหัสผ่าน"} /></label>
        {error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className={mode === "deactivate" ? "danger-button" : "primary-button"} disabled={busy} onClick={() => void run()}>{busy ? "กำลังดำเนินการ…" : `ยืนยัน${confirmText}`}</button>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => { setMode(""); setReason(""); setError(""); }}>ยกเลิก</button></div>
      </div></AdminDialog>}
    </>}
    {error && !mode && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
