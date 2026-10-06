import "server-only";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { requireCondition, versionMatches } from "../domain/errors";
import { audit, authorize, guardedWrite, replay } from "./transaction";

export interface ReceiptInput {
  consignmentId: string; expectedVersion: number;
  lines: { itemId?: string; packageId?: string; quantity: string; unit: string; note?: string }[];
}
type ReceiptResult = { eventId: string; status: string; version: number };
export async function receiveConsignment(db: PrismaClient, actorId: string, key: string, input: ReceiptInput): Promise<ReceiptResult> {
  requireCondition(input && typeof input.consignmentId === "string" && Number.isInteger(input.expectedVersion) && Array.isArray(input.lines) && input.lines.length > 0 && input.lines.length <= 500, "INVALID_RECEIPT", "ข้อมูลรับสินค้าไม่ถูกต้อง");
  const targets = new Set<string>();
  for (const line of input.lines) {
    requireCondition(line && !!line.itemId !== !!line.packageId && typeof line.quantity === "string" && /^\d{1,11}(\.\d{1,3})?$/.test(line.quantity) && new Prisma.Decimal(line.quantity).gt(0) && typeof line.unit === "string" && line.unit.length > 0 && line.unit.length <= 32 && (!line.note || (typeof line.note === "string" && line.note.length <= 500)), "INVALID_QUANTITY", "จำนวนหรือหน่วยรับสินค้าไม่ถูกต้อง");
    const target = line.itemId ? `item:${line.itemId}` : `package:${line.packageId}`;
    requireCondition(!targets.has(target), "DUPLICATE_RECEIPT_TARGET", "รายการรับสินค้าซ้ำกัน"); targets.add(target);
  }
  return guardedWrite(db, actorId, "consignment.receive", key, input, async (tx, idem) => {
    const initial = await tx.consignment.findUnique({ where: { id: input.consignmentId } });
    requireCondition(initial, "NOT_FOUND", "ไม่พบรายการพัสดุ");
    await authorize(tx, actorId, "consignment.receive", { branchId: initial.destinationBranchId });
    const prior = await replay<ReceiptResult>(tx, idem); if (prior) return prior;
    await tx.$queryRaw`SELECT id FROM Consignment WHERE id=${input.consignmentId} FOR UPDATE`;
    const consignment = await tx.consignment.findUniqueOrThrow({ where: { id: input.consignmentId } });
    versionMatches(consignment.version, input.expectedVersion);
    requireCondition(["IN_TRANSIT", "PARTIALLY_RECEIVED"].includes(consignment.status), "RECEIPT_STATE", "ยังรับสินค้าในสถานะนี้ไม่ได้");
    requireCondition(await tx.consignmentEvent.count({ where: { consignmentId: consignment.id, kind: "DEPARTED" } }), "DEPARTURE_REQUIRED", "ยังไม่มีบันทึกออกเดินทาง");
    const items = await tx.consignmentItem.findMany({ where: { consignmentId: consignment.id } });
    const packages = await tx.consignmentPackage.findMany({ where: { consignmentId: consignment.id } });
    const previous = await tx.receiptLine.findMany({ where: { consignmentId: consignment.id } });
    const totals = new Map<string, Prisma.Decimal>();
    for (const line of previous) if (line.itemId) totals.set(line.itemId, (totals.get(line.itemId) ?? new Prisma.Decimal(0)).plus(line.quantity));
    const receivedPackages = new Set(previous.flatMap((line) => line.packageId ? [line.packageId] : []));
    for (const line of input.lines) {
      if (line.itemId) {
        requireCondition(consignment.receiptMode === "DETAILED", "RECEIPT_MODE", "รายการนี้รับตามจำนวนหีบห่อเท่านั้น");
        const item = items.find((i) => i.id === line.itemId);
        requireCondition(item && item.unit === line.unit, "RECEIPT_UNIT", "รายการหรือหน่วยไม่ตรงกับสินค้าที่ส่ง");
        const total = (totals.get(item.id) ?? new Prisma.Decimal(0)).plus(line.quantity);
        requireCondition(total.lte(item.sentQuantity), "RECEIPT_EXCEEDS_SENT", "จำนวนรับเกินจำนวนที่ส่ง"); totals.set(item.id, total);
      } else {
        const parcel = packages.find((p) => p.id === line.packageId);
        requireCondition(parcel && parcel.custody === "VEHICLE" && line.unit === "PACKAGE" && new Prisma.Decimal(line.quantity).eq(1), "RECEIPT_PACKAGE", "ข้อมูลหีบห่อไม่ถูกต้อง");
        requireCondition(!receivedPackages.has(parcel.id), "PACKAGE_ALREADY_RECEIVED", "หีบห่อนี้รับแล้ว"); receivedPackages.add(parcel.id);
      }
    }
    const event = await tx.consignmentEvent.create({ data: { consignmentId: consignment.id, actorId, kind: "RECEIPT", occurredAt: new Date(), idempotencyId: idem, payload: { schemaVersion: 1, lines: input.lines } } });
    for (const line of input.lines) {
      await tx.receiptLine.create({ data: { eventId: event.id, consignmentId: consignment.id, itemId: line.itemId, packageId: line.packageId, quantity: line.quantity, unit: line.unit, note: line.note } });
      if (line.packageId) await tx.consignmentPackage.update({ where: { id: line.packageId }, data: { custody: "BRANCH" } });
    }
    const complete = packages.length > 0 && packages.every((p) => receivedPackages.has(p.id)) &&
      (consignment.receiptMode === "PACKAGES" || (items.length > 0 && items.every((i) => (totals.get(i.id) ?? new Prisma.Decimal(0)).eq(i.sentQuantity))));
    const status = complete && !consignment.hasOpenIssue ? "RECEIVED" : "PARTIALLY_RECEIVED";
    const updated = await tx.consignment.update({ where: { id: consignment.id }, data: { status, version: { increment: 1 } } });
    const result = { eventId: event.id, status, version: updated.version };
    await audit(tx, actorId, "CONSIGNMENT_RECEIVED", "Consignment", consignment.id, idem, result);
    return result;
  });
}
