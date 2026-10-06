import Link from "next/link";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { principal } from "@/server/auth/permissions";
import { masterDefinitions } from "@/lib/master-definitions";
export default async function AdminPage(){
  const actor=await requirePageActor(),p=await getDatabase().$transaction(tx=>principal(tx,actor.id));
  const available=Object.entries(masterDefinitions).filter(([kind])=>p.permissions.has(`master.${kind}.read`));
  return <><h1>ข้อมูลหลักและการตั้งค่า</h1><p className="muted">เลือกหมวดข้อมูลที่ต้องการจัดการ ระบบแสดงเฉพาะรายการตามสิทธิ์ของคุณ</p><div className="admin-grid">{p.global&&p.permissions.has("plan.read")&&<Link href="/admin/planning" className="admin-card"><span className="card-mark" aria-hidden="true">↗</span><h2>แผนเดินรถรายวัน</h2><p className="muted">เส้นทาง แม่แบบ ความครบถ้วน และประวัติแผน</p></Link>}{p.global&&p.permissions.has("import.manage")&&<Link href="/admin/imports" className="admin-card"><span className="card-mark" aria-hidden="true">↗</span><h2>นำเข้าข้อมูล</h2><p className="muted">พักไฟล์ ตรวจสอบรายแถว และนำเข้าทั้งชุด</p></Link>}{available.map(([kind,d])=><Link href={`/admin/${kind}`} className="admin-card" key={kind}><span className="card-mark" aria-hidden="true">↗</span><h2>{d.title}</h2><p className="muted">{p.permissions.has(`master.${kind}.write`)?"ค้นหา เพิ่ม และแก้ไขข้อมูล":"ค้นหาและดูข้อมูลตามสิทธิ์"}</p></Link>)}</div>{!available.length&&<p className="admin-card">บัญชีนี้ยังไม่มีสิทธิ์ดูข้อมูลหลัก กรุณาติดต่อผู้ดูแล</p>}</>;
}
