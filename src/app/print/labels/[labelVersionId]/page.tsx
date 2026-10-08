import Link from "next/link";
import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { authConfiguration } from "@/server/auth/config";
import { labelSheet } from "@/server/services/labels";
import { DomainError } from "@/server/domain/errors";
import { LABEL_FORMATS, type LabelFormat } from "@/server/domain/labels";
import { LabelSheets, pageRule } from "@/components/label-sheet";
import { PrintToolbar } from "@/components/print-toolbar";

export const dynamic = "force-dynamic";
export const metadata = { title: "พิมพ์ฉลาก" };

export default async function PrintLabelsPage({ params, searchParams }: { params: Promise<{ labelVersionId: string }>; searchParams: Promise<{ format?: string }> }) {
  const actor = await requirePageActor(), { labelVersionId } = await params, raw = (await searchParams).format;
  const format: LabelFormat = raw === "STICKER_100X150" ? "STICKER_100X150" : "A4_4UP";
  let sheet;
  try { sheet = await labelSheet(getDatabase(), actor.id, labelVersionId); }
  catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    if (error instanceof DomainError && error.code === "FORBIDDEN") return <div className="container message-page"><span className="eyebrow">พิมพ์ฉลาก</span><h1>คุณไม่มีสิทธิ์พิมพ์ฉลากนี้</h1><p>การพิมพ์ฉลากทำได้เฉพาะผู้วางแผนขนส่ง หรือคลังต้นทางของรายการ</p></div>;
    throw error;
  }
  const back = { href: `/consignments/${sheet.consignmentId}/labels`, label: "กลับไปหน้าฉลาก" };
  // A revoked version is never rendered as a printable label.
  if (sheet.revoked || !sheet.payload) return <div className="container message-page">
    <span className="eyebrow">พิมพ์ฉลาก {sheet.consignmentCode}</span>
    <h1><TriangleAlert size={26} aria-hidden="true" className="inline-icon" />ฉลากฉบับที่ {sheet.number} ถูกยกเลิกแล้ว</h1>
    <p>เหตุผล: {sheet.revocationReason ?? "ไม่ระบุ"} ห้ามใช้ฉลากฉบับนี้ติดของ</p>
    {sheet.replacement ? <Link className="primary-button" href={`/print/labels/${sheet.replacement.labelVersionId}?format=${format}`}>เปิดฉลากฉบับที่ {sheet.replacement.number} (ปัจจุบัน)</Link> : <Link className="primary-button" href={back.href}>ออกฉลากฉบับใหม่</Link>}
  </div>;
  return <div className="print-page">
    <style>{pageRule(format)}</style>
    <div className="container no-print"><p className="eyebrow"><span />พิมพ์ฉลาก</p><h1>{sheet.consignmentCode} · ฉลากฉบับที่ {sheet.number}</h1>
      <PrintToolbar labelVersionId={sheet.id} format={format} printed={sheet.printed} back={back}
        formats={(Object.keys(LABEL_FORMATS) as LabelFormat[]).map((value) => ({ value, label: LABEL_FORMATS[value], href: `/print/labels/${sheet.id}?format=${value}` }))} /></div>
    <LabelSheets payload={sheet.payload} format={format} baseUrl={authConfiguration(process.env).baseURL} />
  </div>;
}
