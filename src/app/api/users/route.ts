import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { readWriteBody, safeFailure } from "@/server/http";
import { DomainError, requireCondition } from "@/server/domain/errors";
import { createUser, listUsers, resetUserPassword, setUserActive, updateUser } from "@/server/services/users";

const noStore = { "Cache-Control": "no-store" };

/** Administrator user management (D223). Every action re-checks identity.manage and company scope on the server. */
export async function GET(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers), url = new URL(request.url);
    return Response.json(await listUsers(getDatabase(), actor.id, { q: url.searchParams.get("q") ?? "", type: url.searchParams.get("type") ?? "", status: url.searchParams.get("status") ?? "active", page: Number(url.searchParams.get("page") ?? 1) }), { headers: noStore });
  } catch (error) { return safeFailure(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers), body = await readWriteBody(request, 4000), db = getDatabase();
    const key = request.headers.get("Idempotency-Key") ?? "";
    requireCondition(body && typeof body === "object" && body.input && typeof body.input === "object", "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
    const run = {
      create: () => createUser(db, actor.id, key, body.input),
      update: () => updateUser(db, actor.id, key, body.input),
      deactivate: () => setUserActive(db, actor.id, key, { ...body.input, active: false }),
      reactivate: () => setUserActive(db, actor.id, key, { ...body.input, active: true }),
      resetPassword: () => resetUserPassword(db, actor.id, key, body.input),
    }[body.action as string];
    if (!run) throw new DomainError("INVALID_INPUT", "การดำเนินการไม่ถูกต้อง");
    return Response.json(await run(), { headers: noStore });
  } catch (error) { return safeFailure(error); }
}
