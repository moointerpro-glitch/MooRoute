import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { readWriteBody,safeFailure } from "@/server/http";
import { planningData } from "@/server/services/planning-read";
import { saveRoute,saveTemplate,generateTrips } from "@/server/services/planning-catalog";
import { saveDraft,publishPlan } from "@/server/services/plans";
import { generatePlans,planningOverview,publishPlans } from "@/server/services/planning-range";
import { requireCondition } from "@/server/domain/errors";
export async function GET(request:Request){try{const actor=await actorFromHeaders(request.headers),url=new URL(request.url);
 // D225: ?overview=<from>&days=<n> returns the status of each service date instead of one day's plan.
 if(url.searchParams.has("overview"))return Response.json(await planningOverview(getDatabase(),actor.id,url.searchParams.get("overview")??"",Number(url.searchParams.get("days")??14)),{headers:{"Cache-Control":"no-store"}});
 return Response.json(await planningData(getDatabase(),actor.id,url.searchParams.get("date")??"",url.searchParams.get("revision")),{headers:{"Cache-Control":"no-store"}});}catch(e){return safeFailure(e);}}
export async function POST(request:Request){try{
 const actor=await actorFromHeaders(request.headers),body=await readWriteBody(request,500000),key=request.headers.get("Idempotency-Key")??"",db=getDatabase();
 requireCondition(body&&typeof body==="object"&&body.input&&typeof body.input==="object","INVALID_INPUT","ข้อมูลไม่ถูกต้อง");
 requireCondition(typeof body.input.reason==="string"&&body.input.reason.trim().length>=3&&body.input.reason.length<=500,"REASON_REQUIRED","กรุณาระบุเหตุผลอย่างน้อย ๓ ตัวอักษร");
 const result=body.action==="route"?await saveRoute(db,actor.id,key,body.input):body.action==="template"?await saveTemplate(db,actor.id,key,body.input):body.action==="draft"?await saveDraft(db,actor.id,key,body.input):body.action==="generate"?await generateTrips(db,actor.id,key,body.input):body.action==="publish"?await publishPlan(db,actor.id,key,body.input):body.action==="generateRange"?await generatePlans(db,actor.id,key,body.input):body.action==="publishRange"?await publishPlans(db,actor.id,key,body.input):null;
 requireCondition(result,"INVALID_INPUT","การดำเนินการไม่ถูกต้อง");return Response.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(e){return safeFailure(e);}}
