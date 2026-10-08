import {adminReturnHref} from "@/lib/admin-return";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { getMaster, listMasters } from "@/server/services/masters";
import { masterDefinitions } from "@/lib/master-definitions";
import { MasterForm } from "@/components/master-form";
import { principal,requireCapability } from "@/server/auth/permissions";
import { DomainError } from "@/server/domain/errors";
export default async function EditMaster({params,searchParams}:{params:Promise<{kind:string;id:string}>;searchParams:Promise<{returnTo?:string}>}){
  const actor=await requirePageActor(),{kind,id}=await params,db=getDatabase();
  const backHref=adminReturnHref((await searchParams).returnTo,`/admin/${kind}`);
  try{
    const p=await db.$transaction(tx=>principal(tx,actor.id));requireCapability(p,`master.${kind}.${id==="new"?"write":"read"}`);
    const d=masterDefinitions[kind];if(!d)throw new DomainError("NOT_FOUND","ไม่พบประเภทข้อมูล");
    const row=id==="new"?null:await getMaster(db,actor.id,kind,id);
    const options:Record<string,{value:string;label:string}[]>={};
    for(const field of d.fields.filter(f=>f.lookup)){
      const result=await listMasters(db,actor.id,field.lookup!,{status:"active",page:1});
      const rows=[...result.rows];for(let page=2;page<=Math.ceil(result.total/20);page++)rows.push(...(await listMasters(db,actor.id,field.lookup!,{status:"active",page})).rows);
      options[field.lookup!]=rows.filter(r=>r.id!==id).map(r=>({value:r.id,label:`${r.code} · ${r.name}`}));
      if(row?.[field.name]&&!options[field.lookup!].some(o=>o.value===row[field.name]))options[field.lookup!].push({value:String(row[field.name]),label:"รายการเดิม (ไม่พร้อมใช้งาน)"});
    }
    return <><h1>{id==="new"?"เพิ่ม":p.permissions.has(`master.${kind}.write`)?"รายละเอียด / แก้ไข":"รายละเอียด"}{d.title}</h1>{id!=="new"&&!p.permissions.has(`master.${kind}.write`)&&<p className="readonly-badge">ดูอย่างเดียว แก้ไขไม่ได้</p>}<p className="muted">ช่องที่มี * จำเป็นต้องระบุ · การแก้ไขจะบันทึกประวัติผู้ดำเนินการ</p><MasterForm backHref={backHref} kind={kind} row={row} options={options} canWrite={p.permissions.has(`master.${kind}.write`)} canDelete={p.permissions.has(`master.${kind}.delete`)}/></>;
  }catch(error){return <div className="admin-card" role="alert"><h1>ไม่สามารถเปิดข้อมูลได้</h1><p>{error instanceof DomainError?error.message:"ระบบไม่พร้อมใช้งาน กรุณาลองอีกครั้ง"}</p><Link href="/admin">กลับหน้าจัดการข้อมูล</Link></div>;}
}
