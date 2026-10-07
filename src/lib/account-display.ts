/**
 * D221 account types as people see them. Codes stay unchanged in the database; retired codes (DRIVER, SUPERVISOR)
 * are shown as the type that absorbed them. Wording only; the server decides access from capabilities and scope.
 */
export interface AccountType { code: string; name: string; does: string; scope: string }

/** Ordered from the narrowest to the widest type. */
export const ACCOUNT_TYPES: readonly AccountType[] = [
  { code: "REQUESTER", name: "พนักงานทั่วไป", does: "ค้นหารอบรถ ฝากของส่งรถ และติดตามรายการของแผนก", scope: "แผนกของตนเอง" },
  { code: "BRANCH_RECEIVER", name: "พนักงานสาขา", does: "รับของ แจ้งปัญหา และปิดงานของสาขาตนเอง", scope: "สาขาที่ประจำ" },
  { code: "WAREHOUSE", name: "คลังและรถขนส่ง", does: "รับของเข้าคลัง ขึ้นรถ ออกและพิมพ์ฉลาก ใบคุมรถ และบันทึกรถออก", scope: "คลังที่ประจำ หรือรถที่ตนเองขับ" },
  { code: "DISPATCHER", name: "ผู้วางแผนขนส่ง", does: "จัดทำและเผยแพร่แผนรถ จัดรถให้คำขอ แก้ไขปัญหาและการคืนของ นำเข้าตาราง", scope: "ทั้งบริษัท" },
  { code: "ADMINISTRATOR", name: "ผู้ดูแลระบบ", does: "ทำงานได้ทุกประเภท ดูแลบัญชีผู้ใช้ และข้อมูลหลักทั้งหมด", scope: "ทั้งบริษัท" },
];

/** Retired codes and the type that absorbed them (mirrors retiredRoles on the server). */
export const RETIRED_ROLE_TYPES: Record<string, string> = { DRIVER: "WAREHOUSE", SUPERVISOR: "DISPATCHER" };

export const ROLE_NAMES: Record<string, string> = Object.fromEntries([
  ...ACCOUNT_TYPES.map((t) => [t.code, t.name]),
  ...Object.entries(RETIRED_ROLE_TYPES).map(([code, into]) => [code, ACCOUNT_TYPES.find((t) => t.code === into)!.name]),
]);

/** One account type for the given role codes: retired codes are folded in and the widest type wins. */
export function accountTypeOf(codes: readonly string[]): AccountType | null {
  const rank = (code: string) => ACCOUNT_TYPES.findIndex((t) => t.code === (RETIRED_ROLE_TYPES[code] ?? code));
  const best = codes.map(rank).filter((i) => i >= 0).sort((a, b) => b - a)[0];
  return best === undefined ? null : ACCOUNT_TYPES[best];
}

const leadingVowels = /^[เแโใไ]/u;
/** One readable initial for the profile badge; Thai leading vowels are skipped ("เจ้าหน้าที่" → "จ้"). */
export function initialOf(name: string) {
  const text = name.trim();
  const clusters = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text)].map((s) => s.segment)
    : [...text];
  const first = clusters.find((c) => c.trim() && !leadingVowels.test(c) && !/^[()\[\]"'.]/.test(c));
  return (first ?? "?").toUpperCase();
}
