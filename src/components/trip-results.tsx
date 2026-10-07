import Link from "next/link";
import { Clock3, MapPin, PackagePlus, Phone, Route, Truck } from "lucide-react";
import type { SearchRow } from "@/server/services/trip-search";
import { roundLabel, tripKindLabels, UNKNOWN_TIME } from "@/lib/trip-format";

type Props = { rows: SearchRow[]; branchId?: string | null; caption: string; canConsign?: boolean };

function detailHref(row: SearchRow, branchId?: string | null) {
  const matched = row.stops.find((s) => s.matched)?.branchId ?? branchId ?? null;
  return `/trips/${encodeURIComponent(row.tripId)}${matched ? `?branch=${encodeURIComponent(matched)}` : ""}`;
}
function categoriesOf(row: SearchRow) {
  const source = row.matchedSequences.length ? row.stops.filter((s) => s.matched) : row.stops;
  const map = new Map(source.flatMap((s) => s.categories).map((c) => [c.id, c.name]));
  return [...map.values()];
}
function TimeText({ value }: { value: SearchRow["departure"] }) {
  return value ? <time dateTime={value.at}>{value.label}</time> : <span className="time-unknown">{UNKNOWN_TIME}</span>;
}
function StopChain({ row }: { row: SearchRow }) {
  return <ol className="stop-chain" aria-label="จุดส่งตามลำดับ">
    {row.stops.map((s) => <li key={s.sequence} className={s.matched ? "stop-matched" : undefined}>
      {s.matched ? <mark>{s.name}<span className="sr-only"> (ตรงกับที่ค้นหา)</span></mark> : s.name}
    </li>)}
  </ol>;
}
function Contacts({ row }: { row: SearchRow }) {
  const visible = row.stops.filter((s) => s.matched && s.contact.visible && (s.contact.name || s.contact.phone));
  if (!visible.length) return null;
  return <p className="row-contact">{visible.map((s) => <span key={s.sequence}><Phone size={13} aria-hidden="true" />{s.contact.name ?? ""}{s.contact.phone ? <> · <a href={`tel:${s.contact.phone}`}>{s.contact.phone}</a></> : null}</span>)}</p>;
}
function Title({ row }: { row: SearchRow }) {
  return <span className="row-title"><Route size={16} aria-hidden="true" /><span>{row.routeName ?? row.code}</span>
    {row.kind !== "BRANCH_DELIVERY" && <span className="kind-badge">{tripKindLabels[row.kind]}</span>}</span>;
}
const statusTone: Record<SearchRow["status"]["code"], string> = { DEPARTED: "plan-published", DUE: "plan-draft", WAITING: "plan-neutral", UNKNOWN: "plan-neutral", CANCELLED: "plan-none" };
/** Departure status (D225): recorded departures say "รถออกแล้ว"; everything else is worded as the plan. */
export function DepartureChip({ status }: { status: SearchRow["status"] }) {
  return <span className="departure-status"><span className={`plan-chip ${statusTone[status.code]}`}>{status.text}</span><small>{status.detail}</small></span>;
}
function Vehicle({ row }: { row: SearchRow }) {
  return row.vehicle ? <span className="plate">{row.vehicle.plate}<small>{row.vehicle.province}</small></span> : <span className="time-unknown">{UNKNOWN_TIME}</span>;
}

/**
 * "ฝากของกับรอบนี้" straight from the list (D226). Offered only for a branch-delivery trip whose planned departure
 * is still ahead; the consignment page and the server check eligibility again. One destination (the searched
 * branch or the only stop) is a direct link; several stops open a short list to choose from.
 */
