import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { DomainError } from "@/server/domain/errors";
import { parseLookup } from "@/server/domain/labels";
import { lookupLabel } from "@/server/services/labels";

/** Scanner endpoint: accepts the scanned URL or token; requires a session and the consignment row policy. */
export async function GET(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers);
    const parsed = parseLookup(new URL(request.url).searchParams.get("code") ?? "");
    if (!parsed) throw new DomainError("NOT_FOUND", "ไม่พบฉลากนี้ในระบบ");
    return Response.json(await lookupLabel(getDatabase(), actor.id, parsed.token, parsed.sequence), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
