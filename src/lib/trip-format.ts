/** Thai display helpers shared by server pages and client components. */
export const tripKindLabels: Record<string, string> = {
  BRANCH_DELIVERY: "ส่งสินค้าสาขา", INBOUND_DC: "รับสินค้าเข้าคลัง", VAN_SALES: "รถขายสินค้า", OTHER: "ประเภทอื่น ๆ",
};
export const destinationLabels: Record<string, string> = { BRANCH: "สาขา", DC: "ศูนย์กระจายสินค้า", FACTORY: "โรงงาน" };
export const timeBasisLabels = { departure: "เวลาออกรถ", loading: "เวลาเริ่มขึ้นของ" } as const;
export const UNKNOWN_TIME = "ยังไม่ระบุ";

const thaiDigits = (text: string) => text.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));
/** ISO Gregorian YYYY-MM-DD to DD/MM/YYYY Buddhist era. */
export const beDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${Number(iso.slice(0, 4)) + 543}`;
/** DD/MM/YYYY Buddhist era (Thai or Arabic digits) to ISO; null when invalid. */
export function isoFromBe(text: string): string | null {
  const m = thaiDigits(text.trim()).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m || Number(m[3]) < 2400) return null;
  const iso = `${Number(m[3]) - 543}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
export function shiftDate(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
/** Long Thai date with weekday and explicit พ.ศ., e.g. วันพุธที่ 1 มีนาคม พ.ศ. 2571. */
export function thaiLongDate(iso: string) {
  const date = new Date(`${iso}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric", era: "short" }).format(date);
}
export function thaiDateTime(isoInstant: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(isoInstant));
}
export const roundLabel = (roundNo: number | null) => roundNo === null ? "ไม่กำหนดรอบ" : `รอบ ${roundNo}`;
/** Only redirect to same-site relative paths after login. */
export const safeNext = (value: unknown) => typeof value === "string" && /^\/(?!\/)[^\\\s]*$/.test(value) ? value : null;
