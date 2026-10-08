import { isoFromBe } from "./trip-format";
import { itemUnits, statusLabels, type ConsignmentState } from "../server/domain/consignment";

export interface HistoryFilterValue { query: string; status: string[]; branchId: string | null; categoryId: string | null; date: string | null; tripCode: string | null; mine: boolean; page: number }
const id = (v: string | null) => v && /^[A-Za-z0-9_-]{1,36}$/.test(v) ? v : null;

/** Parses history filters from a query string; the service validates every value again. */
export function parseHistoryFilter(params: URLSearchParams): HistoryFilterValue {
  const rawDate = params.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : rawDate ? isoFromBe(rawDate) : null;
  return {
    query: (params.get("q") ?? "").normalize("NFC").trim().slice(0, 100),
    status: (params.get("status") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 13),
    branchId: id(params.get("branch")), categoryId: id(params.get("category")), date,
    tripCode: (params.get("trip") ?? "").trim().slice(0, 64) || null, mine: params.get("mine") === "1",
    page: Math.min(10_000, Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1)),
  };
}
/**
 * One row of "what is being sent" in the consignment form (D234): the sender types every field, so they stay
 * text until submitted. Kept in this shared module because both the server page and the client form use it.
 */
export type PackRow = { kind: string; customName: string; count: string; description: string; weight: string };
export const blankPackRow: PackRow = { kind: "", customName: "", count: "", description: "", weight: "" };
export const statusText = (s: string) => statusLabels[s as ConsignmentState] ?? s;
export const unitText = (u: string) => u === "PACKAGE" ? "ชิ้น" : itemUnits[u] ?? u;
export const statusTone = (s: string) => ["CLOSED", "RECEIVED"].includes(s) ? "tone-done" : ["CANCELLED", "REJECTED", "RETURNED"].includes(s) ? "tone-muted" : s === "ISSUE" ? "tone-alert" : s === "DRAFT" ? "tone-draft" : "tone-active";
