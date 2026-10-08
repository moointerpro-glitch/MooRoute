import {requirePageActor} from "@/server/auth/session";
import {getDatabase} from "@/server/persistence/database";
import {authorize} from "@/server/services/transaction";
import {PlanningEditPage} from "@/components/planning-edit-page";
import {serviceDate} from "@/server/domain/planning";
import Link from "next/link";

export default async function EditPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await requirePageActor(),params=await searchParams;
 const value=(key:string)=>typeof params[key]==="string"?params[key] as string:undefined;
 const kind=value("kind")??"trip",date=value("date")??"";
 try{serviceDate(date);await getDatabase().$transaction(tx=>authorize(tx,actor.id,kind==="trip"?"plan.write":kind==="route"?"route.write":"template.write"));}
 catch{return <div className="admin-card"><h1>ไม่สามารถเปิดหน้าแก้ไขได้</h1><p>ตรวจวันที่และสิทธิ์การใช้งาน แล้วกลับไปเปิดรายการอีกครั้ง</p><Link href="/admin/planning">กลับแผนรายวัน</Link></div>;}
 return <PlanningEditPage key={`${date}:${kind}:${value("id")}:${value("copy")}:${value("revision")}`} date={date} kind={kind} id={value("id")} copy={value("copy")} revision={value("revision")}/>;
}
