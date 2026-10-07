import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { DomainError, requireCondition } from "../domain/errors";
import { missingCoverage, serviceDate } from "../domain/planning";
import { bangkokServiceDate } from "../../lib/bangkok-date";
import { DRAFT_AHEAD_DAYS, PUBLISH_AHEAD_DAYS, RANGE_MAX_DAYS, addDays, daysBetween } from "../../lib/planning-horizon";
import { authorize, type Transaction } from "./transaction";
import { candidateCoverage, publishPlan } from "./plans";
import { generateTrips, templateTripId, templatesInEffect } from "./planning-catalog";

/**
 * D225 multi-day planning: a status overview per service date, drafts for a range of dates generated from the
 * recurring templates, and publication of several dates at once. Each date is still its own plan and its own
 * transaction, checked by exactly the same rules as single-day work; a date that fails is reported, not skipped silently.
 */
export type DayStatus = "NONE" | "DRAFT" | "PUBLISHED" | "PUBLISHED_DRAFT";
const keyPattern = /^[A-Za-z0-9:_-]{1,80}$/, datePattern = /^\d{4}-\d{2}-\d{2}$/;
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

/**
 * A draft may be published together with other dates only when it is the first revision of its plan and every
 * trip in it is exactly a template-generated trip that was never edited by hand. Anything else needs a person to
 * open and confirm that date.
 */
async function templateOnlyDraft(tx: Transaction, revisionId: string, date: string) {
  const trips = await tx.tripRevision.findMany({ where: { planRevisionId: revisionId }, include: { templateRevision: { select: { templateId: true } } } });
  return trips.length > 0 && trips.every((t) => !t.cancelled && !!t.templateRevision && t.tripId === templateTripId(t.templateRevision.templateId, date));
}

type BlockerInput = { status: DayStatus; ahead: number; latestNumber: number; templateOnly: boolean; missing: number };
/** Why a date cannot be published together with others; empty when it can. One rule for the overview and for publishing. */
function bulkBlockerOf(x: BlockerInput) {
  if (x.status === "NONE") return "ยังไม่มีแผน";
  if (x.status === "PUBLISHED") return "เผยแพร่แล้ว";
  if (x.status === "PUBLISHED_DRAFT") return "มีร่างแก้ไขของแผนที่เผยแพร่แล้ว ต้องเปิดตรวจและเผยแพร่ทีละวัน";
  if (x.ahead < 0) return "วันที่ผ่านมาแล้ว ต้องเปิดตรวจและเผยแพร่ทีละวัน";
  if (x.ahead > PUBLISH_AHEAD_DAYS) return `เผยแพร่พร้อมกันได้ไม่เกิน ${PUBLISH_AHEAD_DAYS} วันล่วงหน้า`;
  if (x.latestNumber !== 1 || !x.templateOnly) return "มีการแก้ไขด้วยมือ ต้องเปิดตรวจและเผยแพร่ทีละวัน";
  if (x.missing) return `ยังขาด ${x.missing} ช่องส่งหมูและไก่`;
  return "";
}
const statusOf = (publishedRevisionId: string | null | undefined, latestId: string | undefined): DayStatus =>
  !latestId ? "NONE" : !publishedRevisionId ? "DRAFT" : latestId === publishedRevisionId ? "PUBLISHED" : "PUBLISHED_DRAFT";

/** One date, read fresh inside its own transaction just before it is published. */
async function dayState(tx: Transaction, date: string, today: string) {
  const plan = await tx.dailyPlan.findUnique({ where: { serviceDate: utc(date) } });
  const latest = plan ? await tx.planRevision.findFirst({ where: { planId: plan.id }, orderBy: { number: "desc" } }) : null;
  const status = statusOf(plan?.publishedRevisionId, latest?.id);
  const draft = status === "DRAFT";
  const bulkBlocker = bulkBlockerOf({ status, ahead: daysBetween(today, date), latestNumber: latest?.number ?? 0,
    templateOnly: draft ? await templateOnlyDraft(tx, latest!.id, date) : false, missing: draft ? (await candidateCoverage(tx, latest!.id)).missing.length : 0 });
  return { plan, latest, bulkBlocker };
}

/**
 * Status of each service date in a range. All dates are read with a few batched queries and coverage is computed in
 * memory with the same rule as publication, so the two-week strip costs one short transaction.
 */
