import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, Tag, TriangleAlert } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { labelOverview } from "@/server/services/labels";
import { DomainError } from "@/server/domain/errors";
import { LABEL_FORMATS, type LabelFormat } from "@/server/domain/labels";
import { LabelActions } from "@/components/label-actions";
import { statusText } from "@/lib/consignment-format";
import { thaiDateTime } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ฉลากหีบห่อ" };

export default async function LabelsPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor(), { id } = await params;
  let o;
  try { o = await labelOverview(getDatabase(), actor.id, id); }
  catch (error) { if (error instanceof DomainError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) notFound(); throw error; }
  const formats = Object.keys(LABEL_FORMATS) as LabelFormat[];
  const blocked = !o.assigned ? "ยังไม่จัดรอบรถ จึงออกฉลากไม่ได้" : !o.issuable ? `ออกฉลากไม่ได้ในสถานะ “${statusText(o.consignment.status)}”` : o.current ? `มีฉลากฉบับที่ ${o.current.number} เป็นฉบับปัจจุบันแล้ว ให้ใช้การพิมพ์ซ้ำ`
    : o.masterChanged ? "ข้อมูลสาขาถูกแก้ไขหลังจัดรถ ต้องให้ผู้วางแผนขนส่งกด “อัปเดตที่อยู่” ก่อน" : o.problems.length ? `ข้อมูลไม่ครบ: ${o.problems.join(" · ")}` : null;
  return <div className="container detail-page">
    <Link href={`/consignments/${o.consignment.id}`} className="text-link"><ArrowLeft size={17} aria-hidden="true" />กลับไปรายการฝากส่ง</Link>
    <header className="detail-header"><div><p className="eyebrow"><span />ฉลากหีบห่อ</p><h1>{o.consignment.code}</h1><p className="muted">ถึง {o.consignment.branch} · {statusText(o.consignment.status)}</p></div></header>
    {o.masterChanged && <p className="notice-panel"><TriangleAlert size={20} aria-hidden="true" /><span>ที่อยู่หรือผู้ติดต่อของสาขาในข้อมูลหลักต่างจากที่บันทึกไว้ตอนจัดรถ ฉลากที่ออกแล้วยังใช้ข้อมูลเดิม หากต้องการแก้ ให้ผู้วางแผนขนส่งอัปเดตที่อยู่ ระบบจะยกเลิกฉลากเดิมและออกฉบับใหม่</span></p>}
    <div className="consignment-layout">
      <div>
        <section className="detail-card" aria-labelledby="current-title"><h2 id="current-title"><Tag size={19} aria-hidden="true" />ฉลากฉบับปัจจุบัน</h2>
          {o.current ? <>
            <p><strong>ฉบับที่ {o.current.number}</strong> · ออกโดย {o.current.issuedBy ?? "—"} เมื่อ {thaiDateTime(o.current.issuedAt)} น. · พิมพ์แล้ว {o.current.prints.length} ครั้ง</p>
            {o.canPrint ? <div className="form-actions">{formats.map((f) => <Link key={f} className="primary-button" href={`/print/labels/${o.current!.id}?format=${f}`}><Printer size={17} aria-hidden="true" />พิมพ์ {LABEL_FORMATS[f]}</Link>)}</div> : <p className="muted">บัญชีนี้ไม่มีสิทธิ์พิมพ์ฉลาก</p>}
          </> : <p className="muted">ยังไม่มีฉลากที่ใช้งานได้</p>}
          {o.sample && <p className="sample-links">ดูตัวอย่าง (มีลายน้ำ “ตัวอย่าง” ไม่มีคิวอาร์): {formats.map((f) => <Link key={f} className="text-link" href={`/print/sample/${o.consignment.id}?format=${f}`}>{LABEL_FORMATS[f]}</Link>)}</p>}
          {o.problems.length > 0 && <ul className="problem-list" aria-label="ข้อมูลที่ต้องมีก่อนออกฉลากจริง">{o.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </section>
        <section className="detail-card" aria-labelledby="history-title"><h2 id="history-title">ประวัติฉลากและการพิมพ์</h2>
          {o.versions.length ? <ol className="assignment-history">{[...o.versions].reverse().map((v) => <li key={v.id} className={v.revokedAt ? undefined : "current"}>
            <strong>ฉบับที่ {v.number}</strong> {v.revokedAt ? <span className="status-pill tone-alert">ยกเลิกแล้ว</span> : <span className="status-pill tone-done">ปัจจุบัน</span>}
            <p className="muted small">ออกโดย {v.issuedBy ?? "—"} · {thaiDateTime(v.issuedAt)} น.</p>
            {v.revokedAt && <p className="small">ยกเลิกเมื่อ {thaiDateTime(v.revokedAt)} น. เพราะ {v.revocationReason ?? "ไม่ระบุ"} ฉลากฉบับนี้ใช้ไม่ได้และสแกนจะถูกปฏิเสธ</p>}
            {v.prints.length > 0 ? <ul className="print-log">{v.prints.map((e, n) => <li key={n}>{n === 0 ? "พิมพ์ครั้งแรก" : `พิมพ์ซ้ำครั้งที่ ${n}`} · {LABEL_FORMATS[e.format as LabelFormat] ?? e.format} · {e.copies} ชุด · {e.actor} · {thaiDateTime(e.at)} น.{e.reason ? ` · ${e.reason}` : ""}</li>)}</ul> : <p className="muted small">ยังไม่เคยพิมพ์</p>}
          </li>)}</ol> : <p className="muted">ยังไม่เคยออกฉลาก</p>}
        </section>
      </div>
      <aside className="detail-card action-column" aria-labelledby="label-actions-title"><h2 id="label-actions-title">การดำเนินการ</h2>
        {o.canIssue || o.canCorrect ? <LabelActions consignmentId={o.consignment.id} version={o.consignment.version} canIssue={o.canIssue} canCorrect={o.canCorrect} blocked={blocked} masterChanged={o.masterChanged} /> : <p className="muted">บัญชีนี้ดูประวัติฉลากได้ แต่ไม่มีสิทธิ์ออกหรือแก้ไขฉลาก</p>}
      </aside>
    </div>
  </div>;
}
