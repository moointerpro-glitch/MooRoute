/**
 * Pure helpers for the Thai date (วว/ดด/ปปปป, Buddhist era) and 24-hour time (ชช:นน) inputs.
 * They only shape and read text; the submitted formats are unchanged, so every existing parser keeps working.
 */
const thaiDigitsToArabic = (text: string) => text.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));

export const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
export const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

/** ISO YYYY-MM-DD to DD/MM/YYYY in the Buddhist era. */
export const formatBeDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${Number(iso.slice(0, 4)) + 543}`;

const validIso = (year: number, month: number, day: number) => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === iso ? iso : null;
};

/**
 * Reads a typed date: DD/MM/YYYY (พ.ศ.), D/M/YYYY, DD/MM/YY (taken as 25YY พ.ศ.), DDMMYYYY, Thai digits,
 * or a pasted ISO date. Returns ISO YYYY-MM-DD or null. Buddhist years must fall in 2400–3500.
 */
export function parseThaiDate(text: string): string | null {
  const t = thaiDigitsToArabic(text.trim());
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return validIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const m = t.match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2}|\d{4})$/) ?? t.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const be = m[3].length === 2 ? 2500 + Number(m[3]) : Number(m[3]);
  if (be < 2400 || be > 3500) return null;
  return validIso(be - 543, Number(m[2]), Number(m[1]));
}

/**
 * Shapes text while typing. Digits only: slashes are inserted after the day and month once the next digit
 * arrives (never right after the second digit, so Backspace is not trapped). Typed separators are kept and
 * the part before them is zero-padded ("1/3/" becomes "01/03/").
 */
export function maskDateText(raw: string): string {
  const t = thaiDigitsToArabic(raw).replace(/[.\- ]/g, "/").replace(/[^\d/]/g, "");
  // Character by character: a full day or month spills the next digit into the following part.
  const parts = [""], limit = [2, 2, 4];
  for (const ch of t) {
    let i = parts.length - 1;
    if (ch === "/") {
      if (parts[i] !== "" && i < 2) { parts[i] = parts[i].padStart(2, "0"); parts.push(""); }
      continue;
    }
    if (parts[i].length === limit[i]) { if (i === 2) continue; parts.push(""); i++; }
    parts[i] += ch;
  }
  return parts.join("/");
}

/** Canonical text after leaving the field: valid dates become DD/MM/YYYY พ.ศ.; anything else is kept for correction. */
export function normalizeDateText(text: string): string {
  const iso = parseThaiDate(text);
  return iso ? formatBeDate(iso) : text.trim();
}

/** Reads HH:MM, H:MM, H.MM, HHMM, HMM, H or HH (24-hour, Thai digits allowed). Returns "HH:MM" or null. */
export function parseTime(text: string): string | null {
  const t = thaiDigitsToArabic(text.trim()).replace(/\s*น\.?$/, "");
  const m = t.match(/^(\d{1,2})[:.](\d{2})$/) ?? t.match(/^(\d{1,2})(\d{2})$/) ?? t.match(/^(\d{1,2})$/);
  if (!m) return null;
  const hour = Number(m[1]), minute = Number(m[2] ?? "0");
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Keep three digits editable (830 -> 08:30 on blur); insert a colon once all four HHMM digits arrive. */
export function maskTimeText(raw: string): string {
  const t = thaiDigitsToArabic(raw).replace(/\./g, ":").replace(/[^\d:]/g, "");
  if (t.includes(":")) {
    const [hour, minute = ""] = t.split(":");
    return `${hour.slice(0, 2)}:${minute.slice(0, 2)}`;
  }
  const digits = t.slice(0, 4);
  return digits.length < 4 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function normalizeTimeText(text: string): string {
  return parseTime(text) ?? text.trim();
}

/** Six-week month grid (Sunday first, as in Thai calendars) of ISO dates for the calendar popover. */
export function monthGrid(year: number, month: number): string[][] {
  const first = Date.UTC(year, month - 1, 1), start = first - new Date(first).getUTCDay() * 86_400_000;
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => new Date(start + (week * 7 + day) * 86_400_000).toISOString().slice(0, 10)));
}
export function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
/** Same day in another month, clamped to that month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number) {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + months, d = Number(iso.slice(8, 10));
  const target = new Date(Date.UTC(y, m, 1)), last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}
/** Today in Bangkok as ISO, independent of the device time zone. */
export const bangkokToday = (now = new Date()) => new Date(now.valueOf() + 7 * 3_600_000).toISOString().slice(0, 10);
/** Full spoken form for screen readers and hints, e.g. "วันอังคารที่ 6 ตุลาคม พ.ศ. 2569". */
export function thaiDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `วัน${THAI_WEEKDAYS[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} พ.ศ. ${d.getUTCFullYear() + 543}`;
}
