"use client";

import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft} from "lucide-react";
import type {PlanningData} from "@/server/services/planning-read";
import type {DraftTrip} from "@/server/services/plans";
import {TripEditor} from "./planning-trip-editor";
import {RouteEditor,TemplateEditor} from "./planning-catalog-editor";
import {PlanningDialog} from "./planning-dialog";
import {thaiDay} from "./planning-day";

export function PlanningEditPage({date,kind,id,copy,revision}:{date:string;kind:string;id?:string;copy?:string;revision?:string}){
 const router=useRouter(),[data,setData]=useState<PlanningData|null>(null),[trip,setTrip]=useState<DraftTrip|null>(null);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[leave,setLeave]=useState<string|null>(null);
 const bypass=useRef(false),restoring=useRef(false),requestKey=useRef<{body:string;key:string}|null>(null);
 const tab=kind==="route"?"routes":kind==="template"?"templates":"plan";
 const backHref=`/admin/planning?${new URLSearchParams({date,tab,...(revision?{revision}:{})})}`;
 const backLabel=kind==="route"?"กลับรายการเส้นทาง":kind==="template"?"กลับรายการแม่แบบ":`กลับแผน${thaiDay(date)}`;
 const exit=(href=backHref)=>{if(busy)return;if(dirty)setLeave(href);else router.replace(href);};
 useEffect(()=>{const controller=new AbortController();
  fetch(`/api/planning?${new URLSearchParams({date,...(revision?{revision}:{})})}`,{cache:"no-store",signal:controller.signal}).then(async r=>{
   const d=await r.json();if(!r.ok)throw Error(d.message??"โหลดข้อมูลไม่สำเร็จ");
   const permission=kind==="trip"?"plan.write":kind==="route"?"route.write":"template.write";
   if(!["trip","route","template"].includes(kind)||!d.permissions.includes(permission))throw Error("ไม่มีสิทธิ์แก้ไขข้อมูลนี้");
   const model=d as PlanningData;
   if(kind==="trip"){
    const source=model.trips.find(t=>t.tripId===(copy||id));
    if((id||copy)&&!source)throw Error("ไม่พบเที่ยวในฉบับแผนนี้ กรุณากลับรายการแล้วเปิดใหม่");
    const tripId=crypto.randomUUID();
    setTrip(copy&&source?{...source,tripId,code:`T-${tripId.slice(0,12)}`,cancelled:false}:source??{tripId,code:`T-${tripId.slice(0,12)}`,kind:"BRANCH_DELIVERY",roundNo:1,cancelled:false,vehicleId:null,loadingAt:null,departureAt:null,arrivalAt:null,occupancyStart:null,occupancyEnd:null,bufferMinutes:0,stops:[]});
   }else if(id&&!(kind==="route"?model.routes:model.templates).some(r=>r.id===id))throw Error("ไม่พบรายการที่ต้องการแก้ไข");
   setData(model);
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"โหลดไม่สำเร็จ กรุณาลองใหม่");});
  return()=>controller.abort();
 },[date,kind,id,copy,revision]);
 useEffect(()=>{
  const unload=(e:BeforeUnloadEvent)=>{if((dirty||busy)&&!bypass.current){e.preventDefault();e.returnValue="";}};
  const click=(e:MouseEvent)=>{const a=(e.target as Element).closest?.("a[href]");if(!a||e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey||e.button!==0||bypass.current)return;
   if((dirty||busy)&&a instanceof HTMLAnchorElement&&a.target!=="_blank"){e.preventDefault();e.stopPropagation();if(!busy)setLeave(a.href);}};
  const pop=(e:PopStateEvent)=>{if(restoring.current){restoring.current=false;e.stopImmediatePropagation();return;}
   if((dirty||busy)&&!bypass.current){e.stopImmediatePropagation();restoring.current=true;window.history.forward();if(!busy)setLeave(backHref);}};
  window.addEventListener("beforeunload",unload);document.addEventListener("click",click,true);window.addEventListener("popstate",pop,true);
  return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",click,true);window.removeEventListener("popstate",pop,true);};
 },[dirty,busy,backHref]);
 const save=async(action:string,input:unknown)=>{
  if(busy)return false;setBusy(true);setError("");
  const body=JSON.stringify({action,input});if(requestKey.current?.body!==body)requestKey.current={body,key:crypto.randomUUID()};
  try{
   const r=await fetch("/api/planning",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":requestKey.current.key},body}),result=await r.json();
   if(!r.ok){requestKey.current=null;throw Error(result.message??"บันทึกไม่สำเร็จ");}
   bypass.current=true;setDirty(false);
   const selectedRevision=action==="draft"?result.revisionId:revision;
   const query=new URLSearchParams({date,tab,saved:action,...(selectedRevision?{revision:selectedRevision}:{}),...(trip?{focus:trip.tripId}:{})});
   router.replace(`/admin/planning?${query}`);return true;
  }catch(e){setError(e instanceof Error?e.message:"เชื่อมต่อไม่ได้ ข้อมูลที่กรอกยังอยู่ กรุณาตรวจการเชื่อมต่อแล้วลองบันทึกอีกครั้ง");return false;}
  finally{setBusy(false);}
 };
 return <div className="planning-edit-page">
  {!data&&<button type="button" className="secondary-button admin-back-button" disabled={busy} onClick={()=>exit()}><ArrowLeft size={18} aria-hidden="true"/>{backLabel}</button>}
  <div className="planner-title"><span className="eyebrow">{thaiDay(date)}</span><h1>{kind==="trip"?(copy?"คัดลอกเที่ยวรถ":id?"แก้ไขเที่ยวรถ":"เพิ่มเที่ยวรถ"):kind==="route"?(id?"แก้ไขเส้นทาง":"เพิ่มเส้นทาง"):(id?"แก้ไขแม่แบบ":"เพิ่มแม่แบบ")}</h1>
   <p className="muted">{kind==="trip"?"บันทึกครั้งเดียว ระบบจะเก็บฉบับร่างและตรวจความครบถ้วนให้ทันที ยังไม่เผยแพร่แผน":"ตรวจข้อมูลให้ครบก่อนบันทึก ระบบเก็บประวัติทุกฉบับ"}</p></div>
  {error&&<p role="alert" className="form-error">{error}</p>}
  {!data&&!error&&<p role="status">กำลังโหลดข้อมูล…</p>}{!data&&error&&<button className="secondary-button" onClick={()=>window.location.reload()}>ลองโหลดอีกครั้ง</button>}
  {data&&<fieldset disabled={busy} className="planner-fieldset" onChangeCapture={()=>setDirty(true)} onPasteCapture={()=>setDirty(true)} onClickCapture={e=>{const button=(e.target as Element).closest("button");if(button&&(button.hasAttribute("data-editor-change")||button.classList.contains("calendar-day")||/^(ใช้เวลา|ล้าง)/.test(button.textContent??"")))setDirty(true);}}>
   {kind==="trip"&&trip&&<TripEditor trip={trip} data={data} onClose={()=>exit()} onSave={t=>save("draft",{serviceDate:date,expectedVersion:data.version,trips:data.trips.some(x=>x.tripId===t.tripId)?data.trips.map(x=>x.tripId===t.tripId?t:x):[...data.trips,t],reason:`${copy?"คัดลอก":id?"แก้ไข":"เพิ่ม"}เที่ยว ${t.code}`})}/>}
   {kind==="route"&&<RouteEditor data={data} id={id} save={save} close={()=>{if(!bypass.current)exit();}}/>}
   {kind==="template"&&<TemplateEditor data={data} id={id} save={save} close={()=>{if(!bypass.current)exit();}}/>}
  </fieldset>}
  {busy&&<p className="saving-indicator" role="status">กำลังบันทึกและตรวจสอบแผน…</p>}
  {leave&&<PlanningDialog title="มีข้อมูลที่ยังไม่บันทึก" onClose={()=>setLeave(null)}><p>หากออกตอนนี้ การแก้ไขในหน้านี้จะหายไป ต้องการแก้ไขต่อหรือไม่?</p><div className="dialog-actions"><button className="primary-button" onClick={()=>setLeave(null)}>แก้ไขต่อ</button><button className="secondary-button" onClick={()=>{bypass.current=true;setDirty(false);const url=new URL(leave,window.location.origin);if(url.origin===window.location.origin)router.replace(url.pathname+url.search+url.hash);else window.location.assign(url.href);}}>ออกโดยไม่บันทึก</button></div></PlanningDialog>}
 </div>;
}
