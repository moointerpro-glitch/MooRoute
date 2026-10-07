import Link from "next/link";
import { Building2, CalendarRange, ChevronRight, Eye, FileSpreadsheet, IdCard, Package, Store, Tags, ThermometerSnowflake, Truck, Van, Warehouse, type LucideIcon } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { principal } from "@/server/auth/permissions";
import { backofficeAreas, type BackofficeArea } from "@/lib/navigation";

export const metadata = { title: "จัดการหลังบ้าน" };

// One icon per kind of work or data, so each card is recognised before its title is read.
const icons: Record<string, LucideIcon> = {
  planning: CalendarRange, imports: FileSpreadsheet, vehicles: Truck, "vehicle-types": Van, drivers: IdCard, branches: Store,
  "product-categories": Tags, "storage-conditions": ThermometerSnowflake, "consignment-categories": Package, warehouses: Warehouse, departments: Building2,
};
const summaries: Record<string, string> = {
  planning: "เส้นทาง แม่แบบ ความครบถ้วนหมูและไก่ทั้ง ๓ รอบ และประวัติแผน", imports: "ไฟล์ CSV / XLSX ตรวจทีละแถวก่อนนำเข้าทั้งชุด",
};
const roleNames: Record<string, string> = { ADMINISTRATOR: "ผู้ดูแลระบบ", DISPATCHER: "ผู้จัดรถ", SUPERVISOR: "หัวหน้างาน", WAREHOUSE: "เจ้าหน้าที่คลัง", DRIVER: "พนักงานขับรถ", BRANCH_RECEIVER: "ผู้รับประจำสาขา", REQUESTER: "ผู้ฝากส่ง" };

/** One card per work area: icon, title and a short summary. */
function WorkCard({ area }: { area: BackofficeArea }) {
  const Icon = icons[area.id] ?? Package;
  return <Link href={area.href} className="admin-card admin-tile">
    <span className="card-mark" aria-hidden="true"><Icon size={24} strokeWidth={2} /></span>
    <h3>{area.title}<ChevronRight size={18} aria-hidden="true" className="tile-chevron" /></h3>
    <p className="muted">{summaries[area.id] ?? (area.section === "work" ? "ค้นหา เพิ่ม และแก้ไขข้อมูล" : "ค้นหาและดูข้อมูล")}</p>
  </Link>;
}

export default async function AdminPage() {
  const actor = await requirePageActor();
  const { p, roles, scopeText } = await getDatabase().$transaction(async (tx) => {
    const p = await principal(tx, actor.id);
    const roles = (await tx.userRole.findMany({ where: { userId: actor.id }, include: { role: true } })).map((r) => roleNames[r.role.code] ?? r.role.name);
    // Plain-language scope so the account holder knows whose data they are acting on.
    const scopeText = await Promise.all(p.scopes.map(async (s) => s.kind === "GLOBAL" ? "ทั้งบริษัท"
      : s.kind === "BRANCH" && s.branchId ? `สาขา ${(await tx.branch.findUnique({ where: { id: s.branchId } }))?.name ?? "-"}`
      : s.kind === "WAREHOUSE" && s.warehouseId ? `คลัง ${(await tx.warehouse.findUnique({ where: { id: s.warehouseId } }))?.name ?? "-"}`
      : s.kind === "DEPARTMENT" && s.departmentId ? `แผนก ${(await tx.department.findUnique({ where: { id: s.departmentId } }))?.name ?? "-"}`
      : s.kind === "DRIVER" && s.driverId ? `พนักงานขับรถ ${(await tx.driver.findUnique({ where: { id: s.driverId } }))?.name ?? "-"}` : "-"));
    return { p, roles, scopeText };
  });
  const areas = backofficeAreas(p.permissions, p.global), work = areas.filter((a) => a.section === "work"), reference = areas.filter((a) => a.section === "reference");
  return <>
    <header className="backoffice-head">
      <h1>งานหลังบ้านของคุณ</h1>
      <p className="muted">บทบาท <strong>{roles.join(", ") || "-"}</strong> · ขอบเขต <strong>{[...new Set(scopeText)].join(", ") || "-"}</strong> · แสดงเฉพาะส่วนที่บัญชีนี้รับผิดชอบ</p>
    </header>
    {work.length > 0 && <section aria-labelledby="work-heading" className="backoffice-section">
      <h2 id="work-heading" className="section-title">งานของคุณ</h2>
      <div className="admin-grid">{work.map((a) => <WorkCard key={a.id} area={a} />)}</div>
    </section>}
    {reference.length > 0 && <section aria-labelledby="reference-heading" className="backoffice-section reference-section">
      <h2 id="reference-heading" className="section-title">ข้อมูลอ้างอิง <span className="readonly-badge"><Eye size={14} aria-hidden="true" />ดูและส่งออกได้ แก้ไขไม่ได้</span></h2>
      <ul className="reference-list">{reference.map((a) => { const Icon = icons[a.id] ?? Package; return <li key={a.id}><Link href={a.href}><Icon size={18} aria-hidden="true" />{a.title}<ChevronRight size={16} aria-hidden="true" className="tile-chevron" /></Link></li>; })}</ul>
    </section>}
    {!areas.length && <div className="admin-card empty-backoffice"><h2>บัญชีนี้ไม่มีงานหลังบ้าน</h2><p className="muted">งานของคุณอยู่ที่เมนูด้านบน หากต้องดูแลข้อมูลหลักหรือแผนเดินรถ กรุณาติดต่อผู้ดูแลระบบ</p><Link className="secondary-button" href="/">กลับหน้าหลัก</Link></div>}
  </>;
}
