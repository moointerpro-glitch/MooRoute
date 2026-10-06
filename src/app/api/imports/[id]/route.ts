import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { readWriteBody, safeFailure } from "@/server/http";
import { requireCondition } from "@/server/domain/errors";
import { commitImport, decideImportRows, importBatchDetail, rejectImport, remapImport } from "@/server/services/imports";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await actorFromHeaders(request.headers), { id } = await params;
    return Response.json(await importBatchDetail(getDatabase(), actor.id, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
type Handler = (db: ReturnType<typeof getDatabase>, actorId: string, key: string, input: never) => Promise<unknown>;
const actions: Record<string, Handler> = { remap: remapImport, decide: decideImportRows, commit: commitImport, reject: rejectImport };
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await actorFromHeaders(request.headers), body = await readWriteBody(request, 100_000), { id } = await params;
    requireCondition(body && typeof body === "object" && typeof body.action === "string" && Object.hasOwn(actions, body.action) && body.input && typeof body.input === "object", "INVALID_INPUT", "การดำเนินการไม่ถูกต้อง");
    // The batch comes from the path, never from the body.
    return Response.json(await actions[body.action](getDatabase(), actor.id, request.headers.get("Idempotency-Key") ?? "", { ...body.input, batchId: id } as never), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
