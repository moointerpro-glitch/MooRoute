import "dotenv/config";
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { createDatabase } from "../../src/server/persistence/database";
import { testDatabaseConfiguration } from "../../src/server/config/environment";
import { installRoles, principal } from "../../src/server/auth/permissions";
import { provisionAccount, assignAccountDepartment } from "../../src/server/auth/provision";
import { DomainError } from "../../src/server/domain/errors";
import type { DraftInput } from "../../src/server/domain/consignment";
import { saveConsignmentDraft, submitConsignment, consignmentDetail, listConsignments, consignmentFormOptions,
  assignConsignment, rejectConsignment, reassignConsignment, cancelConsignment, addAttachment, attachmentForDownload } from "../../src/server/services/consignments";
import { saveDraft, publishPlan } from "../../src/server/services/plans";
import { planningData } from "../../src/server/services/planning-read";
import { navigationAccess } from "../../src/lib/navigation";
import { seedMasters, synthetic, completeDraft } from "../fixtures/synthetic";

const db = createDatabase(testDatabaseConfiguration(process.env)), accounts: Record<string, string> = {};
const date = "2034-06-01", departmentId = "access-department", [A, B] = synthetic.branchIds;
let seq = 0;
const key = () => `access-${++seq}`;
const denied = (code: string) => (e: unknown) => e instanceof DomainError && e.code === code;
const history = { query: "", status: [], branchId: null, categoryId: null, date: null, tripCode: null, mine: false, page: 1 };
const draft = (): DraftInput => ({ expectedVersion: 0, departmentId, sourceWarehouseId: "synthetic-warehouse", destinationBranchId: A,
  requestedServiceDate: date, requestedRoundNo: 1, requestedTripId: null, senderName: "ผู้ฝากทดสอบสิทธิ์", senderPhone: "000-000-1000",
  recipientName: "ผู้รับทดสอบ", recipientPhone: "000-000-2000", notes: null, receiptMode: "PACKAGES", packageCount: 1,
  packageWeight: null, packageWeightUnit: null, items: [{ categoryId: "synthetic-item-category", name: "เอกสารทดสอบ", quantity: "1", unit: "SHEET" }] });

before(async () => {
  await seedMasters(db); await installRoles(db);
  await db.department.create({ data: { id: departmentId, code: "ACCESS-TEST", name: "แผนกทดสอบสิทธิ์ (สังเคราะห์)" } });
  await db.driver.create({ data: { id: "access-driver", code: "ACCESS-DRIVER", name: "คนขับทดสอบสิทธิ์" } });
  const password = randomBytes(24).toString("base64url");
  for (const [role, scope, scopeId] of [
    ["REQUESTER", "DEPARTMENT", departmentId], ["DISPATCHER", "GLOBAL", undefined], ["SUPERVISOR", "GLOBAL", undefined],
    ["WAREHOUSE", "WAREHOUSE", "synthetic-warehouse"], ["DRIVER", "DRIVER", "access-driver"],
    ["BRANCH_RECEIVER", "BRANCH", B], ["ADMINISTRATOR", "GLOBAL", undefined],
  ] as const) accounts[role] = (await provisionAccount(db, { email: `access-${role}@synthetic.test`, name: `ทดสอบ ${role}`, password, role, scope, scopeId, departmentId })).id;
  accounts.UNCONFIGURED = (await provisionAccount(db, { email: "access-unconfigured@synthetic.test", name: "ยังไม่กำหนดแผนก", password, role: "DISPATCHER", scope: "GLOBAL" })).id;
  const plan = completeDraft(date, "access");
  const d = await saveDraft(db, accounts.DISPATCHER, key(), plan);
  await publishPlan(db, accounts.SUPERVISOR, key(), { revisionId: d.revisionId, expectedVersion: d.version });
});
after(async () => { await db.$disconnect(); });

test("D216: every role creates/submits/cancels its own request without expanding other people's access", async () => {
  for (const role of ["REQUESTER", "DISPATCHER", "SUPERVISOR", "WAREHOUSE", "DRIVER", "BRANCH_RECEIVER", "ADMINISTRATOR"]) {
    const actor = accounts[role], d = await saveConsignmentDraft(db, actor, key(), draft());
    assert.equal((await consignmentDetail(db, actor, d.id)).mine, true);
    await assert.rejects(consignmentDetail(db, accounts.UNCONFIGURED, d.id), denied("NOT_FOUND"));
    assert.equal((await consignmentDetail(db, accounts.ADMINISTRATOR, d.id)).status, "DRAFT", "D215 retained");
    const file = await addAttachment(db, actor, key(), { consignmentId: d.id, displayName: "ทดสอบ.pdf", contentType: "application/pdf", sizeBytes: 10, sha256: "a".repeat(64), storageKey: `access-file-${seq}` });
    assert.equal((await attachmentForDownload(db, actor, file.id)).contentType, "application/pdf");
    const submitted = await submitConsignment(db, actor, key(), { id: d.id, expectedVersion: d.version });
    assert.ok((await listConsignments(db, actor, { ...history, query: d.code })).rows.some((r) => r.id === d.id));
    if (role !== "BRANCH_RECEIVER") {
      await assert.rejects(consignmentDetail(db, accounts.BRANCH_RECEIVER, d.id), denied("FORBIDDEN"), "sender department is not department-history access");
      await assert.rejects(attachmentForDownload(db, accounts.BRANCH_RECEIVER, file.id), denied("FORBIDDEN"));
    }
    assert.equal((await cancelConsignment(db, actor, key(), { id: d.id, expectedVersion: submitted.version, reason: "ยกเลิกคำขอทดสอบ" })).status, "CANCELLED");
  }
});

