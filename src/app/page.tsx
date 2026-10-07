import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, CalendarDays, Clock3, LogIn, Route, Search, ShieldCheck } from "lucide-react";
import { SearchShell } from "@/components/search-shell";
import { TripSearch } from "@/components/trip-search";
import { bangkokServiceDate, thaiServiceDate } from "@/lib/bangkok-date";
import { optionalActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { searchOptions } from "@/server/services/trip-search";
import { DomainError } from "@/server/domain/errors";

export const dynamic = "force-dynamic";

const help = <section className="help-strip" aria-label="ข้อควรรู้"><div className="help-item"><ShieldCheck size={23} aria-hidden="true" /><div><h2>แสดงเฉพาะแผนที่เผยแพร่แล้ว</h2><p>ผลการค้นหาคำนวณจากรอบรถจริงตามวันที่และสิทธิ์ของคุณ</p></div></div><div className="help-item"><Clock3 size={23} aria-hidden="true" /><div><h2>เช็กประเภทเวลาให้ตรงกัน</h2><p>เวลาเริ่มขึ้นของและเวลาออกรถเป็นคนละเวลา</p></div></div><Link href="/guide" className="text-link">อ่านคู่มือ<ArrowRight size={17} aria-hidden="true" /></Link></section>;

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const serviceDate = bangkokServiceDate();
  const actor = await optionalActor(await headers());
  if (actor) {
    try {
      const options = await searchOptions(getDatabase(), actor.id);
      const raw = await searchParams, params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
      return <><TripSearch today={serviceDate} options={options} params={params} /><div className="container">{help}</div></>;
    } catch (error) {
      if (!(error instanceof DomainError && error.code === "FORBIDDEN")) throw error;
      return <div className="container message-page"><span className="eyebrow">ค้นหาเส้นทาง</span><h1>บัญชีนี้ยังไม่มีสิทธิ์ค้นหารอบรถ</h1><p>กรุณาติดต่อผู้ดูแลเพื่อกำหนดประเภทบัญชีและขอบเขตงานที่ใช้ค้นหารอบรถ</p><Link href="/guide" className="secondary-button">อ่านคู่มือ</Link></div>;
    }
  }
  const dateLabel = thaiServiceDate(serviceDate);
  return <div className="container home-content">
    <section className="hero" aria-labelledby="page-title">
      <div><div className="eyebrow"><span />ทุกเส้นทาง เพื่อทุกสาขา</div><h1 id="page-title">ค้นหาเส้นทางเดินรถ <span>หมูอินเตอร์</span></h1><p>ค้นหาสายรถตามสาขา เวลา และช่วงเวลา</p></div>
      <div className="today-card"><CalendarDays size={20} aria-hidden="true" /><div><span>วันนี้</span><time dateTime={serviceDate}>{dateLabel}</time></div></div>
    </section>
    <div className="metrics" aria-label="ข้อมูลการให้บริการ">
      <div className="metric"><span className="metric-icon"><Route aria-hidden="true" /></span><div><div className="metric-value">เข้าสู่ระบบ</div><h2>รอบรถที่เผยแพร่</h2><p>แสดงจำนวนจริงตามสิทธิ์หลังเข้าสู่ระบบ</p></div></div>
      <div className="metric"><span className="metric-icon"><LogIn aria-hidden="true" /></span><div><div className="metric-value">ตามสิทธิ์</div><h2>ช่วงเวลาเดินรถ</h2><p>คำนวณจากข้อมูลรอบรถของวันที่เลือก</p></div></div>
      <div className="metric"><span className="metric-icon"><Search aria-hidden="true" /></span><div><div className="metric-value">3 <span>รูปแบบการค้นหา</span></div><h2>สาขา · เวลา · ช่วงเวลา</h2><p>รวมไว้ในหน้าค้นหาเดียว</p></div></div>
    </div>
    <SearchShell dateLabel={dateLabel} />
    {help}
  </div>;
}
