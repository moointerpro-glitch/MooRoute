import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { tripDetail } from "@/server/services/trip-search";
import { consignmentDetail, consignmentFormOptions } from "@/server/services/consignments";
import { DomainError } from "@/server/domain/errors";
import { ConsignForm, type ConsignInitial } from "@/components/consign-form";
import { bangkokServiceDate } from "@/lib/bangkok-date";
import { roundLabel } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ฝากของส่งรถ" };

const denied = (title: string, text: string) => <div className="container message-page"><span className="eyebrow">ฝากของส่งรถ</span><h1>{title}</h1><p>{text}</p><Link className="secondary-button" href="/consignments">ไปที่ประวัติฝากส่ง</Link></div>;

export default async function ConsignPage({ searchParams }: { searchParams: Promise<{ id?: string; trip?: string; branch?: string }> }) {
  const actor = await requirePageActor(), { id, trip, branch } = await searchParams, db = getDatabase();
  let options;
  try { options = await consignmentFormOptions(db, actor.id); }
  catch (error) { if (error instanceof DomainError && error.code === "FORBIDDEN") return denied("บัญชีนี้ยังไม่มีสิทธิ์สร้างคำขอฝากส่ง", "กรุณาติดต่อผู้ดูแลเพื่อกำหนดบทบาทผู้ฝากส่งและแผนก"); throw error; }
  const today = bangkokServiceDate();
  let initial: ConsignInitial = {
    id: null, code: null, version: 0, departmentId: options.departments.length === 1 ? options.departments[0].id : "", sourceWarehouseId: options.warehouses.length === 1 ? options.warehouses[0].id : "",
    destinationBranchId: "", requestedServiceDate: "", requestedRoundNo: null, requestedTripId: null, tripLabel: null, tripProblems: [],
    senderName: options.senderName, senderPhone: "", recipientName: "", recipientPhone: "", notes: "", receiptMode: "PACKAGES", packageCount: "1", packageWeight: "", packageWeightUnit: "KG",
    items: [{ categoryId: "", name: "", quantity: "", unit: "" }], attachments: [],
  };
  if (id) {
    let d;
    try { d = await consignmentDetail(db, actor.id, id); }
    catch (error) { if (error instanceof DomainError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) return denied("ไม่พบฉบับร่างนี้", "ฉบับร่างเปิดได้เฉพาะผู้สร้าง"); throw error; }
    if (d.status !== "DRAFT" || !d.mine) redirect(`/consignments/${d.id}`);
    const raw = await db.consignment.findUniqueOrThrow({ where: { id: d.id }, select: { departmentId: true } });
    initial = { ...initial, id: d.id, code: d.code, version: d.version, departmentId: raw.departmentId, sourceWarehouseId: d.warehouse.id, destinationBranchId: d.branch.id,
      requestedServiceDate: d.requested.serviceDate ?? "", requestedRoundNo: d.requested.roundNo, requestedTripId: d.requested.tripId, tripLabel: d.requested.tripCode,
      senderName: d.contacts.senderName ?? "", senderPhone: d.contacts.senderPhone ?? "", recipientName: d.contacts.recipientName ?? "", recipientPhone: d.contacts.recipientPhone ?? "",
      notes: d.notes ?? "", receiptMode: d.receiptMode, packageCount: String(d.packageCount), packageWeight: d.packageWeight ?? "", packageWeightUnit: d.packageWeightUnit ?? "KG",
      items: d.draftItems.length ? d.draftItems : initial.items, attachments: d.attachments.map((a) => ({ id: a.id, name: a.name, size: a.size })) };
  } else if (trip) {
    // Pre-fill from the search page's eligible-trip action; the server re-checks eligibility on submission and assignment.
    try {
      const t = await tripDetail(db, actor.id, trip, { branchId: branch ?? null });
      const stop = t.stops.find((s) => s.matched);
      initial = { ...initial, destinationBranchId: stop?.branchId ?? "", requestedServiceDate: t.serviceDate, requestedRoundNo: t.roundNo,
        requestedTripId: t.eligibility.eligible ? t.tripId : null, tripLabel: `${t.routeName ?? t.code} · ${roundLabel(t.roundNo)}${t.departure ? ` · ออก ${t.departure.label} น.` : ""}`,
        tripProblems: t.eligibility.eligible ? [] : t.eligibility.reasons };
    } catch (error) { if (!(error instanceof DomainError)) throw error; initial = { ...initial, tripProblems: ["ไม่พบรอบรถที่เลือกหรือคุณไม่มีสิทธิ์เข้าถึง"] }; }
  }
  return <div className="container detail-page">
    <p className="eyebrow"><span />ฝากของส่งรถ</p>
    <h1>{initial.id ? `แก้ไขฉบับร่าง ${initial.code}` : "ฝากของส่งรถ"}</h1>
    <p className="muted">ฝากสื่อการตลาด เอกสาร หรืออุปกรณ์ไปกับรถส่งสาขา หนึ่งคำขอต่อหนึ่งสาขาปลายทาง ผู้จัดรถจะตรวจสอบและจัดรอบรถให้</p>
    <ConsignForm options={options} initial={initial} today={today} />
  </div>;
}
