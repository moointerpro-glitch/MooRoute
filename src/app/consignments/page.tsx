import Link from "next/link";
import { Download, PackagePlus, Search } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { listConsignments } from "@/server/services/consignments";
import { principal } from "@/server/auth/permissions";
import { DomainError } from "@/server/domain/errors";
import { statusLabels } from "@/server/domain/consignment";
import { parseHistoryFilter, statusText, statusTone, unitText } from "@/lib/consignment-format";
import { beDate, roundLabel, thaiDateTime } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ประวัติฝากส่ง" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor(), raw = await searchParams, db = getDatabase();
  const params = new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => v ? [[k, v]] : []));
  const filter = parseHistoryFilter(params);
  let result;
  try { result = await listConsignments(db, actor.id, filter); }
  catch (error) {
    if (error instanceof DomainError && ["FORBIDDEN", "INVALID_SEARCH", "INVALID_DATE"].includes(error.code)) return <div className="container message-page"><span className="eyebrow">ประวัติฝากส่ง</span><h1>{error.code === "FORBIDDEN" ? "บัญชีนี้ยังไม่มีสิทธิ์ดูรายการฝากส่ง" : "ตัวกรองไม่ถูกต้อง"}</h1><p>{error.message}</p><Link className="secondary-button" href="/consignments">ล้างตัวกรอง</Link></div>;
    throw error;
  }
  const p = await db.$transaction((tx) => principal(tx, actor.id));
  const [branches, categories] = await Promise.all([db.branch.findMany({ where: { archived: false, destinationType: "BRANCH" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }), db.consignmentCategory.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, name: true } })]);
  const link = (page: number) => { const q = new URLSearchParams(params); if (page > 1) q.set("page", String(page)); else q.delete("page"); return `/consignments?${q}`; };
  const exportParams = new URLSearchParams(params); exportParams.delete("page");
  return <div className="container list-page">
    <header className="list-header"><div><p className="eyebrow"><span />ประวัติฝากส่ง</p><h1>รายการฝากของส่งรถ</h1><p className="muted">แสดงเฉพาะรายการในขอบเขตงานของคุณ ฉบับร่างแสดงเฉพาะผู้สร้าง</p></div>
      {p.permissions.has("consignment.create") && <Link className="primary-button" href="/consign"><PackagePlus size={18} aria-hidden="true" />ฝากของส่งรถ</Link>}</header>
    <form className="history-filters" action="/consignments" role="search" aria-label="กรองรายการฝากส่ง">
      <label>เลขที่หรือชื่อรายการ<input name="q" defaultValue={filter.query} maxLength={100} placeholder="เช่น FS-25691006 หรือ โปสเตอร์" /></label>
      <label>สถานะ<select name="status" defaultValue={filter.status[0] ?? ""}><option value="">ทุกสถานะ</option>{Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>สาขาปลายทาง<select name="branch" defaultValue={filter.branchId ?? ""}><option value="">ทุกสาขา</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</select></label>
      <label>หมวดสิ่งของ<select name="category" defaultValue={filter.categoryId ?? ""}><option value="">ทุกหมวด</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>วันที่ส่ง (พ.ศ.)<input name="date" defaultValue={filter.date ? beDate(filter.date) : ""} placeholder="วว/ดด/ปปปป" inputMode="numeric" /></label>
      <label>รหัสรอบรถ<input name="trip" defaultValue={filter.tripCode ?? ""} maxLength={64} /></label>
      <label className="checkbox-label"><input type="checkbox" name="mine" value="1" defaultChecked={filter.mine} />เฉพาะรายการของฉัน</label>
      <div className="filter-actions"><button className="primary-button"><Search size={17} aria-hidden="true" />ค้นหา</button><Link className="secondary-button" href="/consignments">ล้างตัวกรอง</Link></div>
    </form>
    <section className="search-card results" aria-label="รายการฝากส่ง">
      <div className="results-head"><p className="count-badge" role="status">พบ {result.total.toLocaleString("th-TH")} รายการ</p>
        <a className="secondary-button" href={`/api/consignments/export?${exportParams}`}><Download size={16} aria-hidden="true" />ส่งออก CSV</a></div>
      {result.rows.length === 0 ? <div className="results-state"><div><h2>ไม่พบรายการฝากส่ง</h2><p>ลองล้างตัวกรอง หรือสร้างคำขอใหม่</p></div></div>
        : <ul className="history-list">{result.rows.map((r) => <li key={r.id} className="history-item">
          <div className="history-main">
            <p className="history-code"><Link href={`/consignments/${r.id}`}>{r.code}</Link><span className={`status-pill ${statusTone(r.status)}`}>{statusText(r.status)}</span></p>
            <p>{r.items.map((i) => `${i.name} ${Number(i.quantity).toLocaleString("th-TH")} ${unitText(i.unit)}`).join(", ") || "ยังไม่มีรายการ"} · {r.packageCount} หีบห่อ</p>
            <p className="muted small">ถึง {r.branch.name} ({r.branch.code}) · จาก {r.warehouse} · โดย {r.requester} · สร้าง {thaiDateTime(r.createdAt)} น.</p>
          </div>
          <div className="history-trip">{r.trip ? <><strong>{r.trip.code}</strong><span>{r.trip.serviceDate ? beDate(r.trip.serviceDate) : ""} · {roundLabel(r.trip.roundNo)}</span><span>{r.trip.plate ?? ""}</span></> : <span className="muted">{r.requestedServiceDate ? `ต้องการส่ง ${beDate(r.requestedServiceDate)}` : "ยังไม่จัดรถ"}</span>}</div>
        </li>)}</ul>}
      {result.pageCount > 1 && <div className="results-foot"><span>หน้า {result.page} จาก {result.pageCount}</span><nav className="pager" aria-label="เลือกหน้า">
        {result.page > 1 ? <Link className="secondary-button" href={link(result.page - 1)}>ก่อนหน้า</Link> : <span className="secondary-button" aria-disabled="true">ก่อนหน้า</span>}
        {result.page < result.pageCount ? <Link className="secondary-button" href={link(result.page + 1)}>ถัดไป</Link> : <span className="secondary-button" aria-disabled="true">ถัดไป</span>}</nav></div>}
    </section>
  </div>;
}
