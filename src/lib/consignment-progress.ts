import { CLOSED_INCOMPLETE_LABEL, statusLabels, type ConsignmentState } from "../server/domain/consignment";

/**
 * D236: the path of one consignment from request to delivery, for the progress display on the detail page and
 * the "next step" text in lists. It only reads recorded facts (status and events); it never infers an event
 * that was not recorded. A step that was passed without its own record (for example a receipt corrected before
 * the departure was recorded) is shown as "skipped", not as done.
 */
export type StepKey = "submit" | "assign" | "warehouse" | "load" | "depart" | "receive" | "close";
export type StepState = "done" | "current" | "todo" | "skipped" | "unreached";
export interface ProgressStep { key: StepKey; label: string; state: StepState; at: string | null; actor: string | null; hint: string | null }
export interface ProgressEvent { kind: string; at: string; actor: string; payload?: Record<string, unknown> }
export interface ProgressInput {
  status: string; resumeStatus: string | null; events: ProgressEvent[];
  /** Pieces received by the branch and pieces in total; both zero before submission. */
  received: number; pieces: number;
  /** True when a piece or quantity was returned: a closed request was then not delivered in full. */
  incomplete: boolean;
}
export interface Progress {
  steps: ProgressStep[];
  /** Set when the request stopped before delivery: cancelled, not approved (before D236) or returned in full. */
  stopped: { label: string; at: string | null; actor: string | null; reason: string | null } | null;
  /** Set while an issue is open; the movement step stays where it was. */
  issue: { at: string | null; actor: string | null } | null;
  /** One short sentence for lists: what happens next and who does it. */
  next: string;
}

const STEPS: Array<{ key: StepKey; label: string; event: string; waiting: string }> = [
  { key: "submit", label: "ส่งคำขอ", event: "SUBMITTED", waiting: "รอผู้ฝากส่งคำขอ" },
  { key: "assign", label: "จัดรถ", event: "ASSIGNED", waiting: "รอผู้วางแผนขนส่งจัดรถ" },
  { key: "warehouse", label: "คลังรับของ", event: "WAREHOUSE_RECEIVED", waiting: "รอคลังต้นทางรับของจากผู้ฝาก" },
  { key: "load", label: "ขึ้นรถ", event: "LOADED", waiting: "รอคลังต้นทางนำของขึ้นรถ" },
  { key: "depart", label: "รถออก", event: "DEPARTED", waiting: "รอคลังต้นทางหรือคนขับบันทึกรถออก" },
  { key: "receive", label: "สาขารับของ", event: "RECEIPT", waiting: "รอสาขาปลายทางรับของ" },
  { key: "close", label: "จัดส่งสำเร็จ", event: "CLOSED", waiting: "รอสาขาหรือผู้วางแผนขนส่งยืนยันจัดส่งสำเร็จ" },
];
/** Index of the step a request is waiting at, by movement status. 7 means every step is done. */
const POSITION: Record<string, number> = { DRAFT: 0, PENDING_REVIEW: 1, ASSIGNED: 2, WAREHOUSE_RECEIVED: 3, LOADED: 4, IN_TRANSIT: 5, PARTIALLY_RECEIVED: 5, RECEIVED: 6, CLOSED: 7 };
const STOPPED: Record<string, { label: string; event: string }> = {
  CANCELLED: { label: "ยกเลิกแล้ว", event: "CANCELLED" }, REJECTED: { label: "ไม่อนุมัติ", event: "REJECTED" }, RETURNED: { label: "ส่งคืนทั้งหมด", event: "RETURNED" },
};

export function consignmentProgress(input: ProgressInput): Progress {
  // An address correction is recorded as an ASSIGNED event too; it is not the moment the trip was chosen.
  const last = (kind: string) => input.events.filter((e) => e.kind === kind && e.payload?.type !== "ADDRESS_CORRECTION").at(-1) ?? null;
  const recorded = STEPS.map((s) => last(s.event));
  const stop = STOPPED[input.status];
  // While an issue is open the movement state is kept in resumeStatus.
  const movement = input.status === "ISSUE" ? input.resumeStatus ?? "" : input.status;
  // A stopped request reached as far as its last recorded step.
  const position = stop ? recorded.reduce((n, e, i) => e ? i + 1 : n, 0) : POSITION[movement] ?? recorded.reduce((n, e, i) => e ? i + 1 : n, 0);
  const steps = STEPS.map((s, i): ProgressStep => {
    const event = recorded[i];
    // "สาขารับของ" is done only when every piece is in; one partial receipt keeps it current.
    const partial = s.key === "receive" && !stop && position === i && input.received > 0;
    const state: StepState = i < position ? (event ? "done" : "skipped") : stop ? "unreached" : i === position ? "current" : "todo";
    const label = s.key === "close" && input.status === "CLOSED" && input.incomplete ? CLOSED_INCOMPLETE_LABEL : s.label;
    const hint = state === "current" ? (partial ? `รับแล้ว ${input.received} จาก ${input.pieces} รอสาขาปลายทางรับส่วนที่เหลือ` : s.waiting)
      : state === "skipped" ? "ไม่มีบันทึกขั้นตอนนี้" : null;
    return { key: s.key, label, state, at: state === "done" || partial ? event?.at ?? null : null, actor: state === "done" || partial ? event?.actor ?? null : null, hint };
  });
  const stopEvent = stop ? last(stop.event) : null, issueEvent = input.status === "ISSUE" ? last("ISSUE") : null;
  const current = steps.find((s) => s.state === "current");
  const next = stop ? stop.label : input.status === "ISSUE" ? "พบปัญหา รอผู้วางแผนขนส่งตรวจและแก้ไข"
    : current ? current.hint ?? current.label : input.incomplete ? CLOSED_INCOMPLETE_LABEL : statusLabels[input.status as ConsignmentState] ?? input.status;
  return {
    steps, next,
    stopped: stop ? { label: stop.label, at: stopEvent?.at ?? null, actor: stopEvent?.actor ?? null, reason: typeof stopEvent?.payload?.reason === "string" ? stopEvent.payload.reason : null } : null,
    issue: input.status === "ISSUE" ? { at: issueEvent?.at ?? null, actor: issueEvent?.actor ?? null } : null,
  };
}

/** "Next step" for a list row, where only the status is known. */
export function nextStepText(status: string, incomplete = false) {
  return consignmentProgress({ status, resumeStatus: null, events: [], received: 0, pieces: 0, incomplete }).next;
}
/** Status text that tells a full delivery from a closed request with returns. */
export const statusDisplay = (status: string, incomplete = false) => status === "CLOSED" && incomplete ? CLOSED_INCOMPLETE_LABEL : statusLabels[status as ConsignmentState] ?? status;
