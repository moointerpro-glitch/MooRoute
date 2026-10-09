import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { optionalActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { lookupLabel } from "@/server/services/labels";
import { DomainError } from "@/server/domain/errors";
import { custodyLabels } from "@/server/domain/consignment";
import { statusText } from "@/lib/consignment-format";
import { thaiDateTime } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตรวจสอบฉลาก" };

/** QR landing page. Shows nothing until the viewer signs in and passes the consignment row policy. */
export default async function LabelLookupPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ p?: string }> }) {
  const { token } = await params, { p } = await searchParams;
  const sequence = /^\d{1,3}$/.test(p ?? "") ? Number(p) : null;
  const actor = await optionalActor(await headers());
  if (!actor) redirect(`/login?next=${encodeURIComponent(`/l/${token}${sequence ? `?p=${sequence}` : ""}`)}`);
  let result;
  try { result = await lookupLabel(getDatabase(), actor.id, token, sequence); }
  catch (error) {
    if (!(error instanceof DomainError)) throw error;
    // Unknown and unauthorized labels are reported without any consignment detail.
    return <div className="container message-page"><span className="eyebrow">ตรวจสอบฉลาก</span><h1>{error.code === "FORBIDDEN" ? "คุณไม่มีสิทธิ์ดูรายการของฉลากนี้" : "ไม่พบฉลากนี้ในระบบ"}</h1><p>ตรวจสอบว่าสแกนฉลากของสาขาหรือคลังที่คุณรับผิดชอบ หรือติดต่อผู้วางแผนขนส่ง</p></div>;
  }
  const current = result.state === "CURRENT";
  return <div className="container detail-page lookup-page">
    <p className="eyebrow"><span />ตรวจสอบฉลาก</p>
    <h1>{result.consignment.code}</h1>
    {current ? <p className="form-success" role="status"><CheckCircle2 size={18} aria-hidden="true" className="inline-icon" />ฉลากฉบับที่ {result.number} เป็นฉบับปัจจุบัน ใช้งานได้</p>
      : <div className="form-error" role="alert"><p><TriangleAlert size={18} aria-hidden="true" className="inline-icon" /><strong>ฉลากฉบับที่ {result.number} ถูกยกเลิกแล้ว ห้ามใช้รับหรือส่งของ</strong></p>
        <p>ยกเลิกเมื่อ {result.revokedAt ? `${thaiDateTime(result.revokedAt)} น.` : "—"} · เหตุผล: {result.revocationReason ?? "ไม่ระบุ"}</p>
        <p>{result.replacement ? `ฉบับปัจจุบันคือฉบับที่ ${result.replacement.number} กรุณาใช้ฉลากฉบับนั้น` : "ยังไม่มีฉลากฉบับใหม่ กรุณาติดต่อผู้วางแผนขนส่ง"}</p></div>}
    <section className="detail-card"><dl className="fact-list">
      <div><dt>สถานะรายการ</dt><dd>{statusText(result.consignment.status)}</dd></div>
      {result.package && <div><dt>บรรจุภัณฑ์ที่สแกน</dt><dd>{result.package.name} · {custodyLabels[result.package.custody]}</dd></div>}
      <div><dt>ฉลาก</dt><dd>ฉบับที่ {result.number}{current ? "" : " (ยกเลิก)"}</dd></div>
    </dl>
    <Link className="primary-button" href={`/consignments/${result.consignment.id}`}>เปิดรายการฝากส่ง</Link></section>
  </div>;
}
