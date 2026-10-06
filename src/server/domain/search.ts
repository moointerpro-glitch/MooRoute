import { DomainError, requireCondition } from "./errors";
import { serviceDate } from "./planning";

export const searchModes = ["branch", "time", "range"] as const;
export const timeBases = ["departure", "loading"] as const;
export const searchSorts = ["time_asc", "time_desc"] as const;
export const searchTripKinds = ["BRANCH_DELIVERY", "INBOUND_DC", "VAN_SALES", "OTHER"] as const;
export const SEARCH_PAGE_SIZE = 20;
/** Exact-time chips may sit on the neighbouring local day (loading before midnight, late departures). */
export const MIN_OFFSET = -1440, MAX_OFFSET = 2879;

export type SearchMode = typeof searchModes[number];
export type TimeBasis = typeof timeBases[number];
export type SearchSort = typeof searchSorts[number];
export type SearchTripKind = typeof searchTripKinds[number];
export interface SearchInput {
  serviceDate: string; mode: SearchMode; branchId: string | null; query: string;
  /** Minute offsets from 00:00 Asia/Bangkok of the service date; selected values combine with OR. */
  times: number[]; from: number | null; to: number | null; basis: TimeBasis;
  rounds: number[]; categoryIds: string[]; kinds: SearchTripKind[]; sort: SearchSort; page: number; pageSize: number;
}

const invalid = (message: string) => new DomainError("INVALID_SEARCH", message);
const idPattern = /^[A-Za-z0-9_-]{1,36}$/;
const thaiDigits = (text: string) => text.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));

export function normalizeQuery(text: string) {
  const value = thaiDigits(text.normalize("NFC")).replace(/\s+/g, " ").trim();
  if (value.length > 100) throw invalid("คำค้นหายาวเกิน ๑๐๐ ตัวอักษร");
  return value;
}
export function clockMinute(text: string): number {
  const match = thaiDigits(text.trim()).match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!match) throw invalid("กรุณาระบุเวลาเป็น ชั่วโมง:นาที เช่น 07:30");
  return Number(match[1]) * 60 + Number(match[2]);
}
export function offsetLabel(offset: number) {
  const day = Math.floor(offset / 1440), minute = offset - day * 1440;
  const clock = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  return day === 0 ? clock : `${clock} (${day < 0 ? "วันก่อนหน้า" : "วันถัดไป"})`;
}
/** UTC start of minute `offset` relative to local midnight of the Bangkok service date. */
export function offsetInstant(date: string, offset: number) {
  return new Date(serviceDate(date).valueOf() + (offset - 420) * 60_000);
}
/** Inverse of offsetInstant at minute granularity (seconds are truncated, never rounded up). */
export function instantOffset(date: string, instant: Date) {
  return Math.floor((instant.valueOf() - offsetInstant(date, 0).valueOf()) / 60_000);
}

function list(value: string | null, max: number, message: string) {
  if (!value) return [];
  const items = [...new Set(value.split(",").map((v) => v.trim()).filter(Boolean))];
  if (items.length > max) throw invalid(message);
  return items;
}
function choice<T extends string>(value: string | null, options: readonly T[], fallback: T, message: string): T {
  if (value === null || value === "") return fallback;
  if (!(options as readonly string[]).includes(value)) throw invalid(message);
  return value as T;
}

