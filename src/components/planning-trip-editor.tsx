"use client";
import {ArrowLeft} from "lucide-react";
import {useState} from "react";
import type {DraftTrip} from "@/server/services/plans";
import type {PlanningData} from "@/server/services/planning-read";
import {field,kindLabels,localInstant,utcInstant} from "./planning-fields";
import {DateTimeInput} from "./date-time-inputs";

/**
 * One trip editor. Submission persists a complete version-checked draft through the parent page.
 * The vehicle booking window normally follows the trip itself (loading, or departure when loading is unknown, until
 * arrival); it can be set by hand under "ขั้นสูง" when the vehicle is needed longer.
 */
export function TripEditor({trip,data,onSave,onClose}:{trip:DraftTrip;data:PlanningData;onSave:(trip:DraftTrip)=>Promise<boolean>;onClose:()=>void}){
 const [stops,setStops]=useState(trip.stops),[error,setError]=useState("");
 const follows=trip.occupancyStart===(trip.loadingAt??trip.departureAt)&&trip.occupancyEnd===trip.arrivalAt;
 const [autoBooking,setAutoBooking]=useState(follows);
 const move=(n:number,delta:number)=>{const copy=[...stops];[copy[n],copy[n+delta]]=[copy[n+delta],copy[n]];setStops(copy);};
 const existing=data.trips.some(t=>t.tripId===trip.tripId);
 return <form className="admin-form planner-editor" onSubmit={async e=>{e.preventDefault();
  try{
   const f=new FormData(e.currentTarget),kind=field(f,"kind") as DraftTrip["kind"],instant=(name:string)=>utcInstant(field(f,name));
   const loadingAt=instant("loadingAt"),departureAt=instant("departureAt"),arrivalAt=instant("arrivalAt");
   if(stops.some(s=>!s.branchId))throw Error("กรุณาเลือกสาขาให้ครบทุกจุดส่ง หรือลดจุดส่งที่ยังว่าง");
   await onSave({...trip,code:field(f,"code"),kind,roundNo:kind==="BRANCH_DELIVERY"?Number(f.get("roundNo")):null,vehicleId:field(f,"vehicleId")||null,driverId:field(f,"driverId")||null,loadingAt,departureAt,arrivalAt,
    occupancyStart:autoBooking?loadingAt??departureAt:instant("occupancyStart"),occupancyEnd:autoBooking?arrivalAt:instant("occupancyEnd"),bufferMinutes:Number(f.get("bufferMinutes")),
    notes:field(f,"notes")||null,plannedLoad:field(f,"plannedLoad")||null,loadUnit:field(f,"plannedLoad")?field(f,"loadUnit"):null,stops});
  }catch(e){setError(e instanceof Error?e.message:"ข้อมูลไม่ถูกต้อง");}}}>
 <div className="admin-heading"><h3>{existing?`แก้ไขเที่ยว ${trip.code}`:"เพิ่มเที่ยวใหม่"}</h3></div>
 <fieldset className="editor-group"><legend>เที่ยวและรถ</legend><div className="form-grid">
  <label>รหัสเที่ยว<input name="code" defaultValue={trip.code} required maxLength={64} readOnly={existing}/></label>
  <label>ประเภทเที่ยว<select name="kind" defaultValue={trip.kind}>{Object.entries(kindLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <label>รอบส่งสาขา<select name="roundNo" defaultValue={trip.roundNo??1}>{[1,2,3].map(n=><option key={n} value={n}>รอบ {n}</option>)}</select></label>
  <label>รถ<select name="vehicleId" defaultValue={trip.vehicleId??""}><option value="">ยังไม่ระบุ</option>{data.vehicles.filter(v=>v.active||v.id===trip.vehicleId).map(v=><option key={v.id} value={v.id}>{v.plateNormalized} {v.province}{!v.active?" (ไม่พร้อมใช้)":""}</option>)}</select></label>
  <label>พนักงานขับรถ<select name="driverId" defaultValue={trip.driverId??""}><option value="">ยังไม่ระบุ</option>{data.drivers.filter(d=>d.active||d.id===trip.driverId).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
 </div></fieldset>
 <fieldset className="editor-group"><legend>เวลา (วันที่ พ.ศ. และเวลาไทย ๒๔ ชั่วโมง)</legend><p className="muted">เว้นเวลาว่างได้เมื่อยังไม่ทราบ แต่ต้องมีเวลาออกรถและเวลาถึงปลายทางก่อนเผยแพร่</p><div className="form-grid">
  {([["loadingAt","เริ่มขึ้นของ"],["departureAt","ออกรถ"],["arrivalAt","ถึงปลายทาง"]] as const).map(([key,label])=><label key={key}>{label}<DateTimeInput name={key} label={label} defaultValue={localInstant(trip[key])}/></label>)}
 </div></fieldset>
 <h4>จุดส่งและหมวดสินค้าประจำจุด</h4>{stops.map((s,n)=><fieldset className="stop-editor" key={n}><legend>จุดส่งที่ {n+1}</legend><label>สาขาหรือจุดรับส่ง<select value={s.branchId} onChange={e=>setStops(stops.map((x,k)=>k===n?{...x,branchId:e.target.value,nameSnapshot:undefined}:x))} required><option value="">เลือกจุดส่ง</option>{data.branches.map(b=><option key={b.id} value={b.id}>{b.code} — {b.name}{b.archived?" (เก็บเข้าคลัง)":""}</option>)}</select></label><div className="planner-checks">{data.categories.filter(c=>c.active||s.categoryIds.includes(c.id)).map(c=><label key={c.id}><input type="checkbox" checked={s.categoryIds.includes(c.id)} onChange={e=>setStops(stops.map((x,k)=>k===n?{...x,categoryIds:e.target.checked?[...x.categoryIds,c.id]:x.categoryIds.filter(id=>id!==c.id)}:x))}/>{c.name}</label>)}</div><div className="planner-actions"><button data-editor-change type="button" onClick={()=>move(n,-1)} disabled={n===0}>เลื่อนขึ้น</button><button data-editor-change type="button" onClick={()=>move(n,1)} disabled={n===stops.length-1}>เลื่อนลง</button><button data-editor-change type="button" onClick={()=>setStops(stops.filter((_,k)=>k!==n))}>ลดจุดส่งนี้</button></div></fieldset>)}
 <button data-editor-change type="button" className="secondary-button" onClick={()=>setStops([...stops,{branchId:"",categoryIds:[]}])}>เพิ่มจุดส่ง</button>
 <details className="editor-advanced" open={!follows}><summary>ขั้นสูง: ช่วงจองรถ ปริมาณบรรทุก และหมายเหตุ</summary><div className="form-grid">
  <label className="check-label editor-wide"><input type="checkbox" checked={autoBooking} onChange={e=>setAutoBooking(e.target.checked)}/>จองรถตามเวลาของเที่ยวอัตโนมัติ (ตั้งแต่เริ่มขึ้นของจนถึงปลายทาง)</label>
  {!autoBooking&&([["occupancyStart","เริ่มใช้รถ"],["occupancyEnd","สิ้นสุดใช้รถ"]] as const).map(([key,label])=><label key={key}>{label}<DateTimeInput name={key} label={label} defaultValue={localInstant(trip[key])}/></label>)}
  <label>เวลาเผื่อหลังใช้รถ (นาที)<input name="bufferMinutes" type="number" min={0} max={1440} defaultValue={trip.bufferMinutes} required/></label>
  <label>ปริมาณบรรทุกตามแผน<input name="plannedLoad" type="number" min="0.001" step="0.001" defaultValue={trip.plannedLoad??""}/></label>
  <label>หน่วยบรรทุก<select name="loadUnit" defaultValue={trip.loadUnit??"KG"}><option value="KG">กิโลกรัม</option><option value="TON">ตัน</option><option value="BOX">กล่อง</option><option value="PIECE">ชิ้น</option><option value="LITER">ลิตร</option></select></label>
  <label className="editor-wide">หมายเหตุ<textarea name="notes" defaultValue={trip.notes??""} maxLength={2000}/></label>
 </div></details>
 {error&&<p role="alert" className="form-error">{error}</p>}
 <div className="form-actions editor-save-bar"><button type="button" className="secondary-button admin-back-button" onClick={onClose}><ArrowLeft size={18} aria-hidden="true"/>กลับแผนรายวัน</button><button className="primary-button" type="submit">บันทึกเที่ยวและตรวจแผน</button></div></form>;
}
