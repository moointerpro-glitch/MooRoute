import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { authorize } from "@/server/services/transaction";
import { PlanningWorkspace } from "@/components/planning-workspace";
export default async function PlanningPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const actor=await requirePageActor();try{await getDatabase().$transaction(tx=>authorize(tx,actor.id,"plan.read"));}catch{return <div className="admin-card"><h1>ไม่มีสิทธิ์เข้าถึงแผนเดินรถ</h1><p>กรุณาติดต่อผู้ดูแลเพื่อกำหนดประเภทบัญชีและขอบเขตงาน</p></div>;}const q=await searchParams;const text=(k:string)=>typeof q[k]==="string"?q[k] as string:undefined;return <PlanningWorkspace key={`${text("date")}:${text("tab")}:${text("revision")}:${text("saved")}`} initialDate={text("date")} initialTab={text("tab")} initialRevision={text("revision")} saved={text("saved")} focusId={text("focus")}/>;}
