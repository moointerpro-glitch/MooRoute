import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { listMasters } from "@/server/services/masters";
import { masterDefinitions } from "@/lib/master-definitions";
import { safeFailure } from "@/server/http";
const cell=(v:unknown)=>`"${String(v??"").replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;
export async function GET(request:Request,{params}:{params:Promise<{kind:string}>}){
  try{const actor=await actorFromHeaders(request.headers),{kind}=await params,url=new URL(request.url);
    const result=await listMasters(getDatabase(),actor.id,kind,{q:url.searchParams.get("q")??"",status:url.searchParams.get("status")??"active",export:true});
    const d=masterDefinitions[kind],fields=d.fields.filter(f=>!f.lookup&&f.name!=="aliases");
    const csv="\uFEFF"+[fields.map(f=>cell(f.label)).join(","),...result.rows.map(row=>fields.map(f=>{
      const value=row[f.name];
      if(value&&["date","datetime-local"].includes(f.type??""))return cell(new Intl.DateTimeFormat("th-TH-u-ca-buddhist",{timeZone:f.type==="date"?"UTC":"Asia/Bangkok",dateStyle:"short",...(f.type==="datetime-local"?{timeStyle:"short" as const}:{})}).format(new Date(String(value))));
      if(value!==null&&f.type==="time")return cell(`${String(Math.floor(Number(value)/60)).padStart(2,"0")}:${String(Number(value)%60).padStart(2,"0")} น.`);
      return cell(f.options?f.options.find(o=>o.value===value)?.label??"ยังไม่ระบุ":value);
    }).join(","))].join("\r\n");
    return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${kind}.csv"`,"Cache-Control":"no-store"}});
  }catch(error){return safeFailure(error);}
}
