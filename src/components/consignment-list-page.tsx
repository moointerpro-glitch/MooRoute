import Link from "next/link";
import { Download, PackagePlus } from "lucide-react";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { consignmentStatusCounts, listConsignments } from "@/server/services/consignments";
import { principal } from "@/server/auth/permissions";
import { DomainError } from "@/server/domain/errors";
import { ACTIVE_STATUSES, FINISHED_STATUSES, type ConsignmentState } from "@/server/domain/consignment";
import { parseHistoryFilter, statusTone, unitText, type ListPhase } from "@/lib/consignment-format";
import { nextStepText, statusDisplay } from "@/lib/consignment-progress";
import { bangkokClock, beDate, roundLabel, thaiDateTime } from "@/lib/trip-format";
import { AutoRefresh } from "./auto-refresh";
import { ConsignmentFilters } from "./consignment-filters";

/** What each active status is waiting for; used as the tracking chips (D236). */
const WAITING: Record<string, string> = {
  DRAFT: "ฉบับร่าง", PENDING_REVIEW: "รอจัดรถ", ASSIGNED: "รอคลังรับของ", WAREHOUSE_RECEIVED: "รอขึ้นรถ", LOADED: "รอรถออก",
  IN_TRANSIT: "กำลังขนส่ง", PARTIALLY_RECEIVED: "รับบางส่วน", RECEIVED: "รอยืนยันจัดส่งสำเร็จ", ISSUE: "พบปัญหา",
};
const FINISHED_OPTIONS = [{ value: "CLOSED", label: "จัดส่งสำเร็จ / ปิดงาน" }, { value: "CANCELLED", label: "ยกเลิก" }, { value: "RETURNED", label: "ส่งคืน" }, { value: "REJECTED", label: "ไม่อนุมัติ (รายการเดิม)" }];
const TEXT = {
  active: { path: "/tracking", eyebrow: "ติดตาม", title: "ติดตามงานฝากส่ง", lead: "รายการที่ยังไม่จบ เรียงจากใหม่ไปเก่า เลือกกลุ่มด้านล่างเพื่อดูงานที่รออยู่ในแต่ละขั้น", empty: "ไม่มีงานที่ค้างอยู่ในกลุ่มนี้", label: "กรองงานที่กำลังติดตาม" },
  finished: { path: "/consignments", eyebrow: "ประวัติ", title: "ประวัติฝากส่ง", lead: "รายการที่จบแล้ว: จัดส่งสำเร็จ ปิดงาน ยกเลิก หรือส่งคืน ใช้ค้นย้อนหลังและส่งออกไฟล์", empty: "ไม่พบรายการในประวัติ", label: "กรองประวัติฝากส่ง" },
} as const;

