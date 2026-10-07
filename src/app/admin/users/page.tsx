import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { listUsers } from "@/server/services/users";
import { DomainError } from "@/server/domain/errors";
import { ACCOUNT_TYPES } from "@/lib/account-display";

export const dynamic = "force-dynamic";
export const metadata = { title: "ผู้ใช้งาน" };

/** D223: every account with its one type, scope and status. Filters keep the URL so a list can be shared. */
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }> }) {
  const actor = await requirePageActor(), query = await searchParams;
  let result;
  try { result = await listUsers(getDatabase(), actor.id, { q: query.q, type: query.type, status: query.status, page: Number(query.page ?? 1) }); }
  catch (error) { return <div className="admin-card" role="alert"><h1>ไม่สามารถเปิดรายชื่อผู้ใช้ได้</h1><p>{error instanceof DomainError ? error.message : "ระบบไม่พร้อมใช้งาน กรุณาลองอีกครั้ง"}</p><Link href="/admin">กลับหน้าจัดการหลังบ้าน</Link></div>; }
  const f = result.filter, link = (changes: Record<string, string>) => `/admin/users?${new URLSearchParams({ q: f.q, type: f.type, status: f.status, page: "1", ...changes })}`;
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return <>
    <div className="admin-heading"><div><h1>ผู้ใช้งาน</h1><p className="muted">หนึ่งบัญชีมีหนึ่งประเภท และขอบเขตตามงาน · ปิดใช้งานแทนการลบ เพื่อเก็บประวัติงาน</p></div>
      <Link className="primary-button" href="/admin/users/new"><UserPlus size={17} aria-hidden="true" />เพิ่มบัญชี</Link></div>
    <nav className="type-filter" aria-label="กรองตามประเภทบัญชี">
      <Link href={link({ type: "" })} aria-current={!f.type ? "page" : undefined}>ทุกประเภท</Link>
      {ACCOUNT_TYPES.map((t) => <Link key={t.code} href={link({ type: t.code })} aria-current={f.type === t.code ? "page" : undefined}>{t.name}<span>{result.counts[t.code] ?? 0}</span></Link>)}
    </nav>
    <form className="admin-toolbar">
      <input type="hidden" name="type" value={f.type} />
      <label>ค้นหา<input name="q" defaultValue={f.q} placeholder="ชื่อหรืออีเมล" maxLength={100} /></label>
      <label>สถานะ<select name="status" defaultValue={f.status}><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option><option value="all">ทั้งหมด</option></select></label>
      <button className="primary-button">ค้นหา</button>
    </form>
    <div className="admin-card">
      <p className="result-count">พบ {result.total.toLocaleString("th-TH")} บัญชี</p>
      <div className="table-scroll" role="region" aria-label="รายชื่อผู้ใช้งาน" tabIndex={0}>
        <table className="admin-table user-table"><thead><tr><th>ผู้ใช้</th><th>ประเภทบัญชี</th><th>ขอบเขต</th><th>สถานะ</th><th>การจัดการ</th></tr></thead>
          <tbody>{result.rows.map((u) => <tr key={u.id}>
            <td><strong>{u.name}</strong><span className="muted cell-sub">{u.email}</span></td>
            <td><span className="type-chip">{u.typeName}</span></td>
            <td>{u.where}{u.department && <span className="muted cell-sub">แผนก {u.department}</span>}</td>
            <td><span className={u.active ? "status-active" : "status-archived"}>{u.active ? "ใช้งาน" : "ปิดใช้งาน"}</span></td>
            <td><Link href={`/admin/users/${u.id}`}>ดู / แก้ไข</Link></td>
          </tr>)}</tbody></table>
        {!result.rows.length && <p className="empty-list">ไม่พบบัญชีตามเงื่อนไข ลองเปลี่ยนคำค้น ประเภท หรือสถานะ</p>}
      </div>
      <nav className="pagination" aria-label="แบ่งหน้า">{result.page > 1 && <Link href={link({ page: String(result.page - 1) })}>หน้าก่อน</Link>}<span>หน้า {result.page} จาก {pages}</span>{result.page < pages && <Link href={link({ page: String(result.page + 1) })}>หน้าถัดไป</Link>}</nav>
    </div>
  </>;
}
