import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Info, MapPin, PackagePlus, Phone, Truck, UserRound } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { tripDetail } from "@/server/services/trip-search";
import { DomainError } from "@/server/domain/errors";
import { roundLabel, thaiDateTime, thaiLongDate, tripKindLabels, UNKNOWN_TIME } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายละเอียดรอบรถ" };

export default async function TripDetailPage({ params, searchParams }: { params: Promise<{ tripId: string }>; searchParams: Promise<{ branch?: string }> }) {
  const actor = await requirePageActor(), { tripId } = await params, { branch } = await searchParams;
  let trip;
  try { trip = await tripDetail(getDatabase(), actor.id, tripId, { branchId: branch ?? null }); }
  catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    if (error instanceof DomainError && error.code === "FORBIDDEN") return <div className="container message-page"><span className="eyebrow">รายละเอียดรอบรถ</span><h1>บัญชีนี้ยังไม่มีสิทธิ์ดูรอบรถ</h1><p>กรุณาติดต่อผู้ดูแลเพื่อกำหนดบทบาทและขอบเขตงาน</p></div>;
    throw error;
  }
  const back = `/?date=${trip.serviceDate}${trip.branchId ? `&mode=branch&branch=${encodeURIComponent(trip.branchId)}` : ""}`;
  const times: Array<[string, typeof trip.loading]> = [["เวลาเริ่มขึ้นของ", trip.loading], ["เวลาออกรถ", trip.departure], ["เวลาถึงปลายทาง", trip.arrival]];
  const matched = trip.stops.find((s) => s.matched);
  return <div className="container detail-page">
    <Link href={back} className="text-link"><ArrowLeft size={17} aria-hidden="true" />กลับหน้าค้นหา</Link>
    <header className="detail-header">
      <div><p className="eyebrow"><span />{tripKindLabels[trip.kind]} · {roundLabel(trip.roundNo)}</p>
        <h1>{trip.routeName ?? trip.code}</h1>
        <p className="muted">รหัสรอบรถ {trip.code} · <CalendarDays size={14} aria-hidden="true" className="inline-icon" />{thaiLongDate(trip.serviceDate)}</p></div>
      <span className={trip.cancelled ? "status-badge status-cancelled" : "status-badge status-published"}>{trip.cancelled ? "ยกเลิก" : `เผยแพร่แล้ว (ฉบับที่ ${trip.published.number})`}</span>
    </header>
    <div className="detail-grid">
      <section className="detail-card" aria-labelledby="times-title"><h2 id="times-title"><Clock3 size={19} aria-hidden="true" />เวลา</h2>
        <dl className="fact-list">{times.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ? <time dateTime={value.at}>{value.label} น.</time> : <span className="time-unknown">{UNKNOWN_TIME}</span>}</dd></div>)}</dl>
        <p className="field-hint">เวลาเริ่มขึ้นของไม่ใช่เวลาออกรถ หากเวลาอยู่คนละวันจะระบุ (วันก่อนหน้า) หรือ (วันถัดไป)</p>
      </section>
      <section className="detail-card" aria-labelledby="vehicle-title"><h2 id="vehicle-title"><Truck size={19} aria-hidden="true" />รถและผู้ขับ</h2>
        {trip.vehicle ? <dl className="fact-list">
          <div><dt>ทะเบียนรถ</dt><dd><strong>{trip.vehicle.plate}</strong> {trip.vehicle.province}</dd></div>
          <div><dt>ประเภทรถ</dt><dd>{trip.vehicle.typeName}{trip.vehicle.wheelCount ? ` · ${trip.vehicle.wheelCount} ล้อ` : ""}</dd></div>
          <div><dt>ยี่ห้อ / รุ่น / สี</dt><dd>{[trip.vehicle.brand, trip.vehicle.model, trip.vehicle.color].filter(Boolean).join(" / ") || UNKNOWN_TIME}</dd></div>
          <div><dt>การเก็บรักษา</dt><dd>{trip.vehicle.storage}</dd></div>
          <div><dt>ความจุ</dt><dd>{trip.vehicle.capacity ? `${trip.vehicle.capacity} ${trip.vehicle.capacityUnit ?? ""}` : "ไม่ทราบความจุ"}</dd></div>
        </dl> : <p className="muted">ยังไม่ระบุรถ</p>}
        <p className="detail-driver"><UserRound size={16} aria-hidden="true" />{trip.driver.visible ? <>{trip.driver.name}{trip.driver.phone ? <> · <a href={`tel:${trip.driver.phone}`}>{trip.driver.phone}</a></> : null}</> : "ข้อมูลพนักงานขับรถแสดงเฉพาะผู้มีสิทธิ์"}</p>
      </section>
    </div>
    <section className="detail-card" aria-labelledby="stops-title"><h2 id="stops-title"><MapPin size={19} aria-hidden="true" />จุดส่งตามลำดับ ({trip.stops.length} จุด)</h2>
      <ol className="detail-stops">{trip.stops.map((s) => <li key={s.sequence} className={s.matched ? "stop-matched" : undefined}>
        <div className="stop-head"><span className="stop-no" aria-hidden="true">{s.sequence}</span><div><h3>{s.name} <small>{s.branchCode}</small>{s.matched && <span className="match-badge">สาขาที่เลือก</span>}</h3>
          <p className="muted">{s.address}</p>
          <p>หมวดสินค้าที่จุดนี้: {s.categories.length ? s.categories.map((c) => c.name).join(", ") : "ไม่มีหมวดสินค้าที่ระบุ"}</p>
          <p className="stop-contact"><Phone size={14} aria-hidden="true" />{s.contact.visible ? (s.contact.name || s.contact.phone ? <>{s.contact.name}{s.contact.phone ? <> · <a href={`tel:${s.contact.phone}`}>{s.contact.phone}</a></> : null}</> : "ยังไม่มีข้อมูลผู้ติดต่อ") : "ข้อมูลติดต่อแสดงเฉพาะผู้มีสิทธิ์ของสาขานี้"}</p></div></div>
      </li>)}</ol>
    </section>
    {trip.notes && <section className="detail-card"><h2><Info size={19} aria-hidden="true" />หมายเหตุ</h2><p>{trip.notes}</p></section>}
    <section className="detail-card consign-card" aria-labelledby="consign-title"><h2 id="consign-title"><PackagePlus size={19} aria-hidden="true" />ฝากของกับรอบนี้</h2>
      {trip.eligibility.eligible && matched ? <>
        <p><CheckCircle2 size={16} aria-hidden="true" className="inline-icon ok" />รอบรถนี้แวะส่ง <strong>{matched.name}</strong> และยังไม่ถึงเวลาออกรถ ตรวจสอบเบื้องต้นแล้ว</p>
        <Link className="primary-button" href={`/consign?trip=${encodeURIComponent(trip.tripId)}&branch=${encodeURIComponent(matched.branchId)}`}>ฝากของกับรอบนี้</Link>
        <p className="field-hint">ระบบรับคำขอฝากส่งยังไม่เปิดใช้งาน ปุ่มนี้จะพาไปตรวจข้อมูลรอบรถที่เลือกไว้เท่านั้น</p>
      </> : <>
        <button type="button" className="primary-button" disabled aria-describedby="consign-reasons">ฝากของกับรอบนี้</button>
        <ul id="consign-reasons" className="reason-list">{trip.eligibility.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      </>}
    </section>
    <p className="muted small">ข้อมูลจากแผนที่เผยแพร่{trip.published.publishedAt ? ` เมื่อ ${thaiDateTime(trip.published.publishedAt)} น.` : ""}</p>
  </div>;
}
