import Link from "next/link";
import { Download } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { listImportBatches } from "@/server/services/imports";
import { importKinds } from "@/server/domain/imports";
import { DomainError } from "@/server/domain/errors";
import { ImportUpload } from "@/components/import-upload";
import { thaiDateTime } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "นำเข้าข้อมูล" };
const statusLabels: Record<string, string> = { STAGED: "รอแก้ไขหรือตัดสินใจ", VALIDATED: "พร้อมนำเข้า", COMMITTED: "นำเข้าแล้ว", REJECTED: "ยกเลิก" };
const statusTone: Record<string, string> = { STAGED: "tone-draft", VALIDATED: "tone-active", COMMITTED: "tone-done", REJECTED: "tone-muted" };

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requirePageActor(), page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  let list;
  try { list = await listImportBatches(getDatabase(), actor.id, page); }
  catch (error) { if (error instanceof DomainError && error.code === "FORBIDDEN") return <div className="admin-card"><h1>ไม่มีสิทธิ์นำเข้าข้อมูล</h1><p>การนำเข้าข้อมูลทำได้เฉพาะผู้ดูแลระบบหรือผู้จัดรถที่มีขอบเขตงานส่วนกลาง</p></div>; throw error; }
  return <>
    <h1>นำเข้าข้อมูล</h1>
    <p className="muted">นำเข้าเฉพาะช่องข้อมูลที่อนุมัติ จากไฟล์ CSV หรือ XLSX ที่ถอดความและตรวจทานแล้ว ระบบพักข้อมูลไว้ให้ตรวจ แสดงข้อผิดพลาดรายแถว และนำเข้าทั้งชุดพร้อมกันเท่านั้น</p>
    {list.kinds.length === 0 ? <p className="admin-card">บัญชีนี้ยังไม่มีสิทธิ์เขียนข้อมูลประเภทที่นำเข้าได้</p> : <>
      <section className="admin-card" aria-labelledby="upload-title"><h2 id="upload-title">อัปโหลดไฟล์ใหม่</h2><ImportUpload kinds={list.kinds.map((k) => ({ value: k, title: importKinds[k].title }))} /></section>
      <section className="admin-card" aria-labelledby="template-title"><h2 id="template-title">แม่แบบและช่องข้อมูลที่อนุญาต</h2>
        {list.kinds.map((k) => <details key={k} className="import-kind"><summary><strong>{importKinds[k].title}</strong> — {importKinds[k].description}</summary>
          <p className="form-actions"><a className="secondary-button" href={`/api/imports/template?kind=${k}&format=csv`}><Download size={16} aria-hidden="true" />แม่แบบ CSV</a><a className="secondary-button" href={`/api/imports/template?kind=${k}&format=xlsx`}><Download size={16} aria-hidden="true" />แม่แบบ XLSX</a></p>
          <div className="table-scroll"><table className="admin-table compact"><thead><tr><th scope="col">หัวคอลัมน์</th><th scope="col">จำเป็น</th><th scope="col">ตัวอย่าง</th></tr></thead>
            <tbody>{importKinds[k].fields.map((f) => <tr key={f.name}><td>{f.label}</td><td>{f.required ? "จำเป็น" : "ไม่บังคับ"}</td><td>{f.example || "เว้นว่างได้ถ้าไม่ทราบ"}</td></tr>)}</tbody></table></div>
          <p className="muted small">วันที่ใช้ วว/ดด/ปปปป (พ.ศ.) หรือ ปปปป-ดด-วว (ค.ศ.) เวลาที่ไม่ทราบให้เว้นว่าง ระบบจะไม่เดาเวลาออกรถจากเวลาเริ่มขึ้นของ</p>
        </details>)}
      </section>
    </>}
    <section className="admin-card" aria-labelledby="history-title"><h2 id="history-title">ประวัติชุดนำเข้า</h2>
      {list.rows.length === 0 ? <p className="empty-list">ยังไม่มีชุดนำเข้า</p> : <div className="table-scroll"><table className="admin-table">
        <thead><tr><th scope="col">ชุดเอกสาร</th><th scope="col">ประเภท</th><th scope="col">สถานะ</th><th scope="col">แถว</th><th scope="col">ผู้อัปโหลด</th></tr></thead>
        <tbody>{list.rows.map((b) => <tr key={b.id}><td><Link href={`/admin/imports/${b.id}`}>{b.sourceEdition}</Link><br /><span className="muted small">{b.sourceName}</span></td><td>{importKinds[b.kind].title}</td>
          <td><span className={`status-pill ${statusTone[b.status]}`}>{statusLabels[b.status] ?? b.status}</span></td><td>{b.rowCount}</td><td>{b.createdBy}<br /><span className="muted small">{thaiDateTime(b.createdAt)} น.</span></td></tr>)}</tbody></table></div>}
      {list.pageCount > 1 && <div className="pagination"><span>หน้า {list.page} จาก {list.pageCount}</span><span>{list.page > 1 && <Link href={`/admin/imports?page=${list.page - 1}`}>ก่อนหน้า</Link>} {list.page < list.pageCount && <Link href={`/admin/imports?page=${list.page + 1}`}>ถัดไป</Link>}</span></div>}
    </section>
  </>;
}
