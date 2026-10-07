import { requireCondition } from "./errors";
import { serviceDate } from "./planning";

export type ConsignmentState = "DRAFT" | "PENDING_REVIEW" | "REJECTED" | "ASSIGNED" | "WAREHOUSE_RECEIVED" | "LOADED" | "IN_TRANSIT" | "PARTIALLY_RECEIVED" | "ISSUE" | "RECEIVED" | "CLOSED" | "CANCELLED" | "RETURNED";

/** Actor rules are evaluated on the server against persisted capabilities and row scope. */
export type ActorRule = "OWN_REQUESTER" | "GLOBAL" | "SOURCE_WAREHOUSE" | "DESTINATION_BRANCH" | "TRIP_DRIVER";
export interface Transition { from: ConsignmentState[]; to: string; actors: Array<{ capability: string; scope: ActorRule }>; prerequisites: string }

/**
 * Complete transition matrix. No other status change is reachable through the application;
 * there is no arbitrary status edit. Phase 4 plan publication may additionally move
 * ASSIGNED/WAREHOUSE_RECEIVED records between trips (status unchanged) under plan.publish.
 */
export const transitionMatrix: Record<string, Transition> = {
  saveDraft: { from: ["DRAFT"], to: "DRAFT", actors: [{ capability: "consignment.create", scope: "OWN_REQUESTER" }], prerequisites: "Department in the requester's scope; active source warehouse and destination branch" },
  submit: { from: ["DRAFT"], to: "PENDING_REVIEW", actors: [{ capability: "consignment.create", scope: "OWN_REQUESTER" }], prerequisites: "Items, package count, contacts and a future service date; receipt mode frozen; items and packages materialized; preferred trip (if any) must be eligible" },
  cancelRequest: { from: ["DRAFT", "PENDING_REVIEW"], to: "CANCELLED", actors: [{ capability: "consignment.create", scope: "OWN_REQUESTER" }], prerequisites: "Reason" },
  reject: { from: ["PENDING_REVIEW"], to: "REJECTED", actors: [{ capability: "consignment.assign", scope: "GLOBAL" }], prerequisites: "Reason" },
  assign: { from: ["PENDING_REVIEW"], to: "ASSIGNED", actors: [{ capability: "consignment.assign", scope: "GLOBAL" }], prerequisites: "Current published outbound trip visiting the destination, before cutoff, compatible known capacity; sender/recipient/transport snapshots frozen" },
  reassign: { from: ["ASSIGNED", "WAREHOUSE_RECEIVED"], to: "(unchanged)", actors: [{ capability: "consignment.assign", scope: "GLOBAL" }], prerequisites: "No loading, departure or receipt evidence; packages with sender or warehouse; eligible target; labels revoked; reason" },
  correctAddress: { from: ["ASSIGNED", "WAREHOUSE_RECEIVED", "LOADED"], to: "(unchanged)", actors: [{ capability: "consignment.assign", scope: "GLOBAL" }], prerequisites: "No departure recorded; same trip and stop; sender/recipient snapshots re-frozen from current master data; previous labels revoked; reason" },
  cancelAssigned: { from: ["ASSIGNED", "WAREHOUSE_RECEIVED"], to: "CANCELLED", actors: [{ capability: "consignment.assign", scope: "GLOBAL" }], prerequisites: "Not loaded; labels revoked; package custody retained; reason" },
  warehouseReceive: { from: ["ASSIGNED"], to: "WAREHOUSE_RECEIVED", actors: [{ capability: "consignment.warehouse", scope: "SOURCE_WAREHOUSE" }], prerequisites: "Every package handed over by the sender" },
  load: { from: ["WAREHOUSE_RECEIVED"], to: "LOADED", actors: [{ capability: "consignment.load", scope: "SOURCE_WAREHOUSE" }], prerequisites: "Assignment on the current published, non-cancelled trip revision; every package in warehouse custody" },
  depart: { from: ["LOADED"], to: "IN_TRANSIT", actors: [{ capability: "trip.move", scope: "TRIP_DRIVER" }, { capability: "consignment.load", scope: "SOURCE_WAREHOUSE" }], prerequisites: "Recorded per trip for every loaded consignment the actor may move" },
  receive: { from: ["IN_TRANSIT", "PARTIALLY_RECEIVED", "ISSUE"], to: "PARTIALLY_RECEIVED | RECEIVED", actors: [{ capability: "consignment.receive", scope: "DESTINATION_BRANCH" }], prerequisites: "Departure recorded; stable package IDs in vehicle custody; cumulative item quantity <= sent in the same unit; from ISSUE only when movement had departed" },
  correctiveReceive: { from: ["LOADED"], to: "PARTIALLY_RECEIVED | RECEIVED", actors: [{ capability: "consignment.correct", scope: "GLOBAL" }], prerequisites: "Supervisor correction of a receipt before recorded departure; reason; CORRECTION event" },
  reportIssue: { from: ["WAREHOUSE_RECEIVED", "LOADED", "IN_TRANSIT", "PARTIALLY_RECEIVED", "RECEIVED"], to: "ISSUE", actors: [{ capability: "consignment.receive", scope: "DESTINATION_BRANCH" }, { capability: "consignment.warehouse", scope: "SOURCE_WAREHOUSE" }, { capability: "trip.move", scope: "TRIP_DRIVER" }, { capability: "consignment.correct", scope: "GLOBAL" }], prerequisites: "Issue type and description; previous movement state kept in resumeStatus" },
  recordReturn: { from: ["ISSUE"], to: "(unchanged) | RETURNED", actors: [{ capability: "consignment.correct", scope: "GLOBAL" }], prerequisites: "Only undelivered packages/quantities; reason; RETURNED when every package is returned" },
  resolveIssue: { from: ["ISSUE"], to: "resumeStatus recomputed from receipts", actors: [{ capability: "consignment.correct", scope: "GLOBAL" }], prerequisites: "Reason; ISSUE_RESOLVED event compensates the issue event" },
  close: { from: ["RECEIVED", "PARTIALLY_RECEIVED"], to: "CLOSED", actors: [{ capability: "consignment.receive", scope: "DESTINATION_BRANCH" }, { capability: "consignment.correct", scope: "GLOBAL" }], prerequisites: "No open issue; every package received or returned; detailed items received + returned = sent" },
};

