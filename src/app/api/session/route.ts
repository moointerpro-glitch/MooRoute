import {actorFromHeaders} from "@/server/auth/session";
import {principal} from "@/server/auth/permissions";
import {getDatabase} from "@/server/persistence/database";
import {safeFailure} from "@/server/http";
export async function GET(request:Request){try{const actor=await actorFromHeaders(request.headers),p=await getDatabase().$transaction(tx=>principal(tx,actor.id));return Response.json({name:actor.name,canOpenBackend:[...p.permissions].some(c=>c.startsWith("master.")&&c.endsWith(".read"))},{headers:{"Cache-Control":"no-store"}});}catch(e){return safeFailure(e);}}
