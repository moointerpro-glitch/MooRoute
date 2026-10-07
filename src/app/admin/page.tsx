import Link from "next/link";
import { Building2, CalendarRange, ChevronRight, FileSpreadsheet, IdCard, Package, Store, Tags, ThermometerSnowflake, Truck, UsersRound, Van, Warehouse, type LucideIcon } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { accountSummary } from "@/server/services/account";
import { backofficeAreas, type BackofficeArea } from "@/lib/navigation";

export const metadata = { title: "จัดการหลังบ้าน" };

// One icon per kind of work or data, so each card is recognised before its title is read.
const icons: Record<string, LucideIcon> = {
  planning: CalendarRange, imports: FileSpreadsheet, users: UsersRound, vehicles: Truck, "vehicle-types": Van, drivers: IdCard, branches: Store,
  "product-categories": Tags, "storage-conditions": ThermometerSnowflake, "consignment-categories": Package, warehouses: Warehouse, departments: Building2,
};
const summaries: Record<string, string> = {
  planning: "เส้นทาง แม่แบบ ความครบถ้วนหมูและไก่ทั้ง ๓ รอบ และประวัติแผน", imports: "ไฟล์ CSV / XLSX ตรวจทีละแถวก่อนนำเข้าทั้งชุด",
  users: "เพิ่มบัญชี กำหนดประเภทและขอบเขต ปิดใช้งาน และออกรหัสผ่านชั่วคราว",
};

/** One card per work area: icon, title and a short summary. */
function WorkCard({ area }: { area: BackofficeArea }) {
  const Icon = icons[area.id] ?? Package;
  return <Link href={area.href} className="admin-card admin-tile">
    <span className="card-mark" aria-hidden="true"><Icon size={24} strokeWidth={2} /></span>
    <h3>{area.title}<ChevronRight size={18} aria-hidden="true" className="tile-chevron" /></h3>
    <p className="muted">{summaries[area.id] ?? "ค้นหา เพิ่ม และแก้ไขข้อมูล"}</p>
  </Link>;
}

export default async function AdminPage() {
  const actor = await requirePageActor();
  const { p, typeName, scopes } = await getDatabase().$transaction((tx) => accountSummary(tx, actor.id));
  const areas = backofficeAreas(p.permissions, p.global);
  return <>
    <header className="backoffice-head">
      <h1>งานหลังบ้านของคุณ</h1>
      <p className="muted">ประเภทบัญชี <strong>{typeName}</strong> · ขอบเขต <strong>{scopes.join(", ") || "-"}</strong> · แสดงเฉพาะส่วนที่บัญชีนี้รับผิดชอบ</p>
    </header>
    {areas.length > 0 && <section aria-labelledby="work-heading" className="backoffice-section">
      <h2 id="work-heading" className="section-title">งานของคุณ</h2>
      <div className="admin-grid">{areas.map((a) => <WorkCard key={a.id} area={a} />)}</div>
    </section>}
    {!areas.length && <div className="admin-card empty-backoffice"><h2>บัญชีนี้ไม่มีงานหลังบ้าน</h2><p className="muted">งานของคุณอยู่ที่เมนูด้านบน หากต้องดูแลข้อมูลหลักหรือแผนเดินรถ กรุณาติดต่อผู้ดูแลระบบ</p><Link className="secondary-button" href="/">กลับหน้าหลัก</Link></div>}
  </>;
}
