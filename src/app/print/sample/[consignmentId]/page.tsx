import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { authConfiguration } from "@/server/auth/config";
import { labelOverview } from "@/server/services/labels";
import { DomainError } from "@/server/domain/errors";
import { LABEL_FORMATS, type LabelFormat } from "@/server/domain/labels";
import { LabelSheets, pageRule } from "@/components/label-sheet";
import { PrintToolbar } from "@/components/print-toolbar";

export const dynamic = "force-dynamic";
export const metadata = { title: "ตัวอย่างฉลาก" };

/** Sample preview: watermarked ตัวอย่าง, no QR token, no label version and no print record. */
export default async function SampleLabelsPage({ params, searchParams }: { params: Promise<{ consignmentId: string }>; searchParams: Promise<{ format?: string }> }) {
  const actor = await requirePageActor(), { consignmentId } = await params, raw = (await searchParams).format;
  const format: LabelFormat = raw === "STICKER_100X150" ? "STICKER_100X150" : "A4_4UP";
  let overview;
  try { overview = await labelOverview(getDatabase(), actor.id, consignmentId); }
  catch (error) { if (error instanceof DomainError && ["NOT_FOUND", "FORBIDDEN"].includes(error.code)) notFound(); throw error; }
  if (!overview.sample) notFound();
  return <div className="print-page">
    <style>{pageRule(format)}</style>
    <div className="container no-print"><p className="eyebrow"><span />ตัวอย่างฉลาก</p><h1>{overview.consignment.code} · ตัวอย่าง (ยังไม่ใช่ฉลากจริง)</h1>
      {overview.problems.length > 0 && <ul className="problem-list" aria-label="ข้อมูลที่ยังขาด">{overview.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      <PrintToolbar format={format} printed={0} back={{ href: `/consignments/${consignmentId}/labels`, label: "กลับไปหน้าฉลาก" }}
        formats={(Object.keys(LABEL_FORMATS) as LabelFormat[]).map((value) => ({ value, label: LABEL_FORMATS[value], href: `/print/sample/${consignmentId}?format=${value}` }))} /></div>
    <LabelSheets payload={overview.sample} format={format} baseUrl={authConfiguration(process.env).baseURL} sample />
  </div>;
}
