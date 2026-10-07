import {actorFromHeaders} from "@/server/auth/session";
import {getDatabase} from "@/server/persistence/database";
import {navigationAccess} from "@/lib/navigation";
import {accountSummary} from "@/server/services/account";
import {safeFailure} from "@/server/http";
/** Menu access plus the header profile (D221). Presentation only; every route keeps its own server check. */
export async function GET(request:Request){try{
  const actor=await actorFromHeaders(request.headers);
  const {p,...profile}=await getDatabase().$transaction(tx=>accountSummary(tx,actor.id));
  return Response.json({name:actor.name,...navigationAccess(p.permissions,p.global),profile:{name:profile.name,email:profile.email,initial:profile.initial,typeName:profile.typeName,scopes:profile.scopes}},{headers:{"Cache-Control":"no-store"}});
}catch(e){return safeFailure(e);}}
