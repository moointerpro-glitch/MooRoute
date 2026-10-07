import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { searchOptions, searchTrips } from "@/server/services/trip-search";
import { SEARCH_PAGE_SIZE } from "@/server/domain/search";
import { DomainError } from "@/server/domain/errors";
import { TripResults } from "@/components/trip-results";
import { bangkokServiceDate } from "@/lib/bangkok-date";
import { beDate, isoFromBe, shiftDate, thaiLongDate } from "@/lib/trip-format";
import { DateInput } from "@/components/date-time-inputs";

export const dynamic = "force-dynamic";
export const metadata = { title: "รอบรถทั้งหมด" };

export default async function AllTripsPage({ searchParams }: { searchParams: Promise<{ date?: string; page?: string }> }) {
  const actor = await requirePageActor(), raw = await searchParams, today = bangkokServiceDate();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date ?? "") ? raw.date! : isoFromBe(raw.date ?? "") ?? today;
  const page = Math.min(10_000, Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1));
  let result;
  try {
    const { kinds } = await searchOptions(getDatabase(), actor.id);
    result = await searchTrips(getDatabase(), actor.id, { serviceDate: date, mode: "time", branchId: null, query: "", times: [], from: null, to: null, basis: "departure", rounds: [], categoryIds: [], kinds, sort: "time_asc", page, pageSize: SEARCH_PAGE_SIZE });
  } catch (error) {
    if (error instanceof DomainError && ["FORBIDDEN", "INVALID_SEARCH"].includes(error.code)) {
      return <div className="container message-page"><span className="eyebrow">รอบรถทั้งหมด</span><h1>{error.code === "FORBIDDEN" ? "บัญชีนี้ยังไม่มีสิทธิ์ดูรอบรถ" : "วันที่ไม่ถูกต้อง"}</h1><p>{error.message}</p><Link className="secondary-button" href="/trips">กลับไปวันนี้</Link></div>;
    }
    throw error;
  }
  const link = (d: string, p = 1) => `/trips?date=${d}${p > 1 ? `&page=${p}` : ""}`;
  return <div className="container list-page">
    <header className="list-header"><div><p className="eyebrow"><span />รอบรถทั้งหมด</p><h1>รอบรถที่เผยแพร่ทุกประเภท</h1><p className="muted">{thaiLongDate(date)} · แสดงตามสิทธิ์ของคุณ เรียงตามเวลาออกรถ</p></div>
      <nav className="date-nav" aria-label="เปลี่ยนวันที่">
        <Link className="secondary-button" href={link(shiftDate(date, -1))} aria-label="วันก่อนหน้า"><ChevronLeft size={18} aria-hidden="true" /></Link>
        <form action="/trips" className="date-form"><label htmlFor="trips-date" className="sr-only">วันที่ให้บริการ (พ.ศ.)</label><DateInput id="trips-date" name="date" defaultValue={beDate(date)} required /><button className="secondary-button">ไป</button></form>
        <Link className="secondary-button" href={link(shiftDate(date, 1))} aria-label="วันถัดไป"><ChevronRight size={18} aria-hidden="true" /></Link>
      </nav></header>
    <section className="search-card results" aria-label="รายการรอบรถ">
      <div className="results-head"><p className="count-badge" role="status">พบ {result.total.toLocaleString("th-TH")} รอบรถ</p>{date !== today && <Link className="text-link" href="/trips">กลับไปวันนี้</Link>}</div>
      {!result.published ? <div className="results-state"><div><h2>ยังไม่มีแผนเดินรถที่เผยแพร่</h2><p>เลือกวันอื่น หรือติดต่อผู้วางแผนขนส่ง</p></div></div>
        : result.total === 0 ? <div className="results-state"><div><h2>ไม่มีรอบรถที่คุณมีสิทธิ์ดูในวันนี้</h2><p>รอบรถที่แสดงขึ้นกับขอบเขตงานของบัญชี</p></div></div>
        : <><TripResults rows={result.rows} caption={`รอบรถทั้งหมด ${thaiLongDate(date)}`} />
          <div className="results-foot"><span>หน้า {result.page} จาก {result.pageCount}</span><nav className="pager" aria-label="เลือกหน้า">
            {result.page > 1 ? <Link className="secondary-button" href={link(date, result.page - 1)}>ก่อนหน้า</Link> : <span className="secondary-button" aria-disabled="true">ก่อนหน้า</span>}
            {result.page < result.pageCount ? <Link className="secondary-button" href={link(date, result.page + 1)}>ถัดไป</Link> : <span className="secondary-button" aria-disabled="true">ถัดไป</span>}
          </nav></div></>}
    </section>
  </div>;
}
