import assert from "node:assert/strict";
import { test } from "node:test";
import { rolePermissions } from "../../src/server/auth/permissions";
import { backofficeAreas, navigationAccess } from "../../src/lib/navigation";

// D218: the back office lists only what an account is responsible for. D221: retired codes match the type that absorbed them.
const masters = ["vehicles", "vehicle-types", "drivers", "branches", "product-categories", "storage-conditions", "consignment-categories", "warehouses", "departments"];
// D226: read-only reference lists are no longer shown; only areas where the account has a job.
const expected: Record<string, { global: boolean; work: string[] }> = {
  ADMINISTRATOR: { global: true, work: ["planning", "users", "imports", ...masters] },
  DISPATCHER: { global: true, work: ["planning", "imports"] },
  SUPERVISOR: { global: true, work: ["planning", "imports"] },
  WAREHOUSE: { global: false, work: [] },
  DRIVER: { global: false, work: [] },
  BRANCH_RECEIVER: { global: false, work: [] },
  REQUESTER: { global: false, work: [] },
};

test("D218/D226: each account type sees exactly the back-office areas where it has a job; the menu appears only when there is something to show", () => {
  assert.deepEqual(Object.keys(expected).sort(), Object.keys(rolePermissions).sort(), "every role is covered");
  for (const [role, want] of Object.entries(expected)) {
    const permissions = new Set(rolePermissions[role]), areas = backofficeAreas(permissions, want.global);
    assert.deepEqual(areas.map((a) => a.id), want.work, `${role} areas`);
    assert.equal(navigationAccess(permissions, want.global).canOpenBackend, want.work.length > 0, `${role} menu`);
  }
  const verbs = (role: string, id: string) => backofficeAreas(new Set(rolePermissions[role]), true).find((a) => a.id === id)!.does;
  assert.deepEqual(verbs("DISPATCHER", "planning"), ["จัดทำแผน", "ตรวจและเผยแพร่", "เส้นทางและแม่แบบ"], "D221: the planner prepares and publishes");
  assert.deepEqual(verbs("ADMINISTRATOR", "vehicles"), ["เพิ่ม", "แก้ไข", "ลบ / เก็บเข้าคลัง"]);
  assert.equal(backofficeAreas(new Set(rolePermissions.DISPATCHER), true).some((a) => masters.includes(a.id)), false, "D226: master data the planner can only read is not listed");
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