export const statusLabels: Record<ConsignmentState, string> = {
  DRAFT: "ฉบับร่าง", PENDING_REVIEW: "รอตรวจสอบ", REJECTED: "ไม่อนุมัติ", ASSIGNED: "จัดรถแล้ว", WAREHOUSE_RECEIVED: "คลังรับของแล้ว",
  LOADED: "ขึ้นรถแล้ว", IN_TRANSIT: "อยู่ระหว่างขนส่ง", PARTIALLY_RECEIVED: "รับบางส่วน", ISSUE: "พบปัญหา", RECEIVED: "รับครบแล้ว",
  CLOSED: "ปิดงาน", CANCELLED: "ยกเลิก", RETURNED: "ส่งคืน",
};
export const eventLabels: Record<string, string> = {
  SUBMITTED: "ส่งคำขอ", ASSIGNED: "จัดรถ", WAREHOUSE_RECEIVED: "คลังรับของ", LOADED: "ขึ้นรถ", DEPARTED: "รถออก", RECEIPT: "สาขารับของ",
  ISSUE: "แจ้งปัญหา", CORRECTION: "แก้ไขโดยผู้วางแผนขนส่ง", RETURNED: "ส่งคืน", CLOSED: "ปิดงาน", CANCELLED: "ยกเลิก", REJECTED: "ไม่อนุมัติ", ISSUE_RESOLVED: "แก้ไขปัญหาแล้ว",
};
export const custodyLabels: Record<string, string> = { SENDER: "ผู้ฝาก", WAREHOUSE: "คลัง", VEHICLE: "บนรถ", BRANCH: "สาขารับแล้ว", RETURNED: "ส่งคืนแล้ว" };
/** Explicit item units; quantities of different units are never summed. */
export const itemUnits: Record<string, string> = { PIECE: "ชิ้น", SHEET: "แผ่น", BOX: "กล่อง", PACK: "แพ็ก", SET: "ชุด", ROLL: "ม้วน", BOTTLE: "ขวด", BAG: "ถุง", UNIT: "เครื่อง", KG: "กิโลกรัม" };
export const weightUnits: Record<string, string> = { KG: "กิโลกรัม" };
export const issueTypes: Record<string, string> = { SHORTAGE: "ของขาด", DAMAGE: "ของเสียหาย", WRONG_ITEM: "ของไม่ตรงรายการ", DELAY: "ล่าช้า", OTHER: "อื่น ๆ" };
export const receiptModeLabels: Record<string, string> = { PACKAGES: "ตรวจรับตามจำนวนหีบห่อ", DETAILED: "ตรวจรับทั้งหีบห่อและจำนวนสิ่งของ" };

