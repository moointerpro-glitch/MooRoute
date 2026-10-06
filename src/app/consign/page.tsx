import Link from "next/link";
import { notFound } from "next/navigation";
import { Construction, PackagePlus, Search } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { tripDetail } from "@/server/services/trip-search";
import { DomainError } from "@/server/domain/errors";
import { roundLabel, thaiLongDate, UNKNOWN_TIME } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ฝากของส่งรถ" };

/** Hand-off target for the eligible-trip action. Submission belongs to Phase 6 and is not offered here. */
export default async function ConsignPage({ searchParams }: { searchParams: Promise<{ trip?: string; branch?: string }> }) {
  const actor = await requirePageActor(), { trip: tripId, branch } = await searchParams;
  const notice = <p className="notice-panel" role="note"><Construction size={20} aria-hidden="true" /><span><strong>ระบบรับคำขอฝากส่งยังไม่เปิดใช้งาน</strong> หน้านี้แสดงรอบรถและสาขาที่เลือกไว้ให้ตรวจสอบเท่านั้น ยังไม่มีการบันทึกหรือส่งคำขอใด ๆ</span></p>;
  if (!tripId) return <div className="container detail-page"><h1>ฝากของส่งรถ</h1>{notice}<p>เลือกรอบรถจากหน้าค้นหา แล้วกด “ฝากของกับรอบนี้” ในรายละเอียดรอบรถ</p><Link className="primary-button" href="/"><Search size={18} aria-hidden="true" />ไปหน้าค้นหา</Link></div>;
  let trip;
  try { trip = await tripDetail(getDatabase(), actor.id, tripId, { branchId: branch ?? null }); }
  catch (error) { if (error instanceof DomainError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) notFound(); throw error; }
  const destination = trip.stops.find((s) => s.matched);
  return <div className="container detail-page">
    <p className="eyebrow"><span />ฝากของส่งรถ</p><h1>ตรวจสอบรอบรถที่เลือก</h1>{notice}
    <section className="detail-card" aria-labelledby="selected-trip"><h2 id="selected-trip"><PackagePlus size={19} aria-hidden="true" />ปลายทางและรอบรถ</h2>
      <dl className="fact-list">
        <div><dt>วันที่ให้บริการ</dt><dd>{thaiLongDate(trip.serviceDate)}</dd></div>
        <div><dt>รอบรถ</dt><dd>{trip.routeName ?? trip.code} · {roundLabel(trip.roundNo)}</dd></div>
        <div><dt>สาขาปลายทาง</dt><dd>{destination ? `${destination.name} (${destination.branchCode})` : "ยังไม่ได้เลือกสาขาที่รอบรถนี้แวะส่ง"}</dd></div>
        <div><dt>เวลาออกรถ</dt><dd>{trip.departure ? `${trip.departure.label} น.` : UNKNOWN_TIME}</dd></div>
        <div><dt>ทะเบียนรถ</dt><dd>{trip.vehicle ? `${trip.vehicle.plate} ${trip.vehicle.province}` : UNKNOWN_TIME}</dd></div>
        <div><dt>ผลตรวจสอบเบื้องต้น</dt><dd>{trip.eligibility.eligible ? "รอบรถนี้รับฝากได้ตามข้อมูลปัจจุบัน (ต้องตรวจสอบเวลาปิดรับอีกครั้งเมื่อส่งคำขอ)" : trip.eligibility.reasons.join(" · ")}</dd></div>
      </dl>
      <Link className="secondary-button" href={`/trips/${encodeURIComponent(trip.tripId)}${destination ? `?branch=${encodeURIComponent(destination.branchId)}` : ""}`}>กลับไปรายละเอียดรอบรถ</Link>
    </section>
  </div>;
}
