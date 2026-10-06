"use client";
import Link from "next/link";
import {useRef,useState} from "react";
import {masterDefinitions,type Field} from "@/lib/master-definitions";
type Row=Record<string,string|number|boolean|null>;
function display(field:Field,v:Row[string]){
  if(v==null)return "";
  if(field.type==="date"||field.type==="datetime-local"){
    const iso=field.type==="date"?String(v):new Date(new Date(String(v)).valueOf()+7*3600000).toISOString();
    return `${iso.slice(8,10)}/${iso.slice(5,7)}/${Number(iso.slice(0,4))+543}${field.type==="datetime-local"?` ${iso.slice(11,16)}`:""}`;
  }
  if(field.type==="time")return `${String(Math.floor(Number(v)/60)).padStart(2,"0")}:${String(Number(v)%60).padStart(2,"0")}`;
  return String(v);
}
export function MasterForm({kind,row,options,canWrite,canDelete}:{kind:string;row:Row|null;options:Record<string,{value:string;label:string}[]>;canWrite:boolean;canDelete:boolean}){
  const d=masterDefinitions[kind],[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[success,setSuccess]=useState(false);
  const formRef=useRef<HTMLFormElement>(null);
  const submit=async(action:"save"|"delete")=>{
    const form=formRef.current!;if(!form.reportValidity())return;const fd=new FormData(form),values:Record<string,unknown>={active:fd.get("active")==="on"};
    for(const f of d.fields){
      let text=String(fd.get(f.name)??"").trim();
      if(["date","datetime-local"].includes(f.type??"")){
        text=text.replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50));
        const match=text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2}))?$/);
        if(match&&Number(match[3])>=2400&&Number(match[3])<=3500)text=`${Number(match[3])-543}-${match[2]}-${match[1]}${f.type==="datetime-local"?`T${match[4]??""}`:""}`;
      }
      values[f.name]=text;
    }
    setBusy(true);setMessage("");setSuccess(false);
    try{const r=await fetch(`/api/masters/${kind}`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({id:row?.id,expectedVersion:Number(row?.version??0),reason:fd.get("reason"),action,values:action==="save"?values:undefined})});const data=await r.json();if(!r.ok){setMessage(data.message??"บันทึกไม่สำเร็จ");return;}
      setSuccess(true);setMessage(data.outcome==="deleted"?"ลบข้อมูลที่ไม่มีรายการอ้างอิงแล้ว":data.outcome==="archived"?"ข้อมูลมีรายการอ้างอิง ระบบเก็บเข้าคลังและรักษาประวัติแล้ว":"บันทึกข้อมูลสำเร็จ");
    }catch{setMessage("เชื่อมต่อไม่ได้ กรุณาโหลดข้อมูลใหม่เพื่อตรวจสอบผลก่อนลองอีกครั้ง");}finally{setBusy(false);setConfirm(false);}
  };
  return <form ref={formRef} className="admin-card admin-form" onSubmit={e=>{e.preventDefault();void submit("save");}}>
    <div className="form-grid">{d.fields.map(field=><label key={field.name}><span>{field.label}{field.required&&<span className="required"> *</span>}</span>
      {field.type==="select"?<select name={field.name} defaultValue={String(row?.[field.name]??"")} required={field.required} disabled={!canWrite||success}><option value="">ยังไม่ระบุ</option>{(field.options??options[field.lookup!]??[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:
        field.type==="textarea"?<textarea name={field.name} defaultValue={String(row?.[field.name]??"")} maxLength={field.max} readOnly={!canWrite||success} rows={3}/>:
        <input name={field.name} type={["date","datetime-local"].includes(field.type??"")?"text":field.type??"text"} placeholder={field.type==="date"?"วัน/เดือน/ปี พ.ศ.":field.type==="datetime-local"?"วัน/เดือน/ปี พ.ศ. ชั่วโมง:นาที":undefined} defaultValue={display(field,row?.[field.name]??null)} required={field.required} readOnly={!canWrite||success} maxLength={field.max} step={field.type==="number"?(field.name==="wheelCount"?"1":"0.001"):undefined} min={field.type==="number"?"0.001":undefined}/>}</label>)}</div>
    <p className="muted">วันที่ใช้รูปแบบ วัน/เดือน/ปี พ.ศ. เวลาใช้เขตประเทศไทย เช่น 06/10/2569 08:30</p>
    <label className="checkbox-label"><input type="checkbox" name="active" defaultChecked={row?!!row[d.active] !== (d.active==="archived"):true} disabled={!canWrite||success}/>ใช้งานข้อมูลนี้</label>
    {canWrite&&<label><span>เหตุผลการเปลี่ยนแปลง <span className="required">*</span></span><textarea name="reason" required minLength={3} maxLength={500} readOnly={success} placeholder="ระบุเหตุผลเพื่อบันทึกประวัติ"/></label>}
    {message&&<div className={success?"form-success":"form-error"} role={success?"status":"alert"}>{message}{success&&<p><a href={`/admin/${kind}`}>กลับรายการ</a> · {row&&<a href={`/admin/${kind}/${row.id}`}>โหลดข้อมูลล่าสุด</a>}</p>}</div>}
    {!success&&<div className="form-actions">{canWrite&&<button className="primary-button" disabled={busy}>{busy?"กำลังบันทึก…":"บันทึกข้อมูล"}</button>}<Link className="secondary-button" href={`/admin/${kind}`}>กลับรายการ</Link>{row&&canDelete&&<button type="button" className="danger-button" disabled={busy} onClick={()=>setConfirm(true)}>ลบ / เก็บเข้าคลัง</button>}</div>}
    {confirm&&<div className="delete-confirm" role="alert"><p>ยืนยันดำเนินการกับข้อมูลนี้? หากมีรายการอ้างอิง ระบบจะเก็บเข้าคลังแทนการลบ หากกระทบงานที่ยังใช้งานอยู่ต้องปรับงานก่อน</p><button type="button" className="danger-button" disabled={busy} onClick={()=>void submit("delete")}>ยืนยันลบ / เก็บเข้าคลัง</button><button type="button" className="secondary-button" onClick={()=>setConfirm(false)}>ยกเลิก</button></div>}
  </form>;
}
