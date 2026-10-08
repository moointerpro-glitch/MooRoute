import {adminReturnHref} from "@/lib/admin-return";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { userDetail, userFormOptions } from "@/server/services/users";
import { DomainError } from "@/server/domain/errors";
import { initialOf } from "@/lib/account-display";
import { UserActions, UserForm } from "@/components/user-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "บัญชีผู้ใช้" };

const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" });

export default async function UserPage({ params,searchParams }: { params: Promise<{ id: string }>;searchParams:Promise<{returnTo?:string}> }) {
  const actor = await requirePageActor(), { id } = await params, db = getDatabase();
  const backHref=adminReturnHref((await searchParams).returnTo,"/admin/users");
  let user, options;
  try { [user, options] = await Promise.all([userDetail(db, actor.id, id), userFormOptions(db, actor.id)]); }
  catch (error) { return <div className="admin-card" role="alert"><h1>ไม่สามารถเปิดบัญชีนี้ได้</h1><p>{error instanceof DomainError ? error.message : "ระบบไม่พร้อมใช้งาน กรุณาลองอีกครั้ง"}</p><Link href="/admin/users">กลับรายชื่อผู้ใช้</Link></div>; }
  // A scope that was archived after assignment is still shown, so saving without a change does not silently drop it.
  const keep = (list: { id: string; code: string; name: string }[], value: string) => value && !list.some((o) => o.id === value) ? [...list, { id: value, code: "-", name: "รายการเดิม (ไม่พร้อมใช้งาน)" }] : list;
  const formOptions = { departments: keep(options.departments, user.access.departmentId), branches: keep(options.branches, user.access.branchId), warehouses: keep(options.warehouses, user.access.warehouseId), drivers: keep(options.drivers, user.access.driverId) };
  return <>
    <Link href={backHref} className="secondary-button admin-back-button"><ArrowLeft size={18} aria-hidden="true" />กลับรายชื่อผู้ใช้</Link>
    <header className="account-head user-head">
      <span className="profile-badge profile-badge-large" aria-hidden="true">{initialOf(user.name)}</span>
      <div><h1>{user.name}</h1><p className="muted">{user.email} · สร้างเมื่อ {when(user.createdAt)}</p></div>
      <span className={user.active ? "status-active" : "status-archived"}>{user.active ? "ใช้งาน" : "ปิดใช้งาน"}</span>
    </header>
    {user.roleNames.length > 1 && <p className="notice-panel">บัญชีนี้มีหลายบทบาทจากระบบเดิม เมื่อบันทึก ระบบจะเหลือประเภทเดียวตามที่เลือก</p>}
    <div className="user-layout">
      <UserForm backHref={backHref} options={formOptions} user={user} />
      <aside className="user-side">
        <UserActions user={user} />
        <section className="admin-card user-history" aria-labelledby="history-heading">
          <h2 id="history-heading">ประวัติบัญชี</h2>
          {user.history.length ? <ol>{user.history.map((h) => <li key={h.id}><strong>{h.action}</strong><span className="muted">{when(h.at)} · โดย {h.by}</span>{h.reason && <span>{h.reason}</span>}</li>)}</ol>
            : <p className="muted">ยังไม่มีประวัติ</p>}
        </section>
      </aside>
    </div>
  </>;
}
