import Link from "next/link";
export default function ConsignmentNotFound() {
  return <div className="container message-page"><span className="eyebrow">รายละเอียดฝากส่ง</span><h1>ไม่พบรายการฝากส่งหรือคุณไม่มีสิทธิ์เข้าถึง</h1><p>ฉบับร่างเปิดได้เฉพาะผู้สร้าง และรายการอื่นแสดงตามขอบเขตงานของคุณ</p><Link href="/consignments" className="primary-button">กลับไปประวัติฝากส่ง</Link></div>;
}
