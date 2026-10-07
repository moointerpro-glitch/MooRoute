import Link from "next/link";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { userFormOptions } from "@/server/services/users";
import { DomainError } from "@/server/domain/errors";
import { UserForm } from "@/components/user-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "เพิ่มบัญชีผู้ใช้" };

export default async function NewUserPage() {
  const actor = await requirePageActor();
  let options;
  try { options = await userFormOptions(getDatabase(), actor.id); }
  catch (error) { return <div className="admin-card" role="alert"><h1>ไม่สามารถเพิ่มบัญชีได้</h1><p>{error instanceof DomainError ? error.message : "ระบบไม่พร้อมใช้งาน กรุณาลองอีกครั้ง"}</p><Link href="/admin">กลับหน้าจัดการหลังบ้าน</Link></div>; }
  return <>
    <div className="admin-heading"><div><h1>เพิ่มบัญชีผู้ใช้</h1><p className="muted">เลือกประเภทบัญชีตามงานของคนนั้น แล้วเลือกขอบเขตที่ประเภทนั้นต้องใช้ ระบบสร้างรหัสผ่านชั่วคราวให้</p></div></div>
    <UserForm options={options} />
  </>;
}
