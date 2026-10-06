import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, PackageCheck, Route, Search, ShieldCheck } from "lucide-react";
import { SearchShell } from "@/components/search-shell";
import { bangkokServiceDate, thaiServiceDate } from "@/lib/bangkok-date";
import { branchDeliveryPolicy } from "@/server/domain/transport-policy";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const serviceDate = bangkokServiceDate();
  const dateLabel = thaiServiceDate(serviceDate);
  return <div className="container home-content">
    <section className="hero" aria-labelledby="page-title">
      <div><div className="eyebrow"><span />ทุกเส้นทาง เพื่อทุกสาขา</div><h1 id="page-title">ค้นหาเส้นทางเดินรถ <span>หมูอินเตอร์</span></h1><p>ค้นหาสายรถตามสาขา เวลา และช่วงเวลา</p></div>
      <div className="today-card"><CalendarDays size={20} aria-hidden="true" /><div><span>วันนี้</span><time dateTime={serviceDate}>{dateLabel}</time></div></div>
    </section>
    <div className="metrics" aria-label="ข้อมูลการให้บริการ">
      <div className="metric"><span className="metric-icon"><Route aria-hidden="true" /></span><div><div className="metric-value">ยังไม่เปิดบริการ</div><h2>รอบรถที่เผยแพร่</h2><p>แสดงข้อมูลตามวันที่ให้บริการ</p></div></div>
      <div className="metric"><span className="metric-icon"><PackageCheck aria-hidden="true" /></span><div><div className="metric-value">{branchDeliveryPolicy.requiredRounds.length} <span>รอบ / วัน</span></div><h2>หมูและไก่ ครบทุกสาขา</h2><p>เงื่อนไขก่อนเผยแพร่แผนเดินรถ</p></div></div>
      <div className="metric"><span className="metric-icon"><Search aria-hidden="true" /></span><div><div className="metric-value">3 <span>รูปแบบการค้นหา</span></div><h2>สาขา · เวลา · ช่วงเวลา</h2><p>รวมไว้ในหน้าค้นหาเดียว</p></div></div>
    </div>
    <SearchShell dateLabel={dateLabel} />
    <section className="help-strip" aria-label="ข้อควรรู้"><div className="help-item"><ShieldCheck size={23} aria-hidden="true" /><div><h2>ตรวจครบก่อนเผยแพร่</h2><p>หมูและไก่ต้องครบทั้ง 3 รอบของทุกสาขาที่เปิดให้บริการ</p></div></div><div className="help-item"><Clock3 size={23} aria-hidden="true" /><div><h2>เช็กประเภทเวลาให้ตรงกัน</h2><p>เวลาเริ่มขึ้นของและเวลาออกรถเป็นคนละเวลา</p></div></div><Link href="/guide" className="text-link">อ่านคู่มือ<ArrowRight size={17} aria-hidden="true" /></Link></section>
  </div>;
}
