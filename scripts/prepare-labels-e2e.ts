import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createDatabase } from "../src/server/persistence/database";
import { testDatabaseConfiguration } from "../src/server/config/environment";
import { synthetic } from "../tests/fixtures/synthetic";
import { seedSearchFixture } from "../tests/fixtures/search";
import { installRoles } from "../src/server/auth/permissions";
import { provisionAccount } from "../src/server/auth/provision";
import { saveConsignmentDraft, submitConsignment, assignConsignment } from "../src/server/services/consignments";
import type { DraftInput } from "../src/server/domain/consignment";

// Disposable test database only. Every name, address, contact and trip here is synthetic.
const db = createDatabase(testDatabaseConfiguration(process.env));
const [A, B] = synthetic.branchIds, TRIP = "s5-2028-03-01-trip-1", TRIP_TWO = "s5-2028-03-01-trip-2";
try {
  await seedSearchFixture(db); await installRoles(db);
  const password = randomBytes(24).toString("base64url");
  const accounts = { requester: "requester@e2e.synthetic.test", branch: "branch@e2e.synthetic.test", dispatcher: "dispatcher@e2e.synthetic.test", warehouse: "warehouse@e2e.synthetic.test", admin: "admin@e2e.synthetic.test", otherBranch: "branch-b@e2e.synthetic.test" };
  const ids: Record<string, string> = {};
  for (const [name, role, scope, scopeId] of [["requester", "REQUESTER", "DEPARTMENT", "synthetic-department"], ["branch", "BRANCH_RECEIVER", "BRANCH", A], ["dispatcher", "DISPATCHER", "GLOBAL", undefined], ["warehouse", "WAREHOUSE", "WAREHOUSE", "synthetic-warehouse"], ["admin", "ADMINISTRATOR", "GLOBAL", undefined], ["otherBranch", "BRANCH_RECEIVER", "BRANCH", B]] as const) {
    ids[name] = (await provisionAccount(db, { email: accounts[name], name: `ผู้ทดสอบสังเคราะห์ ${name}`, password, role, scope, scopeId })).id;
  }
  // A deliberately long Thai address (just under the label limit) to prove it fits without shrinking.
  await db.branch.update({ where: { id: A }, data: { postalCode: "50000", contactName: "คุณผู้รับสังเคราะห์ ชื่อยาวสำหรับทดสอบการพิมพ์ฉลาก", contactPhone: "000-000-0001",
    addressLine: "เลขที่ ๙๙๙/๑๒๓ หมู่ที่ ๑๔ อาคารพาณิชย์ตัวอย่างสังเคราะห์ ชั้น ๒ ห้อง ๒๐๑-๒๐๕ ซอยทดสอบการตัดบรรทัดภาษาไทย ๒๗ แยก ๔ ถนนสายตัวอย่างสำหรับตรวจสอบฉลากขนาดจริง ใกล้ตลาดสดสังเคราะห์และสถานีขนส่งตัวอย่าง",
    subdistrict: "ตำบลสังเคราะห์ทดสอบฉลากยาว", district: "อำเภอเมืองสังเคราะห์ตัวอย่าง", province: "จังหวัดสังเคราะห์" } });
  const category = (await db.consignmentCategory.findUniqueOrThrow({ where: { code: "MARKETING" } })).id;
  const draft = (destinationBranchId: string, packageCount: number): DraftInput => ({ id: null, expectedVersion: 0, departmentId: "synthetic-department", sourceWarehouseId: "synthetic-warehouse", destinationBranchId, requestedServiceDate: "2028-03-01", requestedRoundNo: 1, requestedTripId: null,
    senderName: "ผู้ฝากสังเคราะห์", senderPhone: "000-000-1000", recipientName: null, recipientPhone: null, notes: null, receiptMode: "PACKAGES", packageCount, packageWeight: null, packageWeightUnit: null,
    items: [{ categoryId: category, name: "โปสเตอร์โปรโมชัน (ข้อมูลสังเคราะห์)", quantity: "30", unit: "SHEET" }] });
  const create = async (branchId: string, packages: number, key: string) => {
    const d = await saveConsignmentDraft(db, ids.requester, `${key}-draft`, draft(branchId, packages));
    const s = await submitConsignment(db, ids.requester, `${key}-submit`, { id: d.id, expectedVersion: d.version });
    await assignConsignment(db, ids.dispatcher, `${key}-assign`, { id: s.id, expectedVersion: s.version, tripId: TRIP });
    return d.id;
  };
  // Branch B keeps the placeholder postal code 00000, so only a sample label is possible there.
  const complete = await create(A, 3, "e2e-label-a"), incomplete = await create(B, 2, "e2e-label-b");
  mkdirSync(".local/auth", { recursive: true });
  writeFileSync(".local/auth/e2e-labels.json", JSON.stringify({ password, ...accounts, complete, incomplete, trip: TRIP, tripTwo: TRIP_TWO }));
  console.log("PASS: synthetic label fixture created; credentials retained only in ignored local file.");
} catch { console.error("LABEL_FIXTURE_FAILED"); process.exitCode = 1; } finally { await db.$disconnect(); }
