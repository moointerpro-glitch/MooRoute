import qrcode from "qrcode-generator";

export const LABEL_FORMATS = { A4_4UP: "A4 4 ดวงต่อแผ่น", STICKER_100X150: "สติกเกอร์ 100 × 150 มม." } as const;
export type LabelFormat = keyof typeof LABEL_FORMATS;
/** Longer addresses would overflow the 100 × 150 mm label; essential text is never shrunk to fit. */
export const MAX_ADDRESS_CHARACTERS = 300;

export interface LabelPayload {
  schemaVersion: 1; consignmentCode: string; number: number; issuedAt: string; issuedBy: string;
  packages: { id: string; sequence: number; total: number; label: string }[];
  recipient: { branchCode: string | null; branchName: string | null; addressLine: string | null; subdistrict: string | null; district: string | null; province: string | null; postalCode: string | null; contactName: string | null; contactPhone: string | null };
  sender: { warehouseName: string | null; warehouseCode: string | null; department: string | null; contactName: string | null; contactPhone: string | null };
  transport: { tripCode: string | null; serviceDate: string | null; roundNo: number | null; plate: string | null; province: string | null; departureAt: string | null };
  /** Opaque authenticated lookup path. Never contains names, addresses or phone numbers. */
  lookupPath: string;
}

const blank = (v: unknown) => typeof v !== "string" || v.trim().length === 0;
/** Mandatory fields for a production label. A label that fails this can only be previewed as ตัวอย่าง. */
export function labelProblems(p: Pick<LabelPayload, "recipient" | "sender" | "transport" | "packages">) {
  const problems: string[] = [], r = p.recipient;
  if (blank(r.branchCode) || blank(r.branchName)) problems.push("ไม่มีรหัสหรือชื่อสาขาปลายทาง");
  if (blank(r.addressLine)) problems.push("ไม่มีที่อยู่ (บ้านเลขที่ อาคาร ถนน)");
  if (blank(r.subdistrict)) problems.push("ไม่มีตำบล/แขวง");
  if (blank(r.district)) problems.push("ไม่มีอำเภอ/เขต");
  if (blank(r.province)) problems.push("ไม่มีจังหวัด");
  if (!/^[1-9]\d{4}$/.test(r.postalCode ?? "")) problems.push("รหัสไปรษณีย์ไม่ถูกต้อง (ต้องเป็นเลข ๕ หลักและไม่ขึ้นต้นด้วย ๐)");
  if (blank(r.contactName)) problems.push("ไม่มีชื่อผู้รับ");
  if (blank(r.contactPhone)) problems.push("ไม่มีเบอร์ติดต่อผู้รับ");
  if (blank(p.sender.warehouseName)) problems.push("ไม่มีคลังต้นทาง");
  if (blank(p.transport.tripCode) || blank(p.transport.serviceDate)) problems.push("ไม่มีรอบรถหรือวันที่ให้บริการ");
  if (blank(p.transport.plate)) problems.push("ไม่มีทะเบียนรถ");
  if (!p.packages.length) problems.push("ไม่มีหีบห่อ");
  const address = [r.addressLine, r.subdistrict, r.district, r.province].filter(Boolean).join(" ");
  if (address.length > MAX_ADDRESS_CHARACTERS) problems.push(`ที่อยู่ยาวเกิน ${MAX_ADDRESS_CHARACTERS} ตัวอักษร จะล้นพื้นที่ฉลาก กรุณาปรับที่อยู่ในข้อมูลสาขา`);
  return problems;
}

export const lookupPath = (token: string, sequence?: number) => `/l/${token}${sequence ? `?p=${sequence}` : ""}`;
/** Accepts a scanned lookup URL, a bare path or a bare token; returns null for anything else. */
export function parseLookup(text: string): { token: string; sequence: number | null } | null {
  const match = text.trim().match(/(?:^|\/l\/)([A-Za-z0-9_-]{24,64})(?:\?p=(\d{1,3}))?$/);
  return match ? { token: match[1], sequence: match[2] ? Number(match[2]) : null } : null;
}

/** QR modules as one SVG path. The encoded text is only the lookup URL. */
export function qrSvg(text: string) {
  const qr = qrcode(0, "M"); qr.addData(text); qr.make();
  const count = qr.getModuleCount(), quiet = 4, size = count + quiet * 2;
  let path = "";
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y, x)) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  return { size, path, count, isDark: (y: number, x: number) => qr.isDark(y, x) };
}
