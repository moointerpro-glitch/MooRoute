import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock3, PackageCheck, Search } from "lucide-react";

export const metadata: Metadata = { title: "คู่มือการใช้งาน" };

export default function GuidePage() {
  return <div className="container guide-content"><Link href="/" className="text-link"><ArrowLeft size={18} aria-hidden="true" />กลับหน้าค้นหา</Link>
    <div className="guide-heading"><span className="eyebrow">เริ่มต้นใช้งาน</span><h1>รู้จักรอบรถและการฝากส่ง</h1><p>ข้อมูลเบื้องต้นสำหรับผู้ฝาก ผู้จัดรถ และผู้รับสาขา</p></div>
    <div className="guide-sections">
      <section className="guide-section"><Search aria-hidden="true" /><div><h2>ค้นหารอบรถได้ 3 วิธี</h2><p>ค้นหาจากชื่อหรือรหัสสาขา เลือกเวลาได้หลายค่า หรือระบุช่วงเวลาที่ต้องการ เมื่อเปิดให้บริการ ผลการค้นหาจะอ้างอิงวันที่เลือกและเที่ยวรถที่เผยแพร่ตามสิทธิ์ของคุณ</p></div></section>
      <section className="guide-section"><Clock3 aria-hidden="true" /><div><h2>เวลาเริ่มขึ้นของและเวลาออกรถ</h2><p>เวลาเริ่มขึ้นของคือเวลาเริ่มโหลดสินค้า ส่วนเวลาออกรถคือกำหนดออกจากต้นทาง หากยังไม่มีเวลาออกรถ ระบบจะแสดงว่ายังไม่ระบุ จึงควรตรวจประเภทเวลาทุกครั้ง</p></div></section>
      <section className="guide-section"><PackageCheck aria-hidden="true" /><div><h2>หมูและไก่ครบ 3 รอบต่อวัน</h2><p>ทุกสาขาที่เปิดให้บริการต้องมีหมูและไก่ในรอบ 1 รอบ 2 และรอบ 3 ครบก่อนเผยแพร่แผน เที่ยวรับเข้าคลังไม่นับเป็นเที่ยวส่งสาขา หนึ่งเที่ยวสามารถส่งได้หลายสาขา</p></div></section>
      <section className="guide-section"><PackageCheck aria-hidden="true" /><div><h2>จำนวนสิ่งของและจำนวนหีบห่อ</h2><p>หนึ่งใบฝากส่งถึงหนึ่งสาขา จำนวนสิ่งของแยกจากจำนวนกล่อง เช่น โปสเตอร์ตัวอย่าง 30 แผ่น บรรจุ 3 กล่อง คือสิ่งของ 30 แผ่นและหีบห่อ 3 รายการ</p></div></section>
    </div><aside className="guide-status"><h2>สถานะการเปิดบริการ</h2><p>เข้าสู่ระบบและจัดการข้อมูลหลักได้ตามสิทธิ์ บริการค้นหารอบรถ ฝากส่ง และรับของผ่านหน้าจอยังไม่เปิดใช้งาน</p></aside>
  </div>;
}
