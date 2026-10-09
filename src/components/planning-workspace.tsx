"use client";
import {useCallback,useEffect,useState} from "react";
import {Plus,Wand2} from "lucide-react";
import type {PlanningData} from "@/server/services/planning-read";
import type {PlanningOverview,RangeResult} from "@/server/services/planning-range";
import type {DraftTrip} from "@/server/services/plans";
import {addDays,weekStart} from "@/lib/planning-horizon";
import {useRouter} from "next/navigation";
import {PlanningDialog} from "./planning-dialog";

import {beDate,isoDate,kindLabels,localInstant,statusLabels} from "./planning-fields";
import {CoverageTable,DayBar,MissingPlanNotice,RangeTools,RoundSummary,TripTable,WeekStrip,thaiDay} from "./planning-day";
import { newUuid } from "@/lib/new-uuid";
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const actionLabels:Record<string,string>={PLAN_DRAFT_CREATED:"สร้างฉบับร่าง",PLAN_PUBLISHED:"เผยแพร่แผน",ROUTE_REVISED:"แก้ไขเส้นทาง",TEMPLATE_REVISED:"แก้ไขแม่แบบ",CONSIGNMENT_REASSIGNED:"ย้ายพัสดุ"};

/**
 * Daily planning (D225 layout). One service date at a time: the date bar and two-week strip stay in view, the round
 * times and coverage come before the trips, and trips are one table grouped by round. Edits stay on screen until
 * the draft is saved from the unsaved-changes bar; the server checks everything again on save and on publication.
 */
