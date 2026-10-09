import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, Check, CheckCircle2, Circle, CircleDot, Clock3, FileText, History, ListChecks, MapPin, Minus, Package, Truck, TriangleAlert } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { consignmentDetail } from "@/server/services/consignments";
import { DomainError } from "@/server/domain/errors";
import { custodyLabels, eventLabels, FINISHED_STATUSES, issueTypes, receiptModeLabels, type ConsignmentState } from "@/server/domain/consignment";
import { consignmentProgress, statusDisplay } from "@/lib/consignment-progress";
import { ConsignmentActions } from "@/components/consignment-actions";
import { statusText, statusTone, unitText } from "@/lib/consignment-format";

const stepIcon = { done: Check, current: CircleDot, todo: Circle, skipped: Minus, unreached: Circle } as const;
const stepWord = { done: "เสร็จแล้ว", current: "ขั้นตอนปัจจุบัน", todo: "ยังไม่ถึง", skipped: "ไม่มีบันทึก", unreached: "ไม่ได้ดำเนินการ" } as const;
import { bangkokClock, beDate, roundLabel, thaiDateTime } from "@/lib/trip-format";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายละเอียดฝากส่ง" };

type Snapshot = { branch?: Record<string, string>; warehouse?: Record<string, string>; contact?: { name: string | null; phone: string | null } };
const clock = (iso: unknown) => typeof iso === "string" ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) + " น." : "ยังไม่ระบุ";
function eventDetail(kind: string, p: Record<string, unknown>) {
  if (kind === "ISSUE") return `${issueTypes[String(p.type)] ?? ""}: ${String(p.description ?? "")}`;
  if (kind === "RECEIPT") return `${Array.isArray(p.lines) ? p.lines.length : 0} รายการ${p.correction ? ` · แก้ไขโดยผู้วางแผนขนส่ง: ${String(p.correction)}` : ""}`;
  return typeof p.reason === "string" ? p.reason : typeof p.type === "string" && p.type === "RECEIPT_BEFORE_DEPARTURE" ? "บันทึกรับของก่อนมีบันทึกรถออก" : "";
}

