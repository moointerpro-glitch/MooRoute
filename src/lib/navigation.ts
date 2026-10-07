import { masterDefinitions } from "./master-definitions";

/**
 * Back-office areas for one account. Single source for the header menu, the back-office page and tests.
 * Only areas where the account has a job are listed (edit or delete master data, prepare or publish plans, manage
 * users, import). Read-only reference lists are no longer shown (D226); a master list the server allows reading
 * still opens by its address. Navigation mirrors server capabilities; it never grants access.
 */
export type BackofficeArea = { id: string; title: string; href: string; does: string[] };

export function backofficeAreas(permissions: ReadonlySet<string>, global: boolean): BackofficeArea[] {
  const has = (code: string) => permissions.has(code), areas: BackofficeArea[] = [];
  if (global && has("plan.read")) {
    const does = [has("plan.write") && "จัดทำแผน", has("plan.publish") && "ตรวจและเผยแพร่", (has("route.write") || has("template.write")) && "เส้นทางและแม่แบบ"].filter((v): v is string => !!v);
    areas.push({ id: "planning", title: "แผนเดินรถรายวัน", href: "/admin/planning", does: does.length ? does : ["ดูแผน"] });
  }
  // D223: accounts, account types and scopes; identity changes need the company-wide scope.
  if (global && has("identity.manage")) areas.push({ id: "users", title: "ผู้ใช้งาน", href: "/admin/users", does: ["เพิ่มบัญชี", "กำหนดประเภทและขอบเขต", "ปิดใช้งาน", "ออกรหัสผ่านชั่วคราว"] });
  if (canImport(permissions, global)) areas.push({ id: "imports", title: "นำเข้าข้อมูล", href: "/admin/imports", does: ["พักไฟล์", "ตรวจรายแถว", "นำเข้าทั้งชุด"] });
  for (const [kind, d] of Object.entries(masterDefinitions)) {
    const write = has(`master.${kind}.write`), remove = has(`master.${kind}.delete`);
    if (write || remove) areas.push({ id: kind, title: d.title, href: `/admin/${kind}`, does: [write && "เพิ่ม", write && "แก้ไข", remove && "ลบ / เก็บเข้าคลัง"].filter((v): v is string => !!v) });
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
