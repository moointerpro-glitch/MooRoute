import Link from "next/link";
import { MapPin, Phone, Search } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { branchDirectory } from "@/server/services/trip-search";
import { normalizeQuery } from "@/server/domain/search";
import { DomainError } from "@/server/domain/errors";
import { beDate, destinationLabels } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "สาขาทั้งหมด" };

export default async function BranchesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const actor = await requirePageActor(), raw = await searchParams;
  const page = Math.min(10_000, Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1));
  let query = "", result;
  try { query = normalizeQuery(raw.q ?? ""); result = await branchDirectory(getDatabase(), actor.id, { query, page }); }
  catch (error) {
    if (error instanceof DomainError && ["FORBIDDEN", "INVALID_SEARCH"].includes(error.code)) {
      return <div className="container message-page"><span className="eyebrow">สาขาทั้งหมด</span><h1>{error.code === "FORBIDDEN" ? "บัญชีนี้ยังไม่มีสิทธิ์ดูรายชื่อสาขา" : "คำค้นหาไม่ถูกต้อง"}</h1><p>{error.message}</p><Link className="secondary-button" href="/branches">ดูรายชื่อทั้งหมด</Link></div>;
    }
    throw error;
  }
  const link = (p: number) => `/branches?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;
  return <div className="container list-page">
    <header className="list-header"><div><p className="eyebrow"><span />สาขาทั้งหมด</p><h1>รายชื่อสาขาและจุดส่ง</h1><p className="muted">ค้นหาด้วยชื่อ รหัส หรือชื่อเรียกอื่น ข้อมูลผู้ติดต่อแสดงตามสิทธิ์ของบัญชี</p></div></header>
    <form className="directory-search" action="/branches" role="search"><div className="input-with-icon"><Search size={20} aria-hidden="true" /><label htmlFor="branch-q" className="sr-only">ค้นหาสาขา</label><input id="branch-q" name="q" defaultValue={query} placeholder="พิมพ์ชื่อสาขา รหัส หรือชื่อเรียกอื่น" maxLength={100} /></div><button className="primary-button"><Search size={18} aria-hidden="true" />ค้นหา</button></form>
    <section className="search-card results" aria-label="รายชื่อสาขา">
      <div className="results-head"><p className="count-badge" role="status">พบ {result.total.toLocaleString("th-TH")} สาขา</p>{query && <Link className="text-link" href="/branches">ล้างคำค้นหา</Link>}</div>
      {result.rows.length === 0 ? <div className="results-state"><MapPin size={26} aria-hidden="true" /><div><h2>ไม่พบสาขาที่ตรงกับคำค้น</h2><p>ลองใช้รหัสสาขาหรือชื่อเรียกอื่น</p></div></div>
        : <ul className="branch-list">{result.rows.map((b) => <li key={b.id} className="branch-item">
          <div className="branch-main"><h2>{b.name} <small>{b.code}</small></h2>
            <p className="muted">{destinationLabels[b.destinationType]}{b.activeTo ? ` · เปิดถึง ${beDate(b.activeTo)}` : ""}{b.receiving ? ` · รับของ ${b.receiving} น.` : ""}</p>
            {b.aliases.length > 0 && <p className="alias-line">ชื่อเรียกอื่น: {b.aliases.join(", ")}</p>}
            <p><MapPin size={14} aria-hidden="true" className="inline-icon" />{b.address}</p>
            <p className="stop-contact"><Phone size={14} aria-hidden="true" />{b.contact.visible ? (b.contact.name || b.contact.phone ? <>{b.contact.name}{b.contact.phone ? <> · <a href={`tel:${b.contact.phone}`}>{b.contact.phone}</a></> : null}</> : "ยังไม่มีข้อมูลผู้ติดต่อ") : "ข้อมูลติดต่อแสดงเฉพาะผู้มีสิทธิ์ของสาขานี้"}</p></div>
          <Link className="secondary-button" href={`/?mode=branch&branch=${encodeURIComponent(b.id)}`} aria-label={`ดูรอบรถที่ส่ง ${b.name}`}>ดูรอบรถ</Link>
        </li>)}</ul>}
      {result.pageCount > 1 && <div className="results-foot"><span>หน้า {result.page} จาก {result.pageCount}</span><nav className="pager" aria-label="เลือกหน้า">
        {result.page > 1 ? <Link className="secondary-button" href={link(result.page - 1)}>ก่อนหน้า</Link> : <span className="secondary-button" aria-disabled="true">ก่อนหน้า</span>}
        {result.page < result.pageCount ? <Link className="secondary-button" href={link(result.page + 1)}>ถัดไป</Link> : <span className="secondary-button" aria-disabled="true">ถัดไป</span>}</nav></div>}
    </section>
  </div>;
}
