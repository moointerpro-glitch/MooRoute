import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { getMaster } from "@/server/services/masters";
import { safeFailure } from "@/server/http";
export async function GET(request:Request,{params}:{params:Promise<{kind:string;id:string}>}){
  try{const actor=await actorFromHeaders(request.headers),{kind,id}=await params;return Response.json(await getMaster(getDatabase(),actor.id,kind,id),{headers:{"Cache-Control":"no-store"}});}
  catch(error){return safeFailure(error);}
}
