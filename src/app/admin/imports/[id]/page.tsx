import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { importBatchDetail } from "@/server/services/imports";
import { importKinds } from "@/server/domain/imports";
import { DomainError } from "@/server/domain/errors";
import { ImportReview } from "@/components/import-review";
import { thaiDateTime } from "@/lib/trip-format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตรวจสอบชุดนำเข้า" };
const statusLabels: Record<string, string> = { STAGED: "รอแก้ไขหรือตัดสินใจ", VALIDATED: "พร้อมนำเข้า", COMMITTED: "นำเข้าแล้ว", REJECTED: "ยกเลิก" };

export default async function ImportBatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ existing?: string }> }) {
  const actor = await requirePageActor(), { id } = await params, { existing } = await searchParams;
  let d;
  try { d = await importBatchDetail(getDatabase(), actor.id, id); }
  catch (error) { if (error instanceof DomainError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) notFound(); throw error; }
  return <>
    <p><Link href="/admin/imports">← กลับไปหน้านำเข้าข้อมูล</Link></p>
    <h1>{d.sourceEdition}</h1>
    <p className="muted">{importKinds[d.kind].title} · ไฟล์ {d.sourceName} · {d.rowCount} แถว · อัปโหลดโดย {d.createdBy} เมื่อ {thaiDateTime(d.createdAt)} น.</p>
    <p><span className="status-badge">{statusLabels[d.status] ?? d.status}</span>{d.committedAt ? ` นำเข้าเมื่อ ${thaiDateTime(d.committedAt)} น.` : ""}{d.rejectionReason ? ` เหตุผล: ${d.rejectionReason}` : ""}</p>
    {existing && <p className="form-success" role="status">ไฟล์นี้เคยอัปโหลดในชุดเอกสารเดียวกันแล้ว ระบบเปิดชุดเดิมให้ ไม่มีการสร้างข้อมูลซ้ำ</p>}
    <p className="muted small">ลายนิ้วมือไฟล์ (SHA-256): {d.sourceHash.slice(0, 16)}… ข้อมูลต้นทางทุกแถวถูกเก็บไว้และแก้ไขไม่ได้</p>
    <ImportReview d={d} fields={importKinds[d.kind].fields.map((f) => ({ name: f.name, label: f.label, required: !!f.required }))} />
  </>;
}
