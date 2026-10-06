import Link from "next/link";
import { Building2, CalendarRange, ChevronRight, Container, Drumstick, FileSpreadsheet, IdCard, Package, Store, ThermometerSnowflake, Truck, Warehouse, type LucideIcon } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { principal } from "@/server/auth/permissions";
import { masterDefinitions } from "@/lib/master-definitions";

// One icon per kind of data, so each card can be recognised before its title is read.
const icons: Record<string, LucideIcon> = {
  vehicles: Truck, "vehicle-types": Container, drivers: IdCard, branches: Store, "product-categories": Drumstick,
  "storage-conditions": ThermometerSnowflake, "consignment-categories": Package, warehouses: Warehouse, departments: Building2,
};
function Card({ href, icon: Icon, title, text }: { href: string; icon: LucideIcon; title: string; text: string }) {
  return <Link href={href} className="admin-card admin-tile">
    <span className="card-mark" aria-hidden="true"><Icon size={24} strokeWidth={2} /></span>
    <h2>{title}<ChevronRight size={18} aria-hidden="true" className="tile-chevron" /></h2>
    <p className="muted">{text}</p>
  </Link>;
}

export default async function AdminPage(){
  const actor=await requirePageActor(),p=await getDatabase().$transaction(tx=>principal(tx,actor.id));
  const available=Object.entries(masterDefinitions).filter(([kind])=>p.permissions.has(`master.${kind}.read`));
  return <><h1>ข้อมูลหลักและการตั้งค่า</h1><p className="muted">เลือกหมวดข้อมูลที่ต้องการจัดการ ระบบแสดงเฉพาะรายการตามสิทธิ์ของคุณ</p><div className="admin-grid">
    {p.global&&p.permissions.has("plan.read")&&<Card href="/admin/planning" icon={CalendarRange} title="แผนเดินรถรายวัน" text="เส้นทาง แม่แบบ ความครบถ้วน และประวัติแผน" />}
    {p.global&&p.permissions.has("import.manage")&&<Card href="/admin/imports" icon={FileSpreadsheet} title="นำเข้าข้อมูล" text="พักไฟล์ ตรวจสอบรายแถว และนำเข้าทั้งชุด" />}
    {available.map(([kind,d])=><Card key={kind} href={`/admin/${kind}`} icon={icons[kind]??Package} title={d.title} text={p.permissions.has(`master.${kind}.write`)?"ค้นหา เพิ่ม และแก้ไขข้อมูล":"ค้นหาและดูข้อมูลตามสิทธิ์"} />)}
  </div>{!available.length&&<p className="admin-card">บัญชีนี้ยังไม่มีสิทธิ์ดูข้อมูลหลัก กรุณาติดต่อผู้ดูแล</p>}</>;
}
