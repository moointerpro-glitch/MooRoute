import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { eligibleTrips } from "@/server/services/consignments";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await actorFromHeaders(request.headers), { id } = await params;
    return Response.json(await eligibleTrips(getDatabase(), actor.id, id, new URL(request.url).searchParams.get("date") ?? ""), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