/** Parses the public query-string contract. Every value is validated again by the service. */
export function parseSearchInput(params: URLSearchParams, today: string): SearchInput {
  const date = params.get("date") || today;
  try { serviceDate(date); } catch { throw invalid("วันที่ให้บริการไม่ถูกต้อง"); }
  const mode = choice(params.get("mode"), searchModes, "branch", "รูปแบบการค้นหาไม่ถูกต้อง");
  const branchId = params.get("branch") || null;
  if (branchId !== null && !idPattern.test(branchId)) throw invalid("รหัสสาขาไม่ถูกต้อง");
  const times = list(params.get("times"), 48, "เลือกเวลาได้ไม่เกิน ๔๘ เวลา").map((v) => {
    const n = Number(v);
    if (!/^-?\d+$/.test(v) || n < MIN_OFFSET || n > MAX_OFFSET) throw invalid("เวลาที่เลือกไม่ถูกต้อง");
    return n;
  }).sort((a, b) => a - b);
  const from = params.get("from") ? clockMinute(params.get("from")!) : null;
  const to = params.get("to") ? clockMinute(params.get("to")!) : null;
  const rounds = list(params.get("rounds"), 3, "รอบไม่ถูกต้อง").map((v) => {
    if (!["1", "2", "3"].includes(v)) throw invalid("รอบต้องเป็นรอบที่ ๑ ถึง ๓");
    return Number(v);
  }).sort();
  const categoryIds = list(params.get("categories"), 20, "เลือกหมวดสินค้าได้ไม่เกิน ๒๐ หมวด");
  if (!categoryIds.every((id) => idPattern.test(id))) throw invalid("หมวดสินค้าไม่ถูกต้อง");
  const kindValues = list(params.get("kinds"), searchTripKinds.length, "ประเภทรอบรถไม่ถูกต้อง");
  if (!kindValues.every((k) => (searchTripKinds as readonly string[]).includes(k))) throw invalid("ประเภทรอบรถไม่ถูกต้อง");
  const page = params.get("page") ? Number(params.get("page")) : 1;
  if (!Number.isInteger(page) || page < 1 || page > 10_000) throw invalid("หมายเลขหน้าไม่ถูกต้อง");
  return validateSearchInput({
    serviceDate: date, mode, branchId, query: normalizeQuery(params.get("q") ?? ""), times, from, to,
    basis: choice(params.get("basis"), timeBases, "departure", "ประเภทเวลาไม่ถูกต้อง"),
    rounds, categoryIds, kinds: (kindValues.length ? kindValues : ["BRANCH_DELIVERY"]) as SearchTripKind[],
    sort: choice(params.get("sort"), searchSorts, "time_asc", "การเรียงลำดับไม่ถูกต้อง"), page, pageSize: SEARCH_PAGE_SIZE,
  });
}

export function validateSearchInput(input: SearchInput): SearchInput {
  requireCondition(input && typeof input === "object", "INVALID_SEARCH", "เงื่อนไขการค้นหาไม่ถูกต้อง");
  try { serviceDate(input.serviceDate); } catch { throw invalid("วันที่ให้บริการไม่ถูกต้อง"); }
  requireCondition(searchModes.includes(input.mode) && timeBases.includes(input.basis) && searchSorts.includes(input.sort), "INVALID_SEARCH", "เงื่อนไขการค้นหาไม่ถูกต้อง");
  requireCondition(input.branchId === null || idPattern.test(input.branchId), "INVALID_SEARCH", "รหัสสาขาไม่ถูกต้อง");
  requireCondition(typeof input.query === "string" && input.query.length <= 100, "INVALID_SEARCH", "คำค้นหายาวเกิน ๑๐๐ ตัวอักษร");
  requireCondition(Array.isArray(input.times) && input.times.length <= 48 && input.times.every((t) => Number.isInteger(t) && t >= MIN_OFFSET && t <= MAX_OFFSET), "INVALID_SEARCH", "เวลาที่เลือกไม่ถูกต้อง");
  for (const value of [input.from, input.to]) requireCondition(value === null || (Number.isInteger(value) && value >= 0 && value < 1440), "INVALID_SEARCH", "ช่วงเวลาไม่ถูกต้อง");
  if (input.mode === "range") {
    requireCondition((input.from === null) === (input.to === null), "INVALID_RANGE", "กรุณาเลือกทั้งเวลาเริ่มต้นและเวลาสิ้นสุด");
    // This release rejects reversed ranges instead of guessing a next-day window (D201).
    requireCondition(input.from === null || input.to! >= input.from, "INVALID_RANGE", "เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่มต้น");
  }
  requireCondition(Array.isArray(input.rounds) && input.rounds.every((r) => [1, 2, 3].includes(r)), "INVALID_SEARCH", "รอบต้องเป็นรอบที่ ๑ ถึง ๓");
  requireCondition(Array.isArray(input.categoryIds) && input.categoryIds.length <= 20 && input.categoryIds.every((id) => idPattern.test(id)), "INVALID_SEARCH", "หมวดสินค้าไม่ถูกต้อง");
  requireCondition(Array.isArray(input.kinds) && input.kinds.length > 0 && input.kinds.every((k) => searchTripKinds.includes(k)), "INVALID_SEARCH", "ประเภทรอบรถไม่ถูกต้อง");
  requireCondition(Number.isInteger(input.page) && input.page >= 1 && input.page <= 10_000 && Number.isInteger(input.pageSize) && input.pageSize >= 1 && input.pageSize <= 50, "INVALID_SEARCH", "หมายเลขหน้าไม่ถูกต้อง");
  return input;
}

/** Same-stop rule shared with the SQL predicate: branch and category must be satisfied by one stop. */
export function stopMatches(stop: { branchId: string; categoryIds: string[] }, branchIds: string[], categoryIds: string[]) {
  if (!branchIds.length && !categoryIds.length) return false;
  return (!branchIds.length || branchIds.includes(stop.branchId)) && (!categoryIds.length || categoryIds.some((id) => stop.categoryIds.includes(id)));
}
