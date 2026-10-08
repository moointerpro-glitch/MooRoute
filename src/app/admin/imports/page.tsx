import Link from "next/link";
import { Download } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { listImportBatches } from "@/server/services/imports";
import { importKinds } from "@/server/domain/imports";
import { DomainError } from "@/server/domain/errors";
import {AdminListLink,RestoreAdminList} from "@/components/admin-list-link";
import { thaiDateTime } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "นำเข้าข้อมูล" };
const statusLabels: Record<string, string> = { STAGED: "รอแก้ไขหรือตัดสินใจ", VALIDATED: "พร้อมนำเข้า", COMMITTED: "นำเข้าแล้ว", REJECTED: "ยกเลิก" };
const statusTone: Record<string, string> = { STAGED: "tone-draft", VALIDATED: "tone-active", COMMITTED: "tone-done", REJECTED: "tone-muted" };

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requirePageActor(), page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  let list;
  try { list = await listImportBatches(getDatabase(), actor.id, page); }
  catch (error) { if (error instanceof DomainError && error.code === "FORBIDDEN") return <div className="admin-card"><h1>ไม่มีสิทธิ์นำเข้าข้อมูล</h1><p>การนำเข้าข้อมูลทำได้เฉพาะผู้ดูแลระบบหรือผู้วางแผนขนส่ง</p></div>; throw error; }
  return <><RestoreAdminList/>
    <h1>นำเข้าข้อมูล</h1>
    <p className="muted">นำเข้าเฉพาะช่องข้อมูลที่อนุมัติ จากไฟล์ CSV หรือ XLSX ที่ถอดความและตรวจทานแล้ว ระบบพักข้อมูลไว้ให้ตรวจ แสดงข้อผิดพลาดรายแถว และนำเข้าทั้งชุดพร้อมกันเท่านั้น</p>
    {list.kinds.length>0&&<div className="form-actions"><Link href="/admin/imports/new" className="primary-button">อัปโหลดไฟล์ใหม่</Link><Link href="/admin/imports/new" className="secondary-button"><Download size={17} aria-hidden="true"/>ดาวน์โหลดแม่แบบ</Link></div>}
    <section className="admin-card" aria-labelledby="history-title"><h2 id="history-title">ประวัติชุดนำเข้า</h2>
      {list.rows.length === 0 ? <p className="empty-list">ยังไม่มีชุดนำเข้า</p> : <div className="table-scroll"><table className="admin-table">
        <thead><tr><th scope="col">ชุดเอกสาร</th><th scope="col">ประเภท</th><th scope="col">สถานะ</th><th scope="col">แถว</th><th scope="col">ผู้อัปโหลด</th></tr></thead>
        <tbody>{list.rows.map((b) => <tr key={b.id}><td><AdminListLink href={`/admin/imports/${b.id}?returnTo=${encodeURIComponent(`/admin/imports?page=${page}`)}`}>{b.sourceEdition}</AdminListLink><br /><span className="muted small">{b.sourceName}</span></td><td>{importKinds[b.kind].title}</td>
          <td><span className={`status-pill ${statusTone[b.status]}`}>{statusLabels[b.status] ?? b.status}</span></td><td>{b.rowCount}</td><td>{b.createdBy}<br /><span className="muted small">{thaiDateTime(b.createdAt)} น.</span></td></tr>)}</tbody></table></div>}
      {list.pageCount > 1 && <div className="pagination"><span>หน้า {list.page} จาก {list.pageCount}</span><span>{list.page > 1 && <Link href={`/admin/imports?page=${list.page - 1}`}>ก่อนหน้า</Link>} {list.page < list.pageCount && <Link href={`/admin/imports?page=${list.page + 1}`}>ถัดไป</Link>}</span></div>}
    </section>
  </>;
}
