import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { authorize } from "@/server/services/transaction";
import { PlanningWorkspace } from "@/components/planning-workspace";
export default async function PlanningPage(){const actor=await requirePageActor();try{await getDatabase().$transaction(tx=>authorize(tx,actor.id,"plan.read"));}catch{return <div className="admin-card"><h1>ไม่มีสิทธิ์เข้าถึงแผนเดินรถ</h1><p>กรุณาติดต่อผู้ดูแลเพื่อกำหนดประเภทบัญชีและขอบเขตงาน</p></div>;}return <PlanningWorkspace/>;}
