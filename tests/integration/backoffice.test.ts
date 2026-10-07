import assert from "node:assert/strict";
import { test } from "node:test";
import { rolePermissions } from "../../src/server/auth/permissions";
import { backofficeAreas, navigationAccess } from "../../src/lib/navigation";

// D218: the back office lists only what an account is responsible for. D221: retired codes match the type that absorbed them.
const masters = ["vehicles", "vehicle-types", "drivers", "branches", "product-categories", "storage-conditions", "consignment-categories", "warehouses", "departments"];
const expected: Record<string, { global: boolean; work: string[]; reference: string[] }> = {
  ADMINISTRATOR: { global: true, work: ["planning", "users", "imports", ...masters], reference: [] },
  DISPATCHER: { global: true, work: ["planning", "imports"], reference: masters },
  SUPERVISOR: { global: true, work: ["planning", "imports"], reference: masters },
  WAREHOUSE: { global: false, work: [], reference: [] },
  DRIVER: { global: false, work: [], reference: [] },
  BRANCH_RECEIVER: { global: false, work: [], reference: [] },
  REQUESTER: { global: false, work: [], reference: [] },
};

test("D218: each role sees exactly its back-office work and reference areas; the menu appears only when there is something to show", () => {
  assert.deepEqual(Object.keys(expected).sort(), Object.keys(rolePermissions).sort(), "every role is covered");
  for (const [role, want] of Object.entries(expected)) {
    const permissions = new Set(rolePermissions[role]), areas = backofficeAreas(permissions, want.global);
    assert.deepEqual(areas.filter((a) => a.section === "work").map((a) => a.id), want.work, `${role} work`);
    assert.deepEqual(areas.filter((a) => a.section === "reference").map((a) => a.id), want.reference, `${role} reference`);
    assert.equal(navigationAccess(permissions, want.global).canOpenBackend, want.work.length + want.reference.length > 0, `${role} menu`);
  }
  const verbs = (role: string, id: string) => backofficeAreas(new Set(rolePermissions[role]), true).find((a) => a.id === id)!.does;
  assert.deepEqual(verbs("DISPATCHER", "planning"), ["จัดทำแผน", "ตรวจและเผยแพร่", "เส้นทางและแม่แบบ"], "D221: the planner prepares and publishes");
  assert.deepEqual(verbs("ADMINISTRATOR", "vehicles"), ["เพิ่ม", "แก้ไข", "ลบ / เก็บเข้าคลัง"]);
  assert.deepEqual(verbs("DISPATCHER", "vehicles"), ["ดู", "ส่งออก"]);
  assert.equal(backofficeAreas(new Set(rolePermissions.DISPATCHER), false).some((a) => a.id === "planning" || a.id === "imports"), false, "planning and imports need the company-wide scope");
});

test("D221: five account types; retired codes carry exactly the capabilities of the type that absorbed them", () => {
  const sorted = (role: string) => [...rolePermissions[role]].sort();
  assert.deepEqual(sorted("SUPERVISOR"), sorted("DISPATCHER"));
  assert.deepEqual(sorted("DRIVER"), sorted("WAREHOUSE"));
  for (const code of ["plan.write", "plan.publish", "consignment.assign", "consignment.correct", "import.manage"]) assert.ok(rolePermissions.DISPATCHER.includes(code), `planner ${code}`);
  for (const code of ["consignment.warehouse", "consignment.load", "trip.move", "label.issue", "manifest.read"]) assert.ok(rolePermissions.WAREHOUSE.includes(code), `warehouse and vehicle ${code}`);
  // Merging never reaches into other types' work: no operational type gains planning, receipt or master writes.
  for (const role of ["REQUESTER", "BRANCH_RECEIVER", "WAREHOUSE"]) assert.ok(!rolePermissions[role].some((c) => c.startsWith("plan.") || c.endsWith(".write") || c === "consignment.assign"), role);
  assert.ok(!rolePermissions.WAREHOUSE.includes("consignment.receive") && !rolePermissions.DISPATCHER.includes("consignment.receive"), "branch receipt stays with branch staff");
  for (const role of Object.keys(rolePermissions)) if (role !== "ADMINISTRATOR") assert.ok(!rolePermissions[role].includes("identity.manage") && !rolePermissions[role].includes("consignment.read.drafts"), role);
});
