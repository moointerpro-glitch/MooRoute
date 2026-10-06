import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { listMasters, mutateMaster } from "@/server/services/masters";
import { readWriteBody, safeFailure } from "@/server/http";
export async function GET(request:Request,{params}:{params:Promise<{kind:string}>}){
  try{const actor=await actorFromHeaders(request.headers),{kind}=await params,url=new URL(request.url);
    return Response.json(await listMasters(getDatabase(),actor.id,kind,{q:url.searchParams.get("q")??"",status:url.searchParams.get("status")??"active",page:Number(url.searchParams.get("page")??1)}),{headers:{"Cache-Control":"no-store"}});
  }catch(error){return safeFailure(error);}
}
export async function POST(request:Request,{params}:{params:Promise<{kind:string}>}){
  try{const actor=await actorFromHeaders(request.headers),body=await readWriteBody(request),{kind}=await params;
    return Response.json(await mutateMaster(getDatabase(),actor.id,kind,request.headers.get("idempotency-key")??"",body),{headers:{"Cache-Control":"no-store"}});
  }catch(error){return safeFailure(error);}
}
