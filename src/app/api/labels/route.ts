import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { readWriteBody, safeFailure } from "@/server/http";
import { requireCondition } from "@/server/domain/errors";
import { issueLabel, recordPrint } from "@/server/services/labels";
import { correctAssignmentAddress } from "@/server/services/consignments";

type Handler = (db: ReturnType<typeof getDatabase>, actorId: string, key: string, input: never) => Promise<unknown>;
const actions: Record<string, Handler> = { issue: issueLabel, print: recordPrint, correctAddress: correctAssignmentAddress };
export async function POST(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers), body = await readWriteBody(request);
    requireCondition(body && typeof body === "object" && typeof body.action === "string" && Object.hasOwn(actions, body.action) && body.input && typeof body.input === "object", "INVALID_INPUT", "การดำเนินการไม่ถูกต้อง");
    return Response.json(await actions[body.action](getDatabase(), actor.id, request.headers.get("Idempotency-Key") ?? "", body.input as never), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
