import Link from "next/link";
export default function TripNotFound() {
  return <div className="container message-page"><span className="eyebrow">รายละเอียดรอบรถ</span><h1>ไม่พบรอบรถหรือคุณไม่มีสิทธิ์เข้าถึง</h1><p>รอบรถนี้อาจไม่อยู่ในแผนที่เผยแพร่ หรืออยู่นอกขอบเขตงานของคุณ</p><Link href="/" className="primary-button">กลับหน้าค้นหา</Link></div>;
}
