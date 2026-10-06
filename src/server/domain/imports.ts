import { serviceDate } from "./planning";

export type ImportKind = "branches" | "vehicles" | "schedule";
export interface ImportField { name: string; label: string; required?: boolean; type?: "text" | "date" | "time" | "integer" | "decimal" | "list" | "weekdays"; max?: number; example: string }

/** Approved import fields only. Anything else in a source file is preserved as raw data but never applied. */
export const importKinds: Record<ImportKind, { title: string; description: string; capabilities: string[]; fields: ImportField[] }> = {
  branches: { title: "ข้อมูลสาขา", description: "รหัส ชื่อ ที่อยู่สำหรับพิมพ์ฉลาก ผู้ติดต่อ และชื่อเรียกอื่นของสาขา", capabilities: ["master.branches.write"], fields: [
    { name: "code", label: "รหัสสาขา", required: true, max: 64, example: "B001" },
    { name: "name", label: "ชื่อสาขาทางการ", required: true, max: 191, example: "สาขาตัวอย่าง" },
    { name: "destinationType", label: "ประเภทปลายทาง", example: "สาขา" },
    { name: "addressLine", label: "บ้านเลขที่ อาคาร ถนน", required: true, max: 500, example: "99/1 ถนนตัวอย่าง" },
    { name: "subdistrict", label: "ตำบล / แขวง", required: true, max: 100, example: "ตำบลตัวอย่าง" },
    { name: "district", label: "อำเภอ / เขต", required: true, max: 100, example: "อำเภอตัวอย่าง" },
    { name: "province", label: "จังหวัด", required: true, max: 100, example: "เชียงใหม่" },
    { name: "postalCode", label: "รหัสไปรษณีย์", required: true, max: 5, example: "50000" },
    { name: "contactName", label: "ชื่อผู้รับ / ผู้ติดต่อ", required: true, max: 191, example: "คุณตัวอย่าง" },
    { name: "contactPhone", label: "เบอร์ติดต่อ", required: true, max: 32, example: "053-000-000" },
    { name: "activeFrom", label: "เปิดให้บริการตั้งแต่", required: true, type: "date", example: "01/10/2569" },
    { name: "activeTo", label: "ให้บริการถึง", type: "date", example: "" },
    { name: "aliases", label: "ชื่อเรียกอื่น (คั่นด้วย |)", type: "list", max: 2000, example: "ชื่อย่อ|ชื่อเดิม" },
  ] },
  vehicles: { title: "ข้อมูลรถ", description: "ทะเบียน จังหวัด ประเภท และความจุของรถ", capabilities: ["master.vehicles.write"], fields: [
    { name: "plate", label: "ทะเบียนรถ", required: true, max: 32, example: "1กข1234" },
    { name: "province", label: "จังหวัดทะเบียน", required: true, max: 100, example: "เชียงใหม่" },
    { name: "typeCode", label: "รหัสประเภทรถ", required: true, max: 64, example: "TRUCK6" },
    { name: "storageCode", label: "รหัสสภาพการเก็บรักษา", required: true, max: 64, example: "CHILLED" },
    { name: "brand", label: "ยี่ห้อ", max: 100, example: "" },
    { name: "model", label: "รุ่น", max: 100, example: "" },
    { name: "color", label: "สี", max: 64, example: "ขาว" },
    { name: "wheelCount", label: "จำนวนล้อ", required: true, type: "integer", example: "6" },
    { name: "capacity", label: "ความจุ", type: "decimal", example: "3000" },
    { name: "capacityUnit", label: "หน่วยความจุ (KG/BOX/M3)", max: 8, example: "KG" },
  ] },
  schedule: { title: "ตารางเดินรถประจำ (แม่แบบ)", description: "หนึ่งแถวต่อหนึ่งจุดส่งของแม่แบบ แถวซ้ำจากหน้าหมวดสินค้าจะถูกรวมหมวด ไม่สร้างแม่แบบซ้ำ", capabilities: ["route.write", "template.write"], fields: [
    { name: "templateCode", label: "รหัสแม่แบบ", required: true, max: 64, example: "TPL-R1-01" },
    { name: "routeCode", label: "รหัสเส้นทาง", required: true, max: 64, example: "RT-01" },
    { name: "routeName", label: "ชื่อเส้นทาง", required: true, max: 191, example: "เส้นทางตัวอย่าง" },
    { name: "roundNo", label: "รอบ (1-3)", required: true, type: "integer", example: "1" },
    { name: "weekdays", label: "วันประจำสัปดาห์ (1=จันทร์ ... 7=อาทิตย์)", required: true, type: "weekdays", example: "1-7" },
    { name: "loadingTime", label: "เวลาเริ่มขึ้นของ", type: "time", example: "07:00" },
    { name: "departureTime", label: "เวลาออกรถ", type: "time", example: "" },
    { name: "arrivalTime", label: "เวลาถึงปลายทาง", type: "time", example: "" },
    { name: "vehiclePlate", label: "ทะเบียนรถ", max: 32, example: "" },
    { name: "vehicleProvince", label: "จังหวัดทะเบียน", max: 100, example: "" },
    { name: "stopSequence", label: "ลำดับจุดส่ง", required: true, type: "integer", example: "1" },
    { name: "branchCode", label: "รหัสสาขา", required: true, max: 64, example: "B001" },
    { name: "categories", label: "หมวดสินค้า (คั่นด้วย |)", type: "list", max: 500, example: "PORK|CHICKEN" },
    { name: "effectiveFrom", label: "เริ่มใช้ตั้งแต่", required: true, type: "date", example: "01/10/2569" },
    { name: "sourcePage", label: "หน้าเอกสารอ้างอิง", max: 32, example: "1" },
  ] },
};
export const isImportKind = (v: unknown): v is ImportKind => typeof v === "string" && Object.hasOwn(importKinds, v);

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/[\s*:()/|=…\-–.]/g, "");
/** Maps each approved field to a source column by matching the Thai label or the field name. */
export function autoMapping(kind: ImportKind, headers: string[]): Record<string, string | null> {
  return Object.fromEntries(importKinds[kind].fields.map((f) => {
    const wanted = [norm(f.label), norm(f.name), norm(f.label.replace(/\(.*\)/, ""))];
    return [f.name, headers.find((h) => wanted.includes(norm(h)) || wanted.includes(norm(h.replace(/\(.*\)/, "")))) ?? null];
  }));
}
export function validateMapping(kind: ImportKind, headers: string[], mapping: unknown) {
  const fields = importKinds[kind].fields, result: Record<string, string | null> = {};
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return null;
  for (const f of fields) {
    const v = (mapping as Record<string, unknown>)[f.name];
    if (v === null || v === undefined || v === "") { result[f.name] = null; continue; }
    if (typeof v !== "string" || !headers.includes(v)) return null;
    result[f.name] = v;
  }
  const used = Object.values(result).filter((v): v is string => v !== null);
  return new Set(used).size === used.length ? result : null;
}