export const idPattern = /^[A-Za-z0-9_-]{1,36}$/;
export const quantityPattern = /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/;
export const phonePattern = /^[+\d ()-]{7,32}$/;

export function requireTransition(action: string, status: string) {
  const rule = transitionMatrix[action];
  requireCondition(rule && (rule.from as string[]).includes(status), "INVALID_TRANSITION", `ไม่สามารถ${actionLabels[action] ?? "ดำเนินการ"}ได้ในสถานะ “${statusLabels[status as ConsignmentState] ?? status}”`);
}
export const actionLabels: Record<string, string> = {
  saveDraft: "บันทึกฉบับร่าง", submit: "ส่งคำขอ", cancelRequest: "ยกเลิกคำขอ", reject: "ไม่อนุมัติ", assign: "จัดรถ", reassign: "ย้ายรอบรถ",
  correctAddress: "แก้ไขที่อยู่บนฉลาก", cancelAssigned: "ยกเลิกรายการที่จัดรถแล้ว", warehouseReceive: "บันทึกคลังรับของ", load: "บันทึกขึ้นรถ", depart: "บันทึกรถออก", receive: "บันทึกรับของ",
  correctiveReceive: "บันทึกรับของก่อนรถออก", reportIssue: "แจ้งปัญหา", recordReturn: "บันทึกส่งคืน", resolveIssue: "ปิดปัญหา", close: "ปิดงาน",
};

export interface DraftItemInput { categoryId: string; name: string; quantity: string; unit: string }
export interface DraftInput {
  id?: string | null; expectedVersion: number; departmentId: string; sourceWarehouseId: string; destinationBranchId: string;
  requestedServiceDate: string | null; requestedRoundNo: number | null; requestedTripId: string | null;
  senderName: string | null; senderPhone: string | null; recipientName: string | null; recipientPhone: string | null; notes: string | null;
  receiptMode: "PACKAGES" | "DETAILED"; packageCount: number; packageWeight: string | null; packageWeightUnit: string | null; items: DraftItemInput[];
}
const text = (value: unknown, max: number, label: string) => {
  if (value === null || value === undefined || value === "") return null;
  requireCondition(typeof value === "string", "INVALID_INPUT", `${label}ไม่ถูกต้อง`);
  const v = value.normalize("NFC").trim();
  requireCondition(v.length <= max, "INVALID_INPUT", `${label}ยาวเกิน ${max} ตัวอักษร`);
  return v || null;
};

