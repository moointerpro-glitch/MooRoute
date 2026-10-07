import assert from "node:assert/strict";
import { test } from "node:test";
import { rolePermissions } from "../../src/server/auth/permissions";
import { backofficeAreas, navigationAccess } from "../../src/lib/navigation";

// D218: the back office lists only what an account is responsible for. Table agreed with the owner.
const masters = ["vehicles", "vehicle-types", "drivers", "branches", "product-categories", "storage-conditions", "consignment-categories", "warehouses", "departments"];
const expected: Record<string, { global: boolean; work: string[]; reference: string[] }> = {
  ADMINISTRATOR: { global: true, work: ["planning", "imports", ...masters], reference: [] },
  DISPATCHER: { global: true, work: ["planning", "imports"], reference: masters },
  SUPERVISOR: { global: true, work: ["planning"], reference: masters },
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
  assert.deepEqual(verbs("SUPERVISOR", "planning"), ["ตรวจและเผยแพร่"], "the supervisor reviews and publishes; it does not prepare plans");
  assert.deepEqual(verbs("DISPATCHER", "planning"), ["จัดทำแผน", "เส้นทางและแม่แบบ"]);
  assert.deepEqual(verbs("ADMINISTRATOR", "vehicles"), ["เพิ่ม", "แก้ไข", "ลบ / เก็บเข้าคลัง"]);
  assert.deepEqual(verbs("DISPATCHER", "vehicles"), ["ดู", "ส่งออก"]);
  assert.equal(backofficeAreas(new Set(rolePermissions.DISPATCHER), false).some((a) => a.id === "planning" || a.id === "imports"), false, "planning and imports need the company-wide scope");
});