const thaiDigits = (s: string) => s.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));
const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function parseDate(text: string): string | null {
  const t = thaiDigits(text);
  let value: string | null = null;
  const be = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) value = t;
  // Day/month/year is accepted only with a Buddhist-era year to avoid mixing calendars.
  else if (be && Number(be[3]) >= 2400) value = iso(Number(be[3]) - 543, Number(be[2]), Number(be[1]));
  // Excel stores dates as serial day numbers (1900 system).
  else if (/^\d{5}$/.test(t)) value = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86_400_000).toISOString().slice(0, 10);
  if (!value) return null;
  try { serviceDate(value); return value; } catch { return null; }
}
function parseTime(text: string): number | null {
  const t = thaiDigits(text).replace(/\s*น\.?$/, "");
  const m = t.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)(?::00)?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  // Excel time cells are day fractions.
  if (/^0?\.\d+$/.test(t)) { const minutes = Math.round(Number(t) * 1440); return minutes >= 0 && minutes < 1440 ? minutes : null; }
  return null;
}
function parseWeekdays(text: string): number[] | null {
  const t = thaiDigits(text).replace(/\s/g, "");
  if (t === "ทุกวัน") return [1, 2, 3, 4, 5, 6, 7];
  const days = new Set<number>();
  for (const part of t.split(",")) {
    const range = part.match(/^([1-7])-([1-7])$/), single = part.match(/^[1-7]$/);
    if (range && Number(range[1]) <= Number(range[2])) for (let d = Number(range[1]); d <= Number(range[2]); d++) days.add(d);
    else if (single) days.add(Number(part));
    else return null;
  }
  return days.size ? [...days].sort() : null;
}

export type ParsedValue = string | number | number[] | string[] | null;
/** Applies the column mapping to one raw row. Unknown values stay null; nothing is guessed. */
export function parseRow(kind: ImportKind, mapping: Record<string, string | null>, cells: Record<string, string>) {
  const values: Record<string, ParsedValue> = {}, errors: string[] = [];
  for (const f of importKinds[kind].fields) {
    const column = mapping[f.name], text = column ? (cells[column] ?? "").normalize("NFC").trim() : "";
    if (!text) { values[f.name] = null; if (f.required) errors.push(column ? `ไม่มีค่า “${f.label}”` : `ยังไม่ได้จับคู่คอลัมน์สำหรับ “${f.label}”`); continue; }
    if (f.max && text.length > f.max && f.type !== "list") { errors.push(`“${f.label}” ยาวเกิน ${f.max} ตัวอักษร`); values[f.name] = null; continue; }
    if (f.type === "date") { const v = parseDate(text); values[f.name] = v; if (!v) errors.push(`“${f.label}” ต้องเป็นวันที่แบบ วว/ดด/ปปปป (พ.ศ.) หรือ ปปปป-ดด-วว (ค.ศ.) — พบ “${text}”`); }
    else if (f.type === "time") { const v = parseTime(text); values[f.name] = v; if (v === null) errors.push(`“${f.label}” ต้องเป็นเวลาแบบ ชั่วโมง:นาที — พบ “${text}”`); }
    else if (f.type === "integer") { const t = thaiDigits(text); values[f.name] = /^\d{1,6}$/.test(t) ? Number(t) : null; if (values[f.name] === null) errors.push(`“${f.label}” ต้องเป็นจำนวนเต็ม — พบ “${text}”`); }
    else if (f.type === "decimal") { const t = thaiDigits(text).replace(/,/g, ""); values[f.name] = /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/.test(t) && Number(t) > 0 ? t : null; if (values[f.name] === null) errors.push(`“${f.label}” ต้องเป็นตัวเลขมากกว่าศูนย์ ทศนิยมไม่เกิน ๓ ตำแหน่ง — พบ “${text}”`); }
    else if (f.type === "weekdays") { const v = parseWeekdays(text); values[f.name] = v; if (!v) errors.push(`“${f.label}” ต้องเป็นเลข 1-7 เช่น 1-7 หรือ 1,3,5 — พบ “${text}”`); }
    else if (f.type === "list") values[f.name] = [...new Set(text.split(/[|,]/).map((v) => v.trim()).filter(Boolean))];
    else values[f.name] = text;
  }
  return { values, errors };
}
/** Header row only, so an example can never be imported by accident; examples are shown on screen. */
export const templateRows = (kind: ImportKind) => [importKinds[kind].fields.map((f) => f.label)];
