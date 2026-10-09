import type { LabelFormat, LabelPayload } from "@/server/domain/labels";
import { qrSvg } from "@/server/domain/labels";
import { beDate, roundLabel, thaiDateTime } from "@/lib/trip-format";

type Props = { payload: LabelPayload; format: LabelFormat; baseUrl: string; sample?: boolean };

function Label({ payload: p, item, baseUrl, sample }: { payload: LabelPayload; item: LabelPayload["packages"][number]; baseUrl: string; sample: boolean }) {
  // The QR carries only the authenticated lookup URL with an opaque token and the package sequence.
  const qr = sample ? null : qrSvg(`${baseUrl}${p.lookupPath}?p=${item.sequence}`);
  const r = p.recipient, t = p.transport;
  // D234: what this piece is packed in and who sent it. Both stay on one line so the label height never depends on them.
  const packed = [item.kind, item.description].filter(Boolean).join(" · ");
  const from = [p.sender.contactName, p.sender.contactPhone ? `โทร ${p.sender.contactPhone}` : null, p.sender.department].filter(Boolean).join(" · ");
  return <article className={sample ? "label label-sample" : "label"} data-package={item.sequence}>
    <header className="label-top"><div className="label-head"><span className="label-brand">หมูอินเตอร์ · ฝากของส่งสาขา</span>{packed && <span className="label-kind">{packed}</span>}</div><span className="label-count" aria-label={`ลำดับที่ ${item.sequence} จาก ${item.total}`}>{item.sequence}/{item.total}</span></header>
    {sample && <p className="label-watermark">ตัวอย่าง</p>}
    <section className="label-to">
      <span className="label-cap">ส่งถึง</span>
      <strong className="label-branch">{r.branchName ?? "ยังไม่มีชื่อสาขา"} <span>({r.branchCode ?? "—"})</span></strong>
      <p className="label-address">{[r.addressLine, r.subdistrict, r.district, r.province, r.postalCode].filter(Boolean).join(" ") || "ยังไม่มีที่อยู่"}</p>
      <p className="label-contact">ผู้รับ: {r.contactName ?? "ยังไม่ระบุ"} · โทร {r.contactPhone ?? "ยังไม่ระบุ"}</p>
    </section>
    {from && <p className="label-from">ผู้ฝาก: {from}</p>}
    <section className="label-meta">
      <dl>
        <div><dt>เลขที่ฝากส่ง</dt><dd>{p.consignmentCode}</dd></div>
        <div><dt>ต้นทาง</dt><dd>{p.sender.warehouseName ?? "—"}</dd></div>
        <div><dt>วันที่ส่ง</dt><dd>{t.serviceDate ? beDate(t.serviceDate) : "—"} · {roundLabel(t.roundNo)}</dd></div>
        <div><dt>รอบรถ</dt><dd>{t.tripCode ?? "—"}</dd></div>
        <div><dt>ทะเบียนรถ</dt><dd>{t.plate ? `${t.plate} ${t.province ?? ""}` : "—"}</dd></div>
      </dl>
      <div className="label-qr">
        {qr ? <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="คิวอาร์โค้ดสำหรับตรวจสอบฉลากในระบบ" shapeRendering="crispEdges"><rect width={qr.size} height={qr.size} fill="#fff" /><path d={qr.path} fill="#000" /></svg>
          : <span className="label-noqr">ไม่มีคิวอาร์<br />(ตัวอย่าง)</span>}
        <span className="label-version">{sample ? "ตัวอย่าง" : `ฉบับที่ ${p.number}`}</span>
      </div>
    </section>
    <footer className="label-foot">{item.label} · {sample ? "ตัวอย่าง ห้ามใช้ส่งจริง" : `ออกฉลาก ${thaiDateTime(p.issuedAt)} น.`}</footer>
  </article>;
}

/** Actual-size sheets in millimetres: A4 with four labels per page, or one 100 × 150 mm label per page. */
export function LabelSheets({ payload, format, baseUrl, sample = false }: Props) {
  const perSheet = format === "A4_4UP" ? 4 : 1, sheets: LabelPayload["packages"][] = [];
  for (let i = 0; i < payload.packages.length; i += perSheet) sheets.push(payload.packages.slice(i, i + perSheet));
  return <div className="print-scroll" role="region" aria-label="ตัวอย่างฉลากขนาดจริง เลื่อนแนวนอนได้" tabIndex={0}>
    <div className="print-area">{sheets.map((group, index) => <div key={index} className={format === "A4_4UP" ? "sheet sheet-a4" : "sheet sheet-sticker"}>
      {group.map((item) => <Label key={item.id} payload={payload} item={item} baseUrl={baseUrl} sample={sample} />)}
    </div>)}</div>
  </div>;
}
export const pageRule = (format: LabelFormat) => format === "A4_4UP" ? "@page { size: A4 portrait; margin: 0; }" : "@page { size: 100mm 150mm; margin: 0; }";