function ConsignAction({ row, branchId }: { row: SearchRow; branchId?: string | null }) {
  if (row.kind !== "BRANCH_DELIVERY" || row.status.code !== "WAITING") return null;
  const stops = row.stops.filter((s, n) => row.stops.findIndex((x) => x.branchId === s.branchId) === n), matched = stops.filter((s) => s.matched);
  const target = matched.length === 1 ? matched[0] : stops.length === 1 ? stops[0] : stops.find((s) => s.branchId === branchId);
  const href = (id: string) => `/consign?trip=${encodeURIComponent(row.tripId)}&branch=${encodeURIComponent(id)}`;
  if (target) return <Link className="consign-link" href={href(target.branchId)} aria-label={`ฝากของกับรอบ ${row.code} ไป ${target.name}`}><PackagePlus size={15} aria-hidden="true" />ฝากของกับรอบนี้</Link>;
  return <details className="consign-pick">
    <summary aria-label={`ฝากของกับรอบ ${row.code} เลือกสาขาปลายทาง`}><PackagePlus size={15} aria-hidden="true" />ฝากของกับรอบนี้</summary>
    <ul aria-label="เลือกสาขาปลายทาง">{stops.map((s) => <li key={s.branchId}><Link href={href(s.branchId)}>ไป {s.name}</Link></li>)}</ul>
  </details>;
}

/** One row per trip. The table is shown on wide screens and the same rows become cards on narrow screens. */
export function TripResults({ rows, branchId, caption, canConsign = false }: Props) {
  return <>
    <div className="results-table-wrap">
      <table className="results-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr><th scope="col">เส้นทาง</th><th scope="col">รอบ</th><th scope="col">เวลาเริ่มขึ้นของ</th><th scope="col">เวลาออกรถ</th><th scope="col">สถานะรถ</th><th scope="col">หมวดสินค้า</th><th scope="col">ทะเบียนรถ</th><th scope="col">ดำเนินการ</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.tripId}>
          <td><Title row={row} /><StopChain row={row} /><Contacts row={row} /></td>
          <td className="nowrap">{roundLabel(row.roundNo)}</td>
          <td className="nowrap"><TimeText value={row.loading} /></td>
          <td className="nowrap time-strong"><Clock3 size={15} aria-hidden="true" /><TimeText value={row.departure} /></td>
          <td><DepartureChip status={row.status} /></td>
          <td>{categoriesOf(row).join(", ") || "—"}</td>
          <td><Vehicle row={row} /></td>
          <td><div className="row-do"><Link className="detail-link" href={detailHref(row, branchId)} aria-label={`ดูรายละเอียดรอบรถ ${row.code}`}>รายละเอียด</Link>{canConsign && <ConsignAction row={row} branchId={branchId} />}</div></td>
        </tr>)}</tbody>
      </table>
    </div>
    <ul className="result-cards" aria-label={caption}>
      {rows.map((row) => <li key={row.tripId} className="result-card">
        <div className="result-card-head"><Title row={row} /><span className="round-pill">{roundLabel(row.roundNo)}</span></div>
        <StopChain row={row} />
        <dl className="card-facts">
          <div><dt><Clock3 size={14} aria-hidden="true" />เวลาออกรถ</dt><dd className="time-strong"><TimeText value={row.departure} /></dd></div>
          <div><dt>สถานะรถ</dt><dd><DepartureChip status={row.status} /></dd></div>
          <div><dt>เวลาเริ่มขึ้นของ</dt><dd><TimeText value={row.loading} /></dd></div>
          <div><dt><MapPin size={14} aria-hidden="true" />หมวดสินค้า</dt><dd>{categoriesOf(row).join(", ") || "—"}</dd></div>
          <div><dt><Truck size={14} aria-hidden="true" />ทะเบียนรถ</dt><dd><Vehicle row={row} /></dd></div>
        </dl>
        <Contacts row={row} />
        <div className="row-do card-do"><Link className="secondary-button card-detail" href={detailHref(row, branchId)} aria-label={`ดูรายละเอียดรอบรถ ${row.code}`}>ดูรายละเอียด</Link>{canConsign && <ConsignAction row={row} branchId={branchId} />}</div>
      </li>)}
    </ul>
  </>;
}