export function PlanningWorkspace({initialDate,initialTab,initialRevision,saved,focusId}:{initialDate?:string;initialTab?:string;initialRevision?:string;saved?:string;focusId?:string}){
 const router=useRouter();
 const startDate=initialDate&&/^\d{4}-\d{2}-\d{2}$/.test(initialDate)&&Number.isFinite(Date.parse(initialDate))?initialDate:today();
 const [confirmation,setConfirmation]=useState<{title:string;description:string;run:()=>Promise<boolean>}|null>(null);
 const [data,setData]=useState<PlanningData|null>(null),[date,setDate]=useState(startDate),[dateText,setDateText]=useState(()=>beDate(startDate)),[tab,setTab]=useState(initialTab??"plan");
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
 const [trips,setTrips]=useState<DraftTrip[]>([]);
 const dirty=false; // All mutations now persist from a dedicated editor or a confirmation dialog.
 const [reason,setReason]=useState(""),[mergeSource,setMergeSource]=useState(""),[mergeTarget,setMergeTarget]=useState("");
 const [moves,setMoves]=useState<Record<string,string>>({}),[confirmed,setConfirmed]=useState(false);
 const [overview,setOverview]=useState<PlanningOverview|null>(null),[stripStart,setStripStart]=useState(()=>weekStart(startDate)),[overviewTick,setOverviewTick]=useState(0);

 const load=useCallback(async(day:string,revision?:string)=>{
  const r=await fetch(`/api/planning?date=${encodeURIComponent(day)}${revision?`&revision=${encodeURIComponent(revision)}`:""}`,{cache:"no-store"}),d=await r.json();
  if(!r.ok)throw Error(d.message??"โหลดแผนไม่สำเร็จ");
  window.history.replaceState(window.history.state,"",`/admin/planning?${new URLSearchParams({date:day,tab:new URLSearchParams(window.location.search).get("tab")??"plan",...(d.selectedRevisionId?{revision:d.selectedRevisionId}:{})})}`);setData(d);setTrips(d.trips);setMoves({});setConfirmed(false);
 },[]);
 useEffect(()=>{let alive=true;
  fetch(`/api/planning?${new URLSearchParams({date:startDate,...(initialRevision?{revision:initialRevision}:{})})}`,{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message);if(alive){setData(d);setTrips(d.trips);if(saved)setMessage(saved==="draft"?`บันทึกเที่ยวแล้ว · หมูและไก่ครบ ${d.eligible.length*6-d.missing.length}/${d.eligible.length*6} ช่อง · ยังไม่เผยแพร่`:"บันทึกสำเร็จ เที่ยวที่สร้างไว้ก่อนหน้านี้ยังใช้ข้อมูลเดิม");requestAnimationFrame(()=>{const mark=sessionStorage.getItem("planning-return");if(mark){sessionStorage.removeItem("planning-return");const position=JSON.parse(mark);if(position.date===startDate)window.scrollTo(0,position.scroll);}if(focusId)document.getElementById(`trip-${focusId}`)?.focus({preventScroll:true});});}})
   .catch(()=>{if(alive){setFailed(true);setMessage("โหลดแผนไม่สำเร็จ กรุณาลองเปิดวันที่อีกครั้ง");}});
  return()=>{alive=false;};},[startDate,initialRevision,saved,focusId]);
 // The two-week strip is refreshed after every save, generation or publication.
 useEffect(()=>{const controller=new AbortController();
  fetch(`/api/planning?overview=${stripStart}&days=14`,{cache:"no-store",signal:controller.signal}).then(r=>r.ok?r.json():null).then(d=>{if(d&&!controller.signal.aborted)setOverview(d);}).catch(()=>{});
  return()=>controller.abort();},[stripStart,overviewTick]);

 const post=async(action:string,input:unknown)=>{
  const r=await fetch("/api/planning",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":newUuid()},body:JSON.stringify({action,input})}),result=await r.json();
  if(!r.ok)throw Error(result.message??"บันทึกไม่สำเร็จ");
  return result;
 };
 const save=async(action:string,input:unknown)=>{setBusy(true);setFailed(false);setMessage("");
  try{
   const result=await post(action,input);
   await load(date,result.revisionId&&["draft","publish","generate"].includes(action)?result.revisionId:undefined);setOverviewTick(n=>n+1);
   setMessage(action==="publish"?"เผยแพร่แผนสำเร็จ พร้อมเก็บประวัติฉบับก่อนหน้า":action==="generate"?`สร้างเที่ยวเพิ่ม ${result.generated} เที่ยว โดยรักษาเที่ยวเดิม`:"บันทึกสำเร็จ ตรวจสอบฉบับล่าสุดได้ด้านล่าง");
   return true;
  }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:"เชื่อมต่อไม่ได้ กรุณาโหลดข้อมูลเพื่อตรวจสอบผลก่อนลองอีกครั้ง");return false;}
  finally{setBusy(false);}
 };
 const runRange=async(action:"generateRange"|"publishRange",input:{from:string;to:string;reason:string}):Promise<RangeResult[]|null>=>{setBusy(true);setFailed(false);setMessage("");
  try{
   const result=await post(action,input) as {results:RangeResult[]};
   await load(date);setOverviewTick(n=>n+1);
   const done=result.results.filter(r=>r.outcome==="done").length,failedCount=result.results.filter(r=>r.outcome==="failed").length;
   setFailed(failedCount>0);setMessage(`${action==="generateRange"?"สร้างร่าง":"เผยแพร่"}สำเร็จ ${done} วัน จาก ${result.results.length} วัน${failedCount?` · ไม่สำเร็จ ${failedCount} วัน ดูรายละเอียดในตารางผล`:""}`);
   return result.results;
  }catch(e){setFailed(true);setMessage(e instanceof Error?e.message:"เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");return null;}
  finally{setBusy(false);}
 };
 const go=async(day:string)=>{setBusy(true);
  try{await load(day);setDate(day);setDateText(beDate(day));window.history.replaceState(window.history.state,"",`/admin/planning?${new URLSearchParams({date:day,tab})}`);setMessage("");setFailed(false);if(day<stripStart||day>addDays(stripStart,13))setStripStart(weekStart(day));}
  catch(e){setFailed(true);setMessage(e instanceof Error?e.message:"โหลดไม่สำเร็จ");}
  finally{setBusy(false);}
 };
 const openDate=(iso?:string)=>{try{void go(iso??isoDate(dateText));}catch(e){setFailed(true);setMessage(e instanceof Error?e.message:"วันที่ไม่ถูกต้อง");}};

 const remember=(day=date,nextTab=tab,revision=data?.selectedRevisionId)=>window.history.replaceState(window.history.state,"",`/admin/planning?${new URLSearchParams({date:day,tab:nextTab,...(revision?{revision}:{})})}`);
 const openEditor=(kind:string,id?:string,copy?:string)=>{if(dirty){setFailed(true);setMessage("บันทึกหรือยกเลิกการรวมเที่ยวก่อนเปิดหน้าแก้ไข");return;}remember();sessionStorage.setItem("planning-return",JSON.stringify({date,scroll:window.scrollY}));router.push(`/admin/planning/edit?${new URLSearchParams({date,kind,...(id?{id}:{}),...(copy?{copy}:{}),...(data?.selectedRevisionId?{revision:data.selectedRevisionId}:{})})}`);};
 const newTrip=()=>openEditor("trip");
 const saveTrips=(next:DraftTrip[],why:string)=>save("draft",{serviceDate:date,expectedVersion:data?.version,trips:next,reason:why});
 const merge=()=>{const source=trips.find(t=>t.tripId===mergeSource),target=trips.find(t=>t.tripId===mergeTarget);
  if(!source||!target||source===target||source.cancelled||target.cancelled||source.kind!==target.kind||source.roundNo!==target.roundNo){setFailed(true);setMessage("เลือกเที่ยวที่ยังไม่ยกเลิก ประเภทและรอบเดียวกันสองเที่ยวเพื่อรวม");return;}
  if(source.plannedLoad||target.plannedLoad){setFailed(true);setMessage("กรุณาตรวจปริมาณรวมและปรับเที่ยวปลายทางด้วยการแก้ไข จากนั้นยกเลิกเที่ยวต้นทาง เพื่อไม่ให้รวมปริมาณต่างหน่วยโดยไม่ตั้งใจ");return;}
  const stops=target.stops.map(s=>({...s,categoryIds:[...s.categoryIds]}));
  for(const s of source.stops){const found=stops.find(t=>t.branchId===s.branchId);if(found)found.categoryIds=[...new Set([...found.categoryIds,...s.categoryIds])];else stops.push(s);}
  setConfirmation({title:"ยืนยันรวมเที่ยว",description:`รวมจุดส่งจาก ${source.code} ไป ${target.code} และยกเลิกเที่ยวต้นทางในฉบับร่างใหม่ ระบบเก็บฉบับเดิมไว้และตรวจความครบถ้วนอีกครั้ง`,run:()=>saveTrips(trips.map(t=>t===source?{...t,cancelled:true}:t===target?{...t,stops}:t),`รวมเที่ยว ${source.code} ไป ${target.code}`)});};
 const canWrite=!!data?.permissions.includes("plan.write"),canPublish=!!data?.permissions.includes("plan.publish"),selected=data?.revisions.find(r=>r.id===data.selectedRevisionId);

 return <><div className="planner-title"><span className="eyebrow">จัดการเดินรถ</span><h1>แผนเดินรถรายวัน</h1><p className="muted">จัดเส้นทาง ตรวจความครบถ้วน และเผยแพร่แผนที่ตรวจสอบย้อนหลังได้</p></div>
 <div className="planner-tabs" role="navigation" aria-label="เมนูวางแผน">{[["plan","แผนรายวัน"],["routes","เส้นทาง"],["templates","แม่แบบประจำ"],["audit","ประวัติการเปลี่ยนแปลง"]].map(([key,label])=><button key={key} disabled={dirty&&tab!==key} onClick={()=>{setTab(key);remember(date,key);}} className={tab===key?"selected":""} aria-pressed={tab===key}>{label}</button>)}</div>
 <div className="planner-sticky">
  {data&&<DayBar data={data} date={date} activeTrips={trips.filter(t=>!t.cancelled).length} dirty={dirty} busy={busy} dateText={dateText} onDateText={setDateText} onOpen={openDate} onGo={day=>void go(day)} today={overview?.today??today()}/>}
  {message&&<p role={failed?"alert":"status"} className={failed?"form-error planner-message":"planner-notice planner-message"}>{message}</p>}{busy&&<p role="status" className="planner-message">กำลังตรวจสอบและบันทึกข้อมูล…</p>}
 </div>
 {!data?<div className="admin-card"><p>{failed?"ยังไม่สามารถโหลดข้อมูลได้":"กำลังโหลดแผนเดินรถ…"}</p>{failed&&<button className="secondary-button" onClick={()=>window.location.reload()}>ลองโหลดอีกครั้ง</button>}</div>:<fieldset disabled={busy} className="planner-fieldset">
 {tab==="plan"&&<>
  <WeekStrip overview={overview} date={date} dirty={dirty} busy={busy} onGo={day=>void go(day)} onShift={n=>setStripStart(addDays(stripStart,n))}/>
  <MissingPlanNotice overview={overview} dirty={dirty} onGo={day=>void go(day)}/>
  <RoundSummary trips={trips} date={date}/>
  <CoverageTable data={data} date={date} dirty={dirty} onEdit={canWrite?t=>openEditor("trip",t.tripId):undefined} onAdd={canWrite?newTrip:undefined}/>

  <section className="admin-card" aria-labelledby="trips-heading">
   <div className="admin-heading section-heading"><div><h2 id="trips-heading">เที่ยวรถของ{thaiDay(date)}</h2><p className="muted">เวลาไทย ๒๔ ชั่วโมง · ดูรายละเอียดในหน้าต่าง · แก้ไขและบันทึกเที่ยวได้ในหน้าเฉพาะ</p></div>
    {canWrite&&<div className="planner-actions"><button type="button" onClick={newTrip} className="secondary-button"><Plus size={17} aria-hidden="true"/>เพิ่มเที่ยว</button>
     <button type="button" className="secondary-button" onClick={()=>void save("generate",{serviceDate:date,expectedVersion:data.version,reason:reason.trim()||"สร้างเที่ยวจากแม่แบบประจำ"})} disabled={dirty}><Wand2 size={17} aria-hidden="true"/>สร้างเที่ยวจากแม่แบบ</button></div>}
   </div>

   {trips.length?<TripTable trips={trips} data={data} date={date} canWrite={canWrite&&!dirty}
     actions={{edit:t=>openEditor("trip",t.tripId),copy:t=>openEditor("trip",undefined,t.tripId),toggleCancel:t=>setConfirmation({title:t.cancelled?"คืนเที่ยวรถ":"ยกเลิกเที่ยวรถ",description:`${t.code} · การเปลี่ยนแปลงจะบันทึกเป็นฉบับร่างใหม่และตรวจหมูไก่อีกครั้ง ฉบับเผยแพร่และประวัติเดิมยังคงอยู่`,run:()=>saveTrips(trips.map(x=>x.tripId===t.tripId?{...x,cancelled:!x.cancelled}:x),`${t.cancelled?"คืน":"ยกเลิก"}เที่ยว ${t.code}`)}),remove:t=>setConfirmation({title:"นำเที่ยวออกจากฉบับร่าง",description:`${t.code} · อาจทำให้บางสาขาขาดหมูหรือไก่ ระบบจะเก็บฉบับก่อนหน้าและตรวจเงื่อนไขการนำออกอีกครั้ง`,run:()=>saveTrips(trips.filter(x=>x.tripId!==t.tripId),`นำเที่ยว ${t.code} ออกจากฉบับร่าง`)})}}/>
    :<div className="planner-empty"><h2>ยังไม่มีเที่ยวในวันนี้</h2><p>เพิ่มเที่ยวด้วยตนเอง หรือสร้างจากแม่แบบที่มีผลในวันที่เลือก</p></div>}
  </section>

  {canWrite&&trips.length>1&&<details className="admin-card planner-details"><summary><h2>รวมเที่ยวในรอบเดียวกัน</h2></summary><p className="muted">คงเที่ยวปลายทาง รวมจุดส่งและหมวดสินค้า แล้วเปลี่ยนเที่ยวต้นทางเป็นยกเลิก ตรวจเวลาและพัสดุที่ได้รับผลกระทบก่อนเผยแพร่</p><div className="form-grid"><label>เที่ยวต้นทาง<select value={mergeSource} onChange={e=>setMergeSource(e.target.value)}><option value="">เลือกเที่ยว</option>{trips.filter(t=>!t.cancelled).map(t=><option key={t.tripId} value={t.tripId}>{t.code}</option>)}</select></label><label>เที่ยวปลายทาง<select value={mergeTarget} onChange={e=>setMergeTarget(e.target.value)}><option value="">เลือกเที่ยว</option>{trips.filter(t=>!t.cancelled).map(t=><option key={t.tripId} value={t.tripId}>{t.code}</option>)}</select></label></div><button type="button" onClick={merge}>รวมเที่ยวในฉบับร่าง</button></details>}

  <section className="admin-card" aria-labelledby="publish-heading"><h2 id="publish-heading">ตรวจและเผยแพร่แผน{thaiDay(date)}</h2>
   <div className="form-grid"><label>ฉบับแผนที่กำลังดู<select value={data.selectedRevisionId??""} disabled={dirty} onChange={async e=>{try{await load(date,e.target.value);}catch{setMessage("โหลดฉบับแผนไม่สำเร็จ");setFailed(true);}}}><option value="" disabled>ยังไม่มีฉบับแผน</option>{data.revisions.map(r=><option key={r.id} value={r.id}>ฉบับ {r.number} — {statusLabels[r.status]}</option>)}</select></label>
    <label>เหตุผลการเปลี่ยนแปลงหรือเผยแพร่<input value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={500} placeholder="ระบุสิ่งที่ปรับและเหตุผล"/></label></div>
   <p className="muted">{data.publishedRevisionId?`ฉบับที่เผยแพร่ใช้งานอยู่: ฉบับ ${data.revisions.find(r=>r.id===data.publishedRevisionId)?.number}`:"วันนี้ยังไม่มีแผนที่เผยแพร่"} · ทุกครั้งที่บันทึกระบบเก็บเป็นฉบับใหม่ ฉบับเก่าดูย้อนหลังได้</p>
   <h3>ผลกระทบและข้อขัดแย้งก่อนเผยแพร่</h3>
   <p>เที่ยวที่เปลี่ยนจากฉบับเผยแพร่: {data.changed.length} เที่ยว • ช่องส่งที่ยังขาด: {data.missing.length} ช่อง • พัสดุที่ต้องจัดเที่ยวใหม่: {data.linked.length} ใบ</p>{data.changed.length>0&&<p className="muted">{data.changed.join(" · ")}</p>}{data.issues.length>0?<ul>{data.issues.map((x,n)=><li key={n}>{x}</li>)}</ul>:<p>ไม่พบปัญหาเบื้องต้นด้านเวลาและการจองรถ ระบบจะตรวจเงื่อนไขทั้งหมดอีกครั้งขณะเผยแพร่</p>}{data.linked.map(c=><div className="stop-editor" key={c.id}><strong>{c.code}</strong><p>{data.branches.find(b=>b.id===c.destinationBranchId)?.name} • {statusLabels[c.status]??"สถานะเดิม"} • รุ่น {c.version}</p><label>เที่ยวและจุดส่งใหม่<select value={moves[c.id]??""} onChange={e=>{setMoves({...moves,[c.id]:e.target.value});setConfirmed(false);}} disabled={!canPublish}><option value="">เลือกปลายทางเพื่อยืนยันการย้าย</option>{trips.filter(t=>!t.cancelled&&t.kind==="BRANCH_DELIVERY").flatMap(t=>t.stops.map((s,n)=>s.branchId===c.destinationBranchId?<option key={`${t.tripId}:${n}`} value={`${t.tripId}:${n+1}`}>{t.code} • รอบ {t.roundNo} • จุด {n+1}</option>:null))}</select></label></div>)}{data.linked.length>0&&<p className="muted">พัสดุที่ขึ้นรถ ออกเดินทาง หรือมีการรับแล้วจะย้ายไม่ได้ การย้ายที่สำเร็จจะรักษาประวัติเดิมและยกเลิกป้ายฉบับเดิม</p>}
   {canPublish&&<>{selected?.status!=="DRAFT"&&<p className="muted">{selected?"ฉบับที่กำลังดูเผยแพร่แล้ว แก้ไขเที่ยวแล้วบันทึกฉบับร่างก่อน จึงจะเผยแพร่ฉบับใหม่ได้":"ยังไม่มีฉบับร่างให้เผยแพร่"}</p>}
    <label className="check-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>ตรวจสอบความครบถ้วน การใช้รถ และผลกระทบต่อพัสดุแล้ว</label>
    <button className="primary-button" disabled={dirty||data.missing.length>0||!confirmed||reason.trim().length<3||selected?.status!=="DRAFT"||data.linked.some(c=>!moves[c.id])} onClick={()=>setConfirmation({title:"ยืนยันเผยแพร่แผน",description:`แผน${thaiDay(date)} · ${trips.filter(t=>!t.cancelled).length} เที่ยว · ${data.eligible.length} สาขา · หมูและไก่ครบทุกช่อง · พัสดุที่ต้องย้าย ${data.linked.length} ใบ · เหตุผล: ${reason} เมื่อยืนยันผู้ใช้งานจะค้นหาเที่ยวตามฉบับนี้ได้`,run:()=>save("publish",{revisionId:data.selectedRevisionId,expectedVersion:data.version,reason,reassignments:data.linked.map(c=>{const [tripId,sequence]=moves[c.id].split(":");return {consignmentId:c.id,expectedVersion:c.version,tripId,stopSequence:Number(sequence)};})})})}>เผยแพร่แผน</button>
    {data.missing.length>0&&<p className="form-error">ยังขาดหมูหรือไก่ {data.missing.length} ช่อง กด “ขาด · ดูวิธีแก้” ในตารางความครบถ้วนด้านบน</p>}{reason.trim().length<3&&<span className="field-hint">ระบุเหตุผลก่อนเผยแพร่</span>}</>}
  </section>

  <RangeTools overview={overview} canWrite={canWrite} canPublish={canPublish} busy={busy} dirty={dirty} run={runRange}/>


 </>}
 {tab==="routes"&&<><div className="admin-heading"><h2>เส้นทางและลำดับจุดส่ง</h2>{data.permissions.includes("route.write")&&<button className="primary-button" onClick={()=>openEditor("route")}>เพิ่มเส้นทาง</button>}</div><div className="planner-trip-grid">{data.routes.map(r=><article className="admin-card" key={r.id}><h3>{r.code} — {r.routeRevision_routeId[0]?.name}</h3><p>{r.active?"เปิดใช้งาน":"เก็บเข้าคลัง"} • รุ่น {r.version}</p>{data.permissions.includes("route.write")&&<button onClick={()=>openEditor("route",r.id)}>แก้ไขเส้นทาง</button>}<details><summary>ฉบับย้อนหลัง {r.routeRevision_routeId.length} ฉบับ</summary>{r.routeRevision_routeId.map(v=><div key={v.id}><p>ฉบับ {v.number} • {v.name} • {beDate(v.effectiveFrom)} ถึง {v.effectiveTo?beDate(v.effectiveTo):"ไม่กำหนด"}</p><ol>{v.routeStop_routeRevisionId.map(s=><li key={s.id}>{data.branches.find(b=>b.id===s.branchId)?.name}</li>)}</ol></div>)}</details></article>)}</div>{!data.routes.length&&<p className="admin-card">ยังไม่มีเส้นทาง</p>}</>}
 {tab==="templates"&&<><div className="admin-heading"><h2>แม่แบบเดินรถประจำ</h2>{data.permissions.includes("template.write")&&<button className="primary-button" onClick={()=>openEditor("template")}>เพิ่มแม่แบบ</button>}</div><div className="planner-trip-grid">{data.templates.map(t=><article className="admin-card" key={t.id}><h3>{t.code}</h3><p>{t.active?"เปิดใช้งาน":"เก็บเข้าคลัง"} • รุ่น {t.version}</p>{data.permissions.includes("template.write")&&<button onClick={()=>openEditor("template",t.id)}>แก้ไขแม่แบบ</button>}<details><summary>ฉบับย้อนหลัง {t.templateRevision_templateId.length} ฉบับ</summary>{t.templateRevision_templateId.map(r=><p key={r.id}>ฉบับ {r.number} • {kindLabels[r.kind]} • รอบ {r.roundNo}<br/>{beDate(r.effectiveFrom)} ถึง {r.effectiveTo?beDate(r.effectiveTo):"ไม่กำหนด"}</p>)}</details></article>)}</div>{!data.templates.length&&<p className="admin-card">ยังไม่มีแม่แบบประจำ</p>}</>}
 {tab==="audit"&&<section className="admin-card"><h2>ประวัติฉบับและเหตุผล</h2><p className="muted">แสดงล่าสุดไม่เกิน ๑๐๐ รายการของแผนวันที่เลือก เส้นทาง และแม่แบบ</p>{data.revisions.map(r=><article key={r.id} className="audit-entry"><strong>ฉบับ {r.number} • {statusLabels[r.status]}</strong><p>สร้างโดย {r.createdBy.displayName} • {localInstant(r.createdAt)}</p>{r.publishedAt&&<p>เผยแพร่โดย {r.publishedBy?.displayName} • {localInstant(r.publishedAt)}</p>}</article>)}{data.audit.map(a=><article key={a.id} className="audit-entry"><strong>{actionLabels[a.action]??"ปรับปรุงข้อมูล"}</strong><p>{a.actor.displayName} • {localInstant(a.createdAt)}</p><p>เหตุผล: {a.reason??"ไม่ได้ระบุในรายการเดิม"}</p>{a.before&&typeof a.before==="object"&&!Array.isArray(a.before)&&"version"in a.before&&<p>รุ่นก่อนแก้ไข: {String(a.before.version)}</p>}{a.after&&typeof a.after==="object"&&!Array.isArray(a.after)&&"version"in a.after&&<p>รุ่นหลังแก้ไข: {String(a.after.version)}</p>}</article>)}{!data.audit.length&&<p>ยังไม่มีประวัติการเปลี่ยนแปลง</p>}</section>}
 </fieldset>}
 {confirmation&&<PlanningDialog title={confirmation.title} busy={busy} onClose={()=>setConfirmation(null)}><p>{confirmation.description}</p>{failed&&message&&<p role="alert" className="form-error">{message}</p>}<div className="dialog-actions"><button className="secondary-button" disabled={busy} onClick={()=>setConfirmation(null)}>กลับไปตรวจสอบ</button><button className="primary-button" disabled={busy} onClick={async()=>{if(await confirmation.run())setConfirmation(null);}}>{busy?"กำลังบันทึก…":"ยืนยันดำเนินการ"}</button></div></PlanningDialog>}
 </>;
}
