import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { tripManifest } from "@/server/services/labels";
import { DomainError } from "@/server/domain/errors";
import { PrintToolbar } from "@/components/print-toolbar";
import { statusText, unitText } from "@/lib/consignment-format";
import { beDate, roundLabel, thaiDateTime, UNKNOWN_TIME } from "@/lib/trip-format";
import banner from "@/assets/brand/moointer-mooroute-banner.png";

export const dynamic = "force-dynamic";
export const metadata = { title: "ใบคุมรถ" };
const clock = (iso: string | null) => iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)) + " น." : UNKNOWN_TIME;

export default async function ManifestPage({ params }: { params: Promise<{ tripId: string }> }) {
  const actor = await requirePageActor(), { tripId } = await params;
  let m;
  try { m = await tripManifest(getDatabase(), actor.id, tripId); }
  catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    if (error instanceof DomainError && error.code === "FORBIDDEN") return <div className="container message-page"><span className="eyebrow">ใบคุมรถ</span><h1>คุณไม่มีสิทธิ์ดูใบคุมรถ</h1><p>ใบคุมรถเปิดได้เฉพาะผู้วางแผนขนส่ง คลังต้นทาง และคนขับของรอบนั้น</p></div>;
    throw error;
  }
  return <div className="print-page">
    <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>
    <div className="container no-print"><PrintToolbar format="MANIFEST" printed={0} formats={[]} back={{ href: `/trips/${encodeURIComponent(m.tripId)}`, label: "กลับไปรายละเอียดรอบรถ" }} /></div>
    <div className="print-scroll" role="region" aria-label="ใบคุมรถขนาด A4 เลื่อนแนวนอนได้" tabIndex={0}><article className="manifest">
      <header className="manifest-head">
        {/* Original-size PNG (no resizing service) and eager loading so the logo is present when printing starts. */}
        <div><Image src={banner} alt="หมูอินเตอร์ | MOOROUTE" unoptimized loading="eager" className="manifest-logo" /><h1>ใบคุมรถฝากของส่งสาขา</h1><p>หมูอินเตอร์ · {m.routeName ?? m.code}</p></div>
        <dl>
          <div><dt>รอบรถ</dt><dd>{m.code}</dd></div><div><dt>วันที่ให้บริการ</dt><dd>{beDate(m.serviceDate)} (พ.ศ.) · {roundLabel(m.roundNo)}</dd></div>
          <div><dt>เวลาเริ่มขึ้นของ / ออกรถ</dt><dd>{clock(m.loadingAt)} / {clock(m.departureAt)}</dd></div>
          <div><dt>ทะเบียนรถ</dt><dd>{m.vehicle ? `${m.vehicle.plate} ${m.vehicle.province} (${m.vehicle.typeName})` : UNKNOWN_TIME}</dd></div>
          <div><dt>พนักงานขับรถ</dt><dd>{m.driverName ?? "…………………………"}</dd></div>
        </dl>
      </header>
      {m.cancelled && <p className="manifest-alert">รอบรถนี้ถูกยกเลิก ห้ามใช้ใบคุมรถนี้</p>}
      {m.partial && <p className="manifest-note">แสดงเฉพาะรายการจากคลังในขอบเขตงานของผู้พิมพ์</p>}
      {m.groups.length === 0 ? <p className="manifest-note">ไม่มีรายการฝากส่งในรอบนี้</p> : m.groups.map((g) => <section key={g.sequence} className="manifest-group">
        <h2>จุดส่งที่ {g.sequence}: {g.name} ({g.branchCode})</h2>
        <table><caption className="sr-only">รายการฝากส่งถึง {g.name}</caption>
          <thead><tr><th scope="col">เลขที่ฝากส่ง</th><th scope="col">คลังต้นทาง</th><th scope="col">สิ่งที่ฝากส่ง</th><th scope="col">จำนวน</th><th scope="col">ฉลาก</th><th scope="col">สถานะ</th></tr></thead>
          <tbody>{g.consignments.map((c) => <tr key={c.id}><td>{c.code}</td><td>{c.warehouse}</td><td>{[c.packaging, [...c.contents, ...c.items.map((i) => `${i.name} ${Number(i.quantity).toLocaleString("th-TH")} ${unitText(i.unit)}`)].join(", ")].filter(Boolean).join(" — ")}</td><td>{c.packages}</td><td>{c.labelNumber ? `ฉบับที่ ${c.labelNumber}` : "ยังไม่ออก"}</td><td>{statusText(c.status)}</td></tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={2}>รวมจุดส่งนี้</th><td>{g.unitTotals.map((u) => `${Number(u.quantity).toLocaleString("th-TH")} ${unitText(u.unit)}`).join(" · ")}</td><td>{g.packageTotal}</td><td colSpan={2}>ผู้รับลงชื่อ …………………………… เวลา …………</td></tr></tfoot>
        </table>
      </section>)}
      <footer className="manifest-foot">
        <p>รวมทั้งรอบ: {m.consignmentTotal} ใบฝาก · {m.packageTotal} บรรจุภัณฑ์ (จำนวนสิ่งของรวมแยกตามหน่วย ไม่นำหน่วยต่างกันมารวมกัน)</p>
        <div className="signatures"><div><span />ผู้ส่งมอบ (คลัง)</div><div><span />พนักงานขับรถ</div><div><span />ผู้ตรวจสอบ</div></div>
        <p className="manifest-meta">พิมพ์โดย {m.generatedBy} · {thaiDateTime(new Date().toISOString())} น.</p>
      </footer>
    </article></div>
  </div>;
}
