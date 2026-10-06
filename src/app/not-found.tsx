import Link from "next/link";

export default function NotFound() {
  return <div className="container message-page"><span className="eyebrow">ไม่พบหน้าที่ต้องการ</span><h1>หน้านี้อาจถูกย้ายหรือยังไม่เปิดใช้งาน</h1><p>ตรวจสอบที่อยู่หน้าเว็บ หรือกลับไปเริ่มต้นที่หน้าค้นหา</p><Link href="/" className="primary-button">กลับหน้าค้นหา</Link></div>;
}