export async function planningOverview(db: PrismaClient, actorId: string, fromValue: string, daysValue: number) {
  requireCondition(datePattern.test(fromValue) && Number.isInteger(daysValue) && daysValue >= 1 && daysValue <= RANGE_MAX_DAYS, "INVALID_INPUT", "ช่วงวันที่ไม่ถูกต้อง");
  serviceDate(fromValue);
  const today = bangkokServiceDate(), dates = Array.from({ length: daysValue }, (_, n) => addDays(fromValue, n)), week = Array.from({ length: 7 }, (_, n) => addDays(today, n));
  return db.$transaction(async (tx) => {
    await authorize(tx, actorId, "plan.read");
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const plans = await tx.dailyPlan.findMany({ where: { serviceDate: { in: [...new Set([...dates, ...week])].map(utc) } } });
    const revisions = await tx.planRevision.findMany({ where: { planId: { in: plans.map((p) => p.id) } }, select: { id: true, planId: true, number: true }, orderBy: { number: "desc" } });
    const branches = await tx.branch.findMany({ where: { destinationType: "BRANCH", archived: false }, select: { id: true, activeFrom: true, activeTo: true } });
    const planOf = new Map(plans.map((p) => [iso(p.serviceDate), p])), latestOf = new Map<string, { id: string; number: number }>();
    for (const r of revisions) if (!latestOf.has(r.planId)) latestOf.set(r.planId, r);
    // What people can rely on is the published revision; before publication the latest draft is shown.
    const shownOf = new Map(dates.flatMap((date) => { const p = planOf.get(date), id = p?.publishedRevisionId ?? (p ? latestOf.get(p.id)?.id : undefined); return id ? [[date, id] as const] : []; }));
    const trips = await tx.tripRevision.findMany({ where: { planRevisionId: { in: [...shownOf.values()] } },
      include: { templateRevision: { select: { templateId: true } }, tripStop_tripRevisionId: { include: { tripStopCategory_stopId: { include: { category: { select: { code: true, active: true } } } } } } } });
    const days = dates.map((date) => {
      const d = utc(date), plan = planOf.get(date), latest = plan ? latestOf.get(plan.id) : undefined, status = statusOf(plan?.publishedRevisionId, latest?.id);
      const shown = trips.filter((t) => t.planRevisionId === shownOf.get(date));
      const required = branches.filter((b) => b.activeFrom <= d && (!b.activeTo || b.activeTo >= d)).map((b) => b.id);
      const missing = status === "NONE" ? required.length * 6 : missingCoverage(required, shown.map((t) => ({ kind: t.kind, roundNo: t.roundNo, cancelled: t.cancelled,
        stops: t.tripStop_tripRevisionId.map((s) => ({ branchId: s.branchId, categoryCodes: s.tripStopCategory_stopId.filter((c) => c.category.active).map((c) => c.category.code) })) }))).length;
      const templateOnly = shown.length > 0 && shown.every((t) => !t.cancelled && !!t.templateRevision && t.tripId === templateTripId(t.templateRevision.templateId, date));
      const bulkBlocker = bulkBlockerOf({ status, ahead: daysBetween(today, date), latestNumber: latest?.number ?? 0, templateOnly, missing });
      return { date, status, required: required.length * 6, covered: required.length * 6 - missing, trips: shown.filter((t) => !t.cancelled).length, bulkPublishable: !bulkBlocker, bulkBlocker };
    });
    // Dates people will need first: the next seven days without a published plan.
    return { today, days, upcomingMissing: week.filter((date) => !planOf.get(date)?.publishedRevisionId), draftAheadDays: DRAFT_AHEAD_DAYS, publishAheadDays: PUBLISH_AHEAD_DAYS };
  }, { isolationLevel: "RepeatableRead", timeout: 20000 });
}
export type PlanningOverview = Awaited<ReturnType<typeof planningOverview>>;

export interface RangeInput { from: string; to: string; reason: string }
export interface RangeResult { date: string; outcome: "done" | "skipped" | "failed"; message: string }

