import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { normalizeQuery } from "@/server/domain/search";
import { suggestBranches } from "@/server/services/trip-search";

export async function GET(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers);
    const query = normalizeQuery(new URL(request.url).searchParams.get("q") ?? "");
    return Response.json(await suggestBranches(getDatabase(), actor.id, query), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
