import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { parseSearchInput } from "@/server/domain/search";
import { searchTrips } from "@/server/services/trip-search";
import { bangkokServiceDate } from "@/lib/bangkok-date";

export async function GET(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers);
    const input = parseSearchInput(new URL(request.url).searchParams, bangkokServiceDate());
    return Response.json(await searchTrips(getDatabase(), actor.id, input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