/** Shared by the tracking page (not finished yet) and the history page (finished). Both use the same row scope. */
export async function ConsignmentListPage({ phase, searchParams }: { phase: ListPhase; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor(), raw = await searchParams, db = getDatabase(), text = TEXT[phase];
  const params = new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => v ? [[k, v]] : []));
  const allowed: string[] = phase === "active" ? ACTIVE_STATUSES : FINISHED_STATUSES;
  // A status from the other page is ignored rather than widening this list.
  const parsed = parseHistoryFilter(params), filter = { ...parsed, phase, status: parsed.status.filter((s) => allowed.includes(s)).slice(0, 1) };
  let result, counts: Record<string, number> = {};
  try {
    result = await listConsignments(db, actor.id, filter);
    if (phase === "active") counts = await consignmentStatusCounts(db, actor.id, { mine: filter.mine });
  } catch (error) {
    if (error instanceof DomainError && ["FORBIDDEN", "INVALID_SEARCH", "INVALID_DATE"].includes(error.code)) return <div className="container message-page"><span className="eyebrow">{text.eyebrow}</span><h1>{error.code === "FORBIDDEN" ? "บัญชีนี้ยังไม่มีสิทธิ์ดูรายการฝากส่ง" : "ตัวกรองไม่ถูกต้อง"}</h1><p>{error.message}</p><Link className="secondary-button" href={text.path}>ล้างตัวกรอง</Link></div>;
    throw error;
  }
  const p = await db.$transaction((tx) => principal(tx, actor.id));
  const [branches, categories] = await Promise.all([db.branch.findMany({ where: { archived: false, destinationType: "BRANCH" }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }), db.consignmentCategory.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, name: true } })]);
  const withParam = (key: string, value: string | null) => { const q = new URLSearchParams(params); q.delete("page"); if (value) q.set(key, value); else q.delete(key); const s = q.toString(); return s ? `${text.path}?${s}` : text.path; };
  const page = (n: number) => { const q = new URLSearchParams(params); if (n > 1) q.set("page", String(n)); else q.delete("page"); const s = q.toString(); return s ? `${text.path}?${s}` : text.path; };
  const exportParams = new URLSearchParams(params); exportParams.delete("page"); exportParams.set("phase", phase);
  // Read once per render: identifies this render for the auto-refresh and shows when the list was read.
  const renderedAt = Date.now();
  const status = filter.status[0] ?? "", activeTotal = ACTIVE_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0);

  return <div className="container list-page">
    <header className="list-header"><div><p className="eyebrow"><span />{text.eyebrow}</p><h1>{text.title}</h1><p className="muted">{text.lead}</p></div>
      {p.permissions.has("consignment.create") && <Link className="primary-button" href="/consign"><PackagePlus size={18} aria-hidden="true" />ฝากของส่งรถ</Link>}</header>
    {phase === "active" && <nav className="status-chips" aria-label="กลุ่มงานตามขั้นตอน">
      <Link href={withParam("status", null)} className={status ? "status-chip" : "status-chip selected"} aria-current={status ? undefined : "true"}>ทั้งหมด<span>{activeTotal.toLocaleString("th-TH")}</span></Link>
      {ACTIVE_STATUSES.filter((s) => (counts[s] ?? 0) > 0 || s === status).map((s) => <Link key={s} href={withParam("status", s)} className={`status-chip${s === status ? " selected" : ""}${s === "ISSUE" ? " alert" : ""}`} aria-current={s === status ? "true" : undefined}>{WAITING[s]}<span>{(counts[s] ?? 0).toLocaleString("th-TH")}</span></Link>)}
    </nav>}
    <ConsignmentFilters label={text.label} branches={branches} categories={categories} statusOptions={phase === "finished" ? FINISHED_OPTIONS : undefined}
      initial={{ q: filter.query, status, branch: filter.branchId ?? "", category: filter.categoryId ?? "", date: filter.date ?? "", trip: filter.tripCode ?? "", mine: filter.mine }} />
    <section className="search-card results" aria-label={text.title}>
      {/* Tracking follows the workflow by itself; history is re-read when the page is shown again. */}
      <AutoRefresh renderedAt={renderedAt} renderedLabel={bangkokClock(renderedAt)} intervalMs={phase === "active" ? 20_000 : undefined} />
      <div className="results-head"><p className="count-badge" role="status">พบ {result.total.toLocaleString("th-TH")} รายการ</p>
        <a className="secondary-button" href={`/api/consignments/export?${exportParams}`}><Download size={16} aria-hidden="true" />ส่งออก CSV</a></div>
      {result.rows.length === 0 ? <div className="results-state"><div><h2>{text.empty}</h2><p>{phase === "active" ? <>งานที่จบแล้วอยู่ที่ <Link href="/consignments">ประวัติ</Link></> : <>งานที่ยังไม่จบอยู่ที่ <Link href="/tracking">ติดตาม</Link></>}</p></div></div>
        : <ul className="history-list">{result.rows.map((r) => <li key={r.id} className="history-item">
          <div className="history-main">
            <p className="history-code"><Link href={`/consignments/${r.id}`}>{r.code}</Link><span className={`status-pill ${r.status === "CLOSED" && r.incomplete ? "tone-muted" : statusTone(r.status)}`}>{statusDisplay(r.status, r.incomplete)}</span>{r.category && <span className="category-tag">{r.category}</span>}</p>
            <p><strong>{r.packagingCount || "ยังไม่ระบุสิ่งที่ฝากส่ง"}</strong>{(r.contents.length > 0 || r.items.length > 0) && ` — ${[...r.contents, ...r.items.map((i) => `${i.name} ${Number(i.quantity).toLocaleString("th-TH")} ${unitText(i.unit)}`)].join(", ")}`}</p>
            <p className="muted small">ถึง {r.branch.name} ({r.branch.code}) · จาก {r.warehouse} · โดย {r.requester} · สร้าง {thaiDateTime(r.createdAt)} น.</p>
            {phase === "active" && <p className="next-step"><strong>ขั้นต่อไป:</strong> {nextStepText(r.status as ConsignmentState)}</p>}
          </div>
          <div className="history-trip">{r.trip ? <><strong>{r.trip.code}</strong><span>{r.trip.serviceDate ? beDate(r.trip.serviceDate) : ""} · {roundLabel(r.trip.roundNo)}</span><span>{r.trip.plate ?? ""}</span></> : <span className="muted">{r.requestedServiceDate ? `ต้องการส่ง ${beDate(r.requestedServiceDate)}` : "ยังไม่จัดรถ"}</span>}</div>
        </li>)}</ul>}
      {result.pageCount > 1 && <div className="results-foot"><span>หน้า {result.page} จาก {result.pageCount}</span><nav className="pager" aria-label="เลือกหน้า">
        {result.page > 1 ? <Link className="secondary-button" href={page(result.page - 1)}>ก่อนหน้า</Link> : <span className="secondary-button" aria-disabled="true">ก่อนหน้า</span>}
        {result.page < result.pageCount ? <Link className="secondary-button" href={page(result.page + 1)}>ถัดไป</Link> : <span className="secondary-button" aria-disabled="true">ถัดไป</span>}</nav></div>}
    </section>
  </div>;
}