export default async function ConsignmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const actor = await requirePageActor(), { id } = await params, { submitted } = await searchParams;
  let d;
  try { d = await consignmentDetail(getDatabase(), actor.id, id); }
  catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    if (error instanceof DomainError && error.code === "FORBIDDEN") return <div className="container message-page"><span className="eyebrow">รายละเอียดฝากส่ง</span><h1>คุณไม่มีสิทธิ์ดูรายการนี้</h1><p>รายการฝากส่งแสดงเฉพาะผู้เกี่ยวข้องตามขอบเขตงาน</p><Link className="secondary-button" href="/tracking">กลับไปหน้าติดตาม</Link></div>;
    throw error;
  }
  const current = d.assignments.find((a) => a.current), t = current?.transport ?? {}, recipient = (current?.recipient ?? {}) as Snapshot;
  const finished = FINISHED_STATUSES.includes(d.status as ConsignmentState), back = finished ? { href: "/consignments", label: "กลับไปประวัติ" } : { href: "/tracking", label: "กลับไปหน้าติดตาม" };
  const progress = consignmentProgress({ status: d.status, resumeStatus: d.resumeStatus, events: d.events, received: d.receivedPackages, pieces: d.packages.length, incomplete: d.incomplete });
  // A request saved with the earlier form keeps its separate item list; rows saved since D236 carry their own contents.
  const loose = d.looseItems.length ? d.looseItems : d.status === "DRAFT" ? d.items : [];
  const amount = (value: string) => Number(value).toLocaleString("th-TH");
  const renderedAt = Date.now();
  return <div className="container detail-page">
    <Link href={back.href} className="text-link"><ArrowLeft size={17} aria-hidden="true" />{back.label}</Link>
    {submitted && <p className="form-success" role="status"><CheckCircle2 size={16} aria-hidden="true" className="inline-icon" />ส่งคำขอแล้ว ผู้วางแผนขนส่งจะตรวจสอบและจัดรอบรถให้</p>}
    <header className="detail-header">
      <div><p className="eyebrow"><span />ฝากของส่งรถ</p><h1>{d.code}</h1>
        <p className="muted">โดย {d.requester} · {d.department} · สร้าง {thaiDateTime(d.createdAt)} น.</p></div>
      <div className="status-stack"><span className={`status-pill large ${d.status === "CLOSED" && d.incomplete ? "tone-muted" : statusTone(d.status)}`}>{statusDisplay(d.status, d.incomplete)}</span>
        {d.status === "ISSUE" && d.resumeStatus && <span className="muted small">สถานะการขนส่งก่อนพบปัญหา: {statusText(d.resumeStatus)}</span>}</div>
    </header>
    {d.hasOpenIssue && <p className="notice-panel"><TriangleAlert size={20} aria-hidden="true" /><span>มีปัญหาที่ยังไม่ได้ปิด รายการนี้ยืนยันจัดส่งสำเร็จไม่ได้จนกว่าผู้วางแผนขนส่งจะบันทึกผลการแก้ไข</span></p>}
    <div className="consignment-layout">
      <div>
        <section className="detail-card progress-card" aria-labelledby="progress-title"><h2 id="progress-title"><ListChecks size={19} aria-hidden="true" />ความคืบหน้า</h2>
          {/* Another person's step (assigned, loaded, departed, received) appears here without a reload; finished requests stop polling. */}
          <AutoRefresh compact renderedAt={renderedAt} renderedLabel={bangkokClock(renderedAt)} intervalMs={finished ? undefined : 30_000} />
          <p className="progress-next" role="status"><strong>{progress.stopped || d.status === "CLOSED" ? "สถานะสุดท้าย" : "ขั้นต่อไป"}:</strong> {progress.next}</p>
          <ol className="progress-steps">{progress.steps.map((step, index) => { const Icon = stepIcon[step.state]; return <li key={step.key} className={`progress-step step-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
            <span className="step-mark" aria-hidden="true"><Icon size={15} /></span>
            <div><strong>{index + 1}. {step.label}</strong><span className="sr-only"> ({stepWord[step.state]})</span>
              {step.at && <span className="step-meta">{thaiDateTime(step.at)} น. · {step.actor}</span>}
              {step.hint && <span className="step-meta">{step.hint}</span>}</div>
          </li>; })}</ol>
          {progress.issue && <p className="progress-alert"><TriangleAlert size={16} aria-hidden="true" /><span>พบปัญหา{progress.issue.at ? ` เมื่อ ${thaiDateTime(progress.issue.at)} น. โดย ${progress.issue.actor}` : ""} ขั้นตอนถัดไปทำต่อได้หลังผู้วางแผนขนส่งปิดปัญหา</span></p>}
          {progress.stopped && <p className="progress-alert progress-stopped"><Ban size={16} aria-hidden="true" /><span><strong>{progress.stopped.label}</strong>{progress.stopped.at ? ` เมื่อ ${thaiDateTime(progress.stopped.at)} น. โดย ${progress.stopped.actor}` : ""}{progress.stopped.reason ? ` · เหตุผล: ${progress.stopped.reason}` : ""}</span></p>}
        </section>
        <div className="detail-grid">
          <section className="detail-card" aria-labelledby="route-title"><h2 id="route-title"><MapPin size={19} aria-hidden="true" />ต้นทางและปลายทาง</h2>
            <dl className="fact-list">
              <div><dt>คลังต้นทาง</dt><dd>{d.warehouse.name}</dd></div>
              <div><dt>สาขาปลายทาง</dt><dd>{d.branch.name} ({d.branch.code})</dd></div>
              <div><dt>ต้องการส่ง</dt><dd>{d.requested.serviceDate ? beDate(d.requested.serviceDate) : "ยังไม่ระบุ"} · {d.requested.roundNo ? roundLabel(d.requested.roundNo) : "ไม่ระบุรอบ"}{d.requested.tripCode ? ` · ${d.requested.tripCode}` : ""}</dd></div>
              <div><dt>ผู้ฝาก</dt><dd>{d.contacts.senderName ?? "ยังไม่ระบุ"} {d.contacts.senderPhone ?? ""}</dd></div>
              <div><dt>ผู้รับ</dt><dd>{recipient.contact ? `${recipient.contact.name ?? ""} ${recipient.contact.phone ?? ""}` : `${d.contacts.recipientName ?? "ใช้ผู้ติดต่อของสาขา"} ${d.contacts.recipientPhone ?? ""}`}</dd></div>
            </dl>
          </section>
          <section className="detail-card" aria-labelledby="trip-title"><h2 id="trip-title"><Truck size={19} aria-hidden="true" />รอบรถ</h2>
            {current ? <dl className="fact-list">
              <div><dt>รอบรถ</dt><dd><Link href={`/trips/${encodeURIComponent(current.tripId)}?branch=${encodeURIComponent(d.branch.id)}`}>{current.tripCode}</Link></dd></div>
              <div><dt>วันที่ / รอบ</dt><dd>{typeof t.serviceDate === "string" ? beDate(t.serviceDate) : "—"} · {roundLabel(typeof t.roundNo === "number" ? t.roundNo : null)}</dd></div>
              <div><dt>เวลาเริ่มขึ้นของ</dt><dd>{clock(t.loadingAt)}</dd></div>
              <div><dt>เวลาออกรถ</dt><dd>{clock(t.departureAt)}</dd></div>
              <div><dt>ทะเบียนรถ</dt><dd>{typeof t.plate === "string" ? `${t.plate} ${t.province ?? ""}` : "ยังไม่ระบุ"}</dd></div>
              <div><dt>จัดโดย</dt><dd>{current.approvedBy} · {thaiDateTime(current.approvedAt)} น.</dd></div>
            </dl> : <p className="muted">ยังไม่จัดรอบรถ</p>}
          </section>
        </div>
        <section className="detail-card" aria-labelledby="items-title"><h2 id="items-title"><Package size={19} aria-hidden="true" />สิ่งที่ฝากส่ง</h2>
          <p className="muted small">{d.packagingCount || "ยังไม่ระบุ"}{d.category ? ` · หมวด${d.category}` : ""} · {receiptModeLabels[d.receiptMode]}{d.packages.length > 0 && ` · สาขารับแล้ว ${d.receivedPackages}/${d.packages.length}`}</p>
          {d.packaging.length > 0 ? <div className="table-scroll"><table className="admin-table compact"><caption className="sr-only">สิ่งที่ฝากส่ง</caption>
            <thead><tr><th scope="col">บรรจุภัณฑ์</th><th scope="col">จำนวน</th><th scope="col">ชื่อรายการ</th><th scope="col">จำนวนข้างใน</th><th scope="col">รายละเอียด</th></tr></thead>
            <tbody>{d.packaging.map((l, n) => <tr key={n}><th scope="row">{l.packagingName}</th><td>{l.count.toLocaleString("th-TH")}</td><td>{l.label ?? "—"}</td>
              <td>{l.quantity ? <>{amount(l.quantity)} {l.unitName}{l.item && d.receiptMode === "DETAILED" && <small className="cell-note">รับแล้ว {amount(l.item.received)}{Number(l.item.returned) > 0 && ` · ส่งคืน ${amount(l.item.returned)}`}</small>}</> : "—"}</td>
              <td>{l.name ? l.description ?? "—" : "—"}</td></tr>)}</tbody></table></div>
            : <p className="muted">ยังไม่ระบุสิ่งที่ฝากส่ง</p>}
          {d.packages.length > 0 && <details className="piece-details"><summary>ดูทีละบรรจุภัณฑ์ ({d.packages.length.toLocaleString("th-TH")})</summary>
            <ul className="package-list">{d.packages.map((p) => <li key={p.id}><span><strong>{p.name}</strong>{p.description && <small>{p.description}</small>}</span><span className={`custody custody-${p.custody.toLowerCase()}`}>{custodyLabels[p.custody]}</span></li>)}</ul></details>}
          {loose.length > 0 && <><h3 className="sub-title">รายการสิ่งของ (กรอกด้วยแบบฟอร์มเดิม)</h3>
            <div className="table-scroll"><table className="admin-table compact"><caption className="sr-only">รายการสิ่งของจากแบบฟอร์มเดิม</caption>
              <thead><tr><th scope="col">รายการ</th><th scope="col">หมวด</th><th scope="col">ส่ง</th><th scope="col">รับแล้ว</th><th scope="col">ส่งคืน</th></tr></thead>
              <tbody>{loose.map((i) => <tr key={i.id}><td>{i.name}</td><td>{i.category || "—"}</td><td>{amount(i.sent)} {unitText(i.unit)}</td><td>{amount(i.received)}</td><td>{amount(i.returned)}</td></tr>)}</tbody></table></div></>}
          {d.notes && <p className="small"><strong>หมายเหตุ:</strong> {d.notes}</p>}
        </section>
        <section className="detail-card" aria-labelledby="timeline-title"><h2 id="timeline-title"><History size={19} aria-hidden="true" />บันทึกเหตุการณ์ทั้งหมด</h2>
          {d.events.length ? <ol className="timeline">{d.events.map((e) => <li key={e.id}><span className="timeline-dot" aria-hidden="true" /><div><strong>{eventLabels[e.kind] ?? e.kind}</strong> <span className="muted small"><Clock3 size={12} aria-hidden="true" className="inline-icon" />{thaiDateTime(e.at)} น. · {e.actor}</span>{eventDetail(e.kind, e.payload) && <p>{eventDetail(e.kind, e.payload)}</p>}</div></li>)}</ol>
            : <p className="muted">ยังไม่มีเหตุการณ์ (ฉบับร่าง)</p>}
        </section>
        {d.assignments.length > 0 && <section className="detail-card" aria-labelledby="assign-title"><h2 id="assign-title"><Truck size={19} aria-hidden="true" />ประวัติการจัดรถและข้อมูลที่บันทึกไว้</h2>
          <ol className="assignment-history">{d.assignments.map((a) => { const r = a.recipient as Snapshot; return <li key={a.id} className={a.current ? "current" : undefined}>
            <strong>{a.tripCode}</strong> {a.current ? <span className="status-pill tone-active">ปัจจุบัน</span> : <span className="status-pill tone-muted">ฉบับก่อนหน้า</span>}
            <p className="muted small">{a.reason} · {a.approvedBy} · {thaiDateTime(a.approvedAt)} น.</p>
            {r.branch && <p className="small">ที่อยู่ ณ เวลาจัดรถ: {[r.branch.name, r.branch.addressLine, r.branch.subdistrict, r.branch.district, r.branch.province, r.branch.postalCode].join(" ")}</p>}
            {a.labels.length > 0 && <p className="small">ฉลาก: {a.labels.map((l) => `ฉบับที่ ${l.number}${l.revoked ? " (ยกเลิกแล้ว)" : ""}`).join(", ")}</p>}
          </li>; })}</ol>
          <p className="muted small">เมื่อย้ายรอบรถ เปลี่ยนรถ หรือแก้ไขที่อยู่ ฉลากเดิมจะถูกยกเลิกโดยอัตโนมัติและต้องออกฉบับใหม่</p>
          <div className="form-actions"><Link className="secondary-button" href={`/consignments/${d.id}/labels`}>ฉลากติดของและประวัติการพิมพ์</Link>{current && <Link className="secondary-button" href={`/print/manifest/${encodeURIComponent(current.tripId)}`}>ใบคุมรถของรอบนี้</Link>}</div>
        </section>}
        <section className="detail-card" aria-labelledby="files-title"><h2 id="files-title"><FileText size={19} aria-hidden="true" />เอกสารแนบ</h2>
          {d.attachments.length ? <ul className="attachment-list">{d.attachments.map((a) => <li key={a.id}><a href={`/api/attachments/${a.id}`}>{a.name}</a> <span className="muted small">{Math.ceil(a.size / 1024).toLocaleString("th-TH")} KB · {a.uploader}</span></li>)}</ul> : <p className="muted">ไม่มีเอกสารแนบ</p>}
          {d.canUpload && d.status === "DRAFT" && <Link className="text-link" href={`/consign?id=${d.id}`}>แนบไฟล์เพิ่ม</Link>}
        </section>
      </div>
      <aside className="detail-card action-column" aria-labelledby="actions-title"><h2 id="actions-title">การดำเนินการ</h2><ConsignmentActions d={d} /></aside>
    </div>
  </div>;
}