/** Drafts may be incomplete; shape, lengths and units are always validated. */
export function normalizeDraft(raw: DraftInput): DraftInput {
  requireCondition(raw && typeof raw === "object", "INVALID_INPUT", "ข้อมูลคำขอไม่ถูกต้อง");
  requireCondition(raw.id == null || (typeof raw.id === "string" && idPattern.test(raw.id)), "INVALID_INPUT", "รหัสคำขอไม่ถูกต้อง");
  requireCondition(Number.isInteger(raw.expectedVersion) && raw.expectedVersion >= 0, "INVALID_INPUT", "ข้อมูลรุ่นไม่ถูกต้อง");
  for (const [field, label] of [["departmentId", "แผนก"], ["sourceWarehouseId", "คลังต้นทาง"], ["destinationBranchId", "สาขาปลายทาง"]] as const) {
    requireCondition(typeof raw[field] === "string" && idPattern.test(raw[field]), "REQUIRED", `กรุณาเลือก${label}`);
  }
  if (raw.requestedServiceDate !== null && raw.requestedServiceDate !== undefined && raw.requestedServiceDate !== "") serviceDate(raw.requestedServiceDate);
  requireCondition(raw.requestedRoundNo == null || [1, 2, 3].includes(raw.requestedRoundNo), "INVALID_ROUND", "รอบต้องเป็นรอบที่ ๑ ถึง ๓");
  requireCondition(raw.requestedTripId == null || raw.requestedTripId === "" || (typeof raw.requestedTripId === "string" && idPattern.test(raw.requestedTripId)), "INVALID_INPUT", "รอบรถที่เลือกไม่ถูกต้อง");
  requireCondition(raw.receiptMode === "PACKAGES" || raw.receiptMode === "DETAILED", "INVALID_INPUT", "วิธีตรวจรับไม่ถูกต้อง");
  requireCondition(Number.isInteger(raw.packageCount) && raw.packageCount >= 0 && raw.packageCount <= 500, "INVALID_PACKAGES", "จำนวนหีบห่อต้องเป็นจำนวนเต็ม ๐ ถึง ๕๐๐");
  const weight = text(raw.packageWeight, 20, "น้ำหนักต่อหีบห่อ"), weightUnit = text(raw.packageWeightUnit, 32, "หน่วยน้ำหนัก");
  requireCondition((weight === null && weightUnit === null) || (weight !== null && quantityPattern.test(weight) && Number(weight) > 0 && weightUnit !== null && weightUnit in weightUnits), "INVALID_WEIGHT", "กรุณาระบุน้ำหนักต่อหีบห่อและหน่วยให้ครบคู่ หรือเว้นว่างทั้งสองช่อง");
  requireCondition(Array.isArray(raw.items) && raw.items.length <= 50, "INVALID_ITEMS", "ระบุรายการสิ่งของได้ไม่เกิน ๕๐ รายการ");
  const items = raw.items.map((item, index) => {
    requireCondition(item && typeof item === "object" && typeof item.categoryId === "string" && idPattern.test(item.categoryId), "INVALID_ITEMS", `กรุณาเลือกหมวดของรายการที่ ${index + 1}`);
    const name = text(item.name, 191, `ชื่อรายการที่ ${index + 1}`);
    requireCondition(name, "INVALID_ITEMS", `กรุณาระบุชื่อรายการที่ ${index + 1}`);
    requireCondition(typeof item.quantity === "string" && quantityPattern.test(item.quantity) && Number(item.quantity) > 0, "INVALID_QUANTITY", `จำนวนของรายการที่ ${index + 1} ต้องมากกว่าศูนย์ (ทศนิยมไม่เกิน ๓ ตำแหน่ง)`);
    requireCondition(typeof item.unit === "string" && item.unit in itemUnits, "INVALID_UNIT", `กรุณาเลือกหน่วยของรายการที่ ${index + 1}`);
    return { categoryId: item.categoryId, name, quantity: item.quantity, unit: item.unit };
  });
  const senderPhone = text(raw.senderPhone, 32, "เบอร์ผู้ฝาก"), recipientPhone = text(raw.recipientPhone, 32, "เบอร์ผู้รับ");
  for (const phone of [senderPhone, recipientPhone]) requireCondition(phone === null || phonePattern.test(phone), "INVALID_PHONE", "เบอร์ติดต่อไม่ถูกต้อง");
  return {
    id: raw.id ?? null, expectedVersion: raw.expectedVersion, departmentId: raw.departmentId, sourceWarehouseId: raw.sourceWarehouseId, destinationBranchId: raw.destinationBranchId,
    requestedServiceDate: raw.requestedServiceDate || null, requestedRoundNo: raw.requestedRoundNo ?? null, requestedTripId: raw.requestedTripId || null,
    senderName: text(raw.senderName, 191, "ชื่อผู้ฝาก"), senderPhone, recipientName: text(raw.recipientName, 191, "ชื่อผู้รับ"), recipientPhone, notes: text(raw.notes, 1000, "หมายเหตุ"),
    receiptMode: raw.receiptMode, packageCount: raw.packageCount, packageWeight: weight, packageWeightUnit: weightUnit, items,
  };
}

/** Submission completeness. Item quantity and package count are independent: 30 posters may travel in 3 boxes. */
export function submissionProblems(d: { items: unknown[]; packageCount: number; senderName: string | null; senderPhone: string | null; requestedServiceDate: string | null }, today: string, recipientKnown: boolean) {
  const problems: string[] = [];
  if (!d.items.length) problems.push("กรุณาเพิ่มรายการสิ่งของอย่างน้อย ๑ รายการ");
  if (d.packageCount < 1) problems.push("กรุณาระบุจำนวนหีบห่ออย่างน้อย ๑ หีบห่อ");
  if (!d.senderName || !d.senderPhone) problems.push("กรุณาระบุชื่อและเบอร์ติดต่อผู้ฝาก");
  if (!recipientKnown) problems.push("กรุณาระบุชื่อและเบอร์ผู้รับ เพราะสาขานี้ยังไม่มีข้อมูลผู้ติดต่อ");
  if (!d.requestedServiceDate) problems.push("กรุณาระบุวันที่ต้องการส่ง");
  else if (d.requestedServiceDate < today) problems.push("วันที่ต้องการส่งต้องไม่ย้อนหลัง");
  return problems;
}

export function reasonText(value: unknown) {
  requireCondition(typeof value === "string" && value.trim().length >= 3 && value.length <= 500, "REASON_REQUIRED", "กรุณาระบุเหตุผลอย่างน้อย ๓ ตัวอักษร");
  return value.trim();
}
