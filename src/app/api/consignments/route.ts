import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { readWriteBody, safeFailure } from "@/server/http";
import { requireCondition } from "@/server/domain/errors";
import { parseHistoryFilter } from "@/lib/consignment-format";
import {
  assignConsignment, cancelConsignment, closeConsignment, departTrip, listConsignments, loadConsignment, reassignConsignment, recordReturn,
  reportIssue, resolveIssue, saveConsignmentDraft, submitConsignment, warehouseReceiveConsignment,
} from "@/server/services/consignments";
import { receiveConsignment } from "@/server/services/receipts";

export async function GET(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers);
    return Response.json(await listConsignments(getDatabase(), actor.id, parseHistoryFilter(new URL(request.url).searchParams)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}

type Handler = (db: ReturnType<typeof getDatabase>, actorId: string, key: string, input: never) => Promise<unknown>;
// The action name only selects a service; every service re-authorizes the session actor itself.
const actions: Record<string, Handler> = {
  saveDraft: saveConsignmentDraft, submit: submitConsignment, cancel: cancelConsignment, assign: assignConsignment,
  reassign: reassignConsignment, warehouseReceive: warehouseReceiveConsignment, load: loadConsignment, depart: departTrip, receive: receiveConsignment,
  reportIssue, resolveIssue, recordReturn, close: closeConsignment,
};
export async function POST(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers), body = await readWriteBody(request, 100_000);
    requireCondition(body && typeof body === "object" && typeof body.action === "string" && Object.hasOwn(actions, body.action) && body.input && typeof body.input === "object", "INVALID_INPUT", "การดำเนินการไม่ถูกต้อง");
    const result = await actions[body.action](getDatabase(), actor.id, request.headers.get("Idempotency-Key") ?? "", body.input as never);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
