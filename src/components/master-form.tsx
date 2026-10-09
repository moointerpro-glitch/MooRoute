"use client";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {useRef,useState} from "react";
import {masterDefinitions,type Field} from "@/lib/master-definitions";
import {AdminDialog,AdminFormBoundary} from "./admin-form-boundary";
import {DateInput,DateTimeInput,TimeInput} from "./date-time-inputs";
import { newUuid } from "@/lib/new-uuid";
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
export function MasterForm({kind,row,options,canWrite,canDelete,backHref}:{kind:string;row:Row|null;options:Record<string,{value:string;label:string}[]>;canWrite:boolean;canDelete:boolean;backHref:string}){
  const d=masterDefinitions[kind],[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[success,setSuccess]=useState(false);
  const [dirty,setDirty]=useState(false);
  const groups=kind==="vehicles"?[["ทะเบียนและลักษณะรถ",["plateNormalized","province","brand","model","color","typeId","wheelCount","bodyDescription"]],["การเก็บรักษาและบรรทุก",["storageConditionId","capacity","capacityUnit"]],["เจ้าของและช่วงใช้งาน",["ownerName","availableFrom","availableTo"]]]:kind==="branches"?[["ข้อมูลสาขา",["code","name","destinationType","aliases"]],["ที่อยู่สำหรับจัดส่ง",["addressLine","subdistrict","district","province","postalCode"]],["ผู้รับและช่วงให้บริการ",["contactName","contactPhone","receivingFromMinute","receivingToMinute","activeFrom","activeTo"]]]:[["ข้อมูลทั่วไป",d.fields.map(f=>f.name)]];
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
    try{const r=await fetch(`/api/masters/${kind}`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":newUuid()},body:JSON.stringify({id:row?.id,expectedVersion:Number(row?.version??0),reason:fd.get("reason"),action,values:action==="save"?values:undefined})});const data=await r.json();if(!r.ok){setMessage(data.message??"บันทึกไม่สำเร็จ");return;}
      setDirty(false);setSuccess(true);setConfirm(false);setMessage(data.outcome==="deleted"?"ลบข้อมูลที่ไม่มีรายการอ้างอิงแล้ว":data.outcome==="archived"?"ข้อมูลมีรายการอ้างอิง ระบบเก็บเข้าคลังและรักษาประวัติแล้ว":"บันทึกข้อมูลสำเร็จ");
    }catch{setMessage("เชื่อมต่อไม่ได้ กรุณาโหลดข้อมูลใหม่เพื่อตรวจสอบผลก่อนลองอีกครั้ง");}finally{setBusy(false);}
  };
  return <AdminFormBoundary dirty={dirty&&!success} busy={busy} onDirty={()=>{if(canWrite&&!success)setDirty(true);}} backHref={backHref}><form ref={formRef} className="admin-card admin-form" onSubmit={e=>{e.preventDefault();void submit("save");}}><fieldset disabled={busy} className="admin-form-fields">
    {kind==="product-categories"&&<div className="coverage-guidance"><strong>หมวดที่ใช้ตรวจแผนประจำวัน</strong><p>หมูใช้รหัส PORK และไก่ใช้รหัส CHICKEN เท่านั้น ไม่เติมคำอธิบายในช่องรหัส หากต้องการระบุ “ทดสอบ” ให้ใส่ในช่องชื่อ หมวดอื่นสร้างเพิ่มเติมได้ตามงาน</p></div>}
    {groups.map(([title,names])=><fieldset key={String(title)} className="admin-field-group"><legend>{title}</legend><div className="form-grid">{d.fields.filter(f=>(names as string[]).includes(f.name)).map(field=><label key={field.name}><span>{field.label}{field.required&&<span className="required"> *</span>}</span>
      {field.type==="select"?<select name={field.name} defaultValue={String(row?.[field.name]??"")} required={field.required} disabled={!canWrite||success}><option value="">ยังไม่ระบุ</option>{(field.options??options[field.lookup!]??[]).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:
        field.type==="textarea"?<textarea name={field.name} defaultValue={String(row?.[field.name]??"")} maxLength={field.max} readOnly={!canWrite||success} rows={3}/>:
        field.type==="date"?<DateInput name={field.name} defaultValue={display(field,row?.[field.name]??null)} required={field.required} readOnly={!canWrite||success}/>:
        field.type==="time"?<TimeInput name={field.name} defaultValue={display(field,row?.[field.name]??null)} required={field.required} readOnly={!canWrite||success}/>:
        field.type==="datetime-local"?<DateTimeInput name={field.name} label={field.label} defaultValue={display(field,row?.[field.name]??null)} required={field.required} readOnly={!canWrite||success}/>:
        <input name={field.name} type={field.type??"text"} defaultValue={display(field,row?.[field.name]??null)} required={field.required} readOnly={!canWrite||success} maxLength={field.max} step={field.type==="number"?(field.name==="wheelCount"?"1":"0.001"):undefined} min={field.type==="number"?(field.name==="wheelCount"?"2":"0.001"):undefined} max={field.type==="number"&&field.name==="wheelCount"?"30":undefined}/>}</label>)}</div></fieldset>)}
    <p className="muted">วันที่ใช้ วัน/เดือน/ปี พ.ศ. (พิมพ์ตัวเลขต่อกันได้ เช่น 06102569 หรือกดปุ่มปฏิทิน) · เวลาแบบ ๒๔ ชั่วโมงตามเวลาประเทศไทย เช่น 08:30</p>
    <label className="checkbox-label"><input type="checkbox" name="active" defaultChecked={row?!!row[d.active] !== (d.active==="archived"):true} disabled={!canWrite||success}/>ใช้งานข้อมูลนี้</label>
    {canWrite&&<label><span>เหตุผลการเปลี่ยนแปลง <span className="required">*</span></span><textarea name="reason" required minLength={3} maxLength={500} readOnly={success} placeholder="ระบุเหตุผลเพื่อบันทึกประวัติ"/></label>}
    {message&&<div className={success?"form-success":"form-error"} role={success?"status":"alert"}>{message}{success&&<p><Link className="secondary-button admin-back-button" href={backHref}><ArrowLeft size={18} aria-hidden="true"/>กลับรายการ{d.title}</Link> · {row&&<a href={`/admin/${kind}/${row.id}`}>โหลดข้อมูลล่าสุด</a>}</p>}</div>}
    {!success&&<div className="form-actions admin-editor-footer">{canWrite&&<button className="primary-button" disabled={busy}>{busy?"กำลังบันทึก…":"บันทึกข้อมูล"}</button>}<Link className="secondary-button admin-back-button" href={backHref}><ArrowLeft size={18} aria-hidden="true"/>กลับรายการ{d.title}</Link>{row&&canDelete&&<button type="button" className="danger-button" disabled={busy} onClick={()=>{if(formRef.current?.reportValidity()){setMessage("");setConfirm(true);}}}>ลบ / เก็บเข้าคลัง</button>}</div>}
    {confirm&&<AdminDialog title="ยืนยันลบหรือเก็บเข้าคลัง" busy={busy} onClose={()=>setConfirm(false)}><div className="delete-confirm"><strong>{String(row?.name??row?.plateNormalized??row?.code??d.title)}</strong><p>ยืนยันดำเนินการกับข้อมูลนี้? หากมีรายการอ้างอิง ระบบจะเก็บเข้าคลังแทนการลบ หากกระทบงานที่ยังใช้งานอยู่ต้องปรับงานก่อน</p>{message&&<p className="form-error" role="alert">{message}</p>}<button type="button" className="danger-button" disabled={busy} onClick={()=>void submit("delete")}>ยืนยันลบ / เก็บเข้าคลัง</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>setConfirm(false)}>ยกเลิก</button></div></AdminDialog>}
  </fieldset></form></AdminFormBoundary>;
}
