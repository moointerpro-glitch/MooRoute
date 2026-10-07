import { masterDefinitions } from "./master-definitions";

/**
 * Back-office areas for one account. Single source for the header menu, the back-office page and tests.
 * - "work": the account has a job there (edit/delete master data, prepare or publish plans, import).
 * - "reference": read and export only, needed for the job (dispatcher and supervisor look up masters).
 * Anything else is not listed. Navigation mirrors server capabilities; it never grants access.
 */
export type BackofficeArea = { id: string; title: string; href: string; section: "work" | "reference"; does: string[] };

export function backofficeAreas(permissions: ReadonlySet<string>, global: boolean): BackofficeArea[] {
  const has = (code: string) => permissions.has(code), areas: BackofficeArea[] = [];
  if (global && has("plan.read")) {
    const does = [has("plan.write") && "จัดทำแผน", has("plan.publish") && "ตรวจและเผยแพร่", (has("route.write") || has("template.write")) && "เส้นทางและแม่แบบ"].filter((v): v is string => !!v);
    areas.push({ id: "planning", title: "แผนเดินรถรายวัน", href: "/admin/planning", section: does.length ? "work" : "reference", does: does.length ? does : ["ดูแผน"] });
  }
  // D223: accounts, account types and scopes; identity changes need the company-wide scope.
  if (global && has("identity.manage")) areas.push({ id: "users", title: "ผู้ใช้งาน", href: "/admin/users", section: "work", does: ["เพิ่มบัญชี", "กำหนดประเภทและขอบเขต", "ปิดใช้งาน", "ออกรหัสผ่านชั่วคราว"] });
  if (canImport(permissions, global)) areas.push({ id: "imports", title: "นำเข้าข้อมูล", href: "/admin/imports", section: "work", does: ["พักไฟล์", "ตรวจรายแถว", "นำเข้าทั้งชุด"] });
  for (const [kind, d] of Object.entries(masterDefinitions)) {
    const write = has(`master.${kind}.write`), remove = has(`master.${kind}.delete`), exportable = has(`master.${kind}.export`);
    if (write || remove) areas.push({ id: kind, title: d.title, href: `/admin/${kind}`, section: "work", does: [write && "เพิ่ม", write && "แก้ไข", remove && "ลบ / เก็บเข้าคลัง"].filter((v): v is string => !!v) });
    else if (exportable) areas.push({ id: kind, title: d.title, href: `/admin/${kind}`, section: "reference", does: ["ดู", "ส่งออก"] });
  }
  return areas;
}

function canImport(permissions: ReadonlySet<string>, global: boolean) {
  return global && permissions.has("import.manage") &&
    (permissions.has("master.branches.write") || permissions.has("master.vehicles.write") || (permissions.has("route.write") && permissions.has("template.write")));
}

export function navigationAccess(permissions: ReadonlySet<string>, global: boolean) {
  const canSearch = permissions.has("trip.read");
  const canConsign = permissions.has("consignment.create");
  const canHistory = permissions.has("consignment.read");
  const canPlan = global && permissions.has("plan.read");
  // The menu appears exactly when the back-office page has at least one area to show.
  return { canSearch, canConsign, canHistory, canPlan, canImport: canImport(permissions, global), canOpenBackend: backofficeAreas(permissions, global).length > 0 };
}
export type NavigationAccess = ReturnType<typeof navigationAccess>;