test("D216: a sender needs an assigned active department; contact-safe form and role-filtered navigation", async () => {
  assert.equal((await consignmentFormOptions(db, accounts.UNCONFIGURED)).departments.length, 0);
  await assert.rejects(saveConsignmentDraft(db, accounts.UNCONFIGURED, key(), draft()), denied("FORBIDDEN"));
  await assert.rejects(saveConsignmentDraft(db, accounts.DRIVER, key(), { ...draft(), departmentId: "synthetic-department" }), denied("FORBIDDEN"));
  for (const role of ["DRIVER", "WAREHOUSE", "BRANCH_RECEIVER", "REQUESTER"]) {
    const options = await consignmentFormOptions(db, accounts[role]);
    assert.deepEqual(options.departments.map((d) => d.id), [departmentId]);
    assert.equal(options.branches.find((b) => b.id === A)!.contactPhone, null);
    const p = await db.$transaction((tx) => principal(tx, accounts[role]));
    const menu = navigationAccess(p.permissions, p.global);
    assert.ok(menu.canSearch && menu.canConsign && menu.canHistory);
    assert.equal(menu.canOpenBackend, false);
    await assert.rejects(planningData(db, accounts[role], date), denied("FORBIDDEN"));
  }
  const email = "access-unconfigured@synthetic.test";
  await assignAccountDepartment(db, email, departmentId, "กำหนดแผนกทดสอบ");
  await assignAccountDepartment(db, email, departmentId, "กำหนดแผนกทดสอบซ้ำ");
  assert.equal(await db.userScope.count({ where: { userId: accounts.UNCONFIGURED, kind: "DEPARTMENT", departmentId } }), 1);
  assert.equal(await db.auditLog.count({ where: { entityId: accounts.UNCONFIGURED, action: "LOCAL_OPERATOR_DEPARTMENT_ASSIGNED" } }), 1);
  const actor = accounts.UNCONFIGURED, input = draft(), draftKey = key();
  const saved = await saveConsignmentDraft(db, actor, draftKey, input);
  const submitKey = key(), submitInput = { id: saved.id, expectedVersion: saved.version };
  await submitConsignment(db, actor, submitKey, submitInput);
  await db.userScope.deleteMany({ where: { userId: actor, kind: "DEPARTMENT" } });
  await assert.rejects(saveConsignmentDraft(db, actor, draftKey, input), denied("FORBIDDEN"), "revoked department blocks draft replay");
  await assert.rejects(submitConsignment(db, actor, submitKey, submitInput), denied("FORBIDDEN"), "revoked department blocks submit replay");
});

test("D216: self-review and plan-based self-reassignment are blocked, including administrator and replays", async () => {
  for (const role of ["DISPATCHER", "ADMINISTRATOR"]) {
    const actor = accounts[role], d = await saveConsignmentDraft(db, actor, key(), draft());
    const s = await submitConsignment(db, actor, key(), { id: d.id, expectedVersion: d.version });
    const assign = { id: d.id, expectedVersion: s.version, tripId: "access-trip-1" };
    const idem = key();
    await assert.rejects(assignConsignment(db, actor, idem, assign), denied("SELF_REVIEW"));
    await assert.rejects(assignConsignment(db, actor, idem, assign), denied("SELF_REVIEW"));
    await assert.rejects(rejectConsignment(db, actor, key(), { id: d.id, expectedVersion: s.version, reason: "ตรวจคำขอตนเอง" }), denied("SELF_REVIEW"));
    const detail = await consignmentDetail(db, actor, d.id);
    assert.ok(!detail.actions.includes("assign"));
    assert.ok(detail.blockedActions.some((a) => a.action === "assign" && a.reason.includes("อีกคน")));
    const reviewer = role === "DISPATCHER" ? accounts.ADMINISTRATOR : accounts.DISPATCHER;
    const a = await assignConsignment(db, reviewer, key(), assign);
    await assert.rejects(reassignConsignment(db, actor, key(), { id: d.id, expectedVersion: a.version, tripId: "access-trip-2", reason: "ย้ายคำขอตนเอง" }), denied("SELF_REVIEW"));
  }
  const actor = accounts.ADMINISTRATOR;
  const plan = await db.dailyPlan.findUniqueOrThrow({ where: { serviceDate: new Date(date) } });
  const d = await saveDraft(db, accounts.DISPATCHER, key(), completeDraft(date, "access", plan.version));
  const rows = await db.consignment.findMany({ where: { status: "ASSIGNED", code: { startsWith: "FS-" }, requestedServiceDate: new Date(date) } });
  await assert.rejects(publishPlan(db, actor, key(), { revisionId: d.revisionId, expectedVersion: d.version, reason: "ย้ายผ่านแผนทดสอบ", reassignments: rows.map((c) => ({ consignmentId: c.id, expectedVersion: c.version, tripId: "access-trip-1", stopSequence: 1 })) }), denied("SELF_REVIEW"));
  assert.equal((await db.dailyPlan.findUniqueOrThrow({ where: { id: plan.id } })).publishedRevisionId, plan.publishedRevisionId);
});