function rangeDates(input: RangeInput, aheadLimit: number, limitText: string) {
  requireCondition(input && datePattern.test(String(input.from)) && datePattern.test(String(input.to)), "INVALID_INPUT", "กรุณาระบุวันที่เริ่มและวันที่สิ้นสุด");
  serviceDate(input.from); serviceDate(input.to);
  const today = bangkokServiceDate(), length = daysBetween(input.from, input.to) + 1;
  requireCondition(length >= 1 && length <= RANGE_MAX_DAYS, "INVALID_RANGE", `เลือกได้ครั้งละ ๑ ถึง ${RANGE_MAX_DAYS} วัน และวันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม`);
  requireCondition(daysBetween(today, input.from) >= 0, "PAST_DATE", "เครื่องมือหลายวันใช้กับวันนี้และวันข้างหน้าเท่านั้น วันที่ผ่านมาแล้วให้เปิดทำทีละวัน");
  requireCondition(daysBetween(today, input.to) <= aheadLimit, "BEYOND_HORIZON", limitText);
  requireCondition(typeof input.reason === "string" && input.reason.trim().length >= 3 && input.reason.length <= 500, "REASON_REQUIRED", "กรุณาระบุเหตุผลอย่างน้อย ๓ ตัวอักษร");
  return { today, dates: Array.from({ length }, (_, n) => addDays(input.from, n)) };
}
const failure = (error: unknown) => { if (error instanceof DomainError) return error.message; throw error; };

/** Creates a first draft from the templates for every date in the range that has no plan yet. Existing plans are never touched. */
export async function generatePlans(db: PrismaClient, actorId: string, key: string, input: RangeInput): Promise<{ results: RangeResult[] }> {
  requireCondition(typeof key === "string" && keyPattern.test(key), "INVALID_KEY", "รหัสคำขอไม่ถูกต้อง");
  const { dates } = rangeDates(input, DRAFT_AHEAD_DAYS, `สร้างร่างล่วงหน้าได้ไม่เกิน ${DRAFT_AHEAD_DAYS} วัน`);
  await db.$transaction((tx) => authorize(tx, actorId, "plan.write"));
  const results: RangeResult[] = [];
  for (const date of dates) {
    const state = await db.$transaction(async (tx) => ({ exists: !!(await tx.dailyPlan.findUnique({ where: { serviceDate: utc(date) } })), templates: await templatesInEffect(tx, utc(date)) }));
    if (state.exists) { results.push({ date, outcome: "skipped", message: "มีแผนอยู่แล้ว ไม่แก้ไข" }); continue; }
    if (!state.templates) { results.push({ date, outcome: "skipped", message: "ไม่มีแม่แบบที่มีผลในวันนี้" }); continue; }
    try {
      const made = await generateTrips(db, actorId, `${key}:${date}`, { serviceDate: date, expectedVersion: 0, reason: input.reason.trim() });
      results.push({ date, outcome: "done", message: `สร้างร่าง ${made.generated} เที่ยว` });
    } catch (error) { results.push({ date, outcome: "failed", message: failure(error) }); }
  }
  return { results };
}

/** Publishes every date in the range whose draft is untouched template output with full coverage; every publish rule still applies per date. */
export async function publishPlans(db: PrismaClient, actorId: string, key: string, input: RangeInput): Promise<{ results: RangeResult[] }> {
  requireCondition(typeof key === "string" && keyPattern.test(key), "INVALID_KEY", "รหัสคำขอไม่ถูกต้อง");
  const { today, dates } = rangeDates(input, PUBLISH_AHEAD_DAYS, `เผยแพร่พร้อมกันได้ไม่เกิน ${PUBLISH_AHEAD_DAYS} วันล่วงหน้า`);
  await db.$transaction((tx) => authorize(tx, actorId, "plan.publish"));
  const results: RangeResult[] = [];
  for (const date of dates) {
    const state = await db.$transaction((tx) => dayState(tx, date, today), { isolationLevel: "RepeatableRead" });
    if (state.bulkBlocker) { results.push({ date, outcome: "skipped", message: state.bulkBlocker }); continue; }
    try {
      await publishPlan(db, actorId, `${key}:${date}`, { revisionId: state.latest!.id, expectedVersion: state.plan!.version, reason: input.reason.trim() });
      results.push({ date, outcome: "done", message: "เผยแพร่แล้ว" });
    } catch (error) { results.push({ date, outcome: "failed", message: failure(error) }); }
  }
  return { results };
}
