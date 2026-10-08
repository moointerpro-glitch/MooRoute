"use client";

import {useEffect,useRef,useState,type ReactNode} from "react";
import {useRouter} from "next/navigation";
import {PlanningDialog as AdminDialog} from "./planning-dialog";
export {PlanningDialog as AdminDialog} from "./planning-dialog";

/** Form data stays in memory only; never put account fields or passwords in browser storage. */
export function AdminFormBoundary({children,dirty,busy,onDirty,backHref}:{children:ReactNode;dirty:boolean;busy:boolean;onDirty:()=>void;backHref:string}){
 const router=useRouter(),[leave,setLeave]=useState<string|null>(null),bypass=useRef(false),restoring=useRef(false);
 useEffect(()=>{
  const unload=(e:BeforeUnloadEvent)=>{if((dirty||busy)&&!bypass.current){e.preventDefault();e.returnValue="";}};
  const click=(e:MouseEvent)=>{const a=(e.target as Element).closest?.("a[href]");if(!(a instanceof HTMLAnchorElement)||a.target==="_blank"||a.hasAttribute("download")||e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey||e.button!==0||bypass.current)return;
   if(dirty||busy){e.preventDefault();e.stopPropagation();if(!busy)setLeave(a.href);}};
  const pop=(e:PopStateEvent)=>{if(restoring.current){restoring.current=false;e.stopImmediatePropagation();return;}
   if((dirty||busy)&&!bypass.current){e.stopImmediatePropagation();restoring.current=true;window.history.forward();if(!busy)setLeave(backHref);}};
  window.addEventListener("beforeunload",unload);document.addEventListener("click",click,true);window.addEventListener("popstate",pop,true);
  return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",click,true);window.removeEventListener("popstate",pop,true);};
 },[dirty,busy,backHref]);
 return <div className="admin-form-boundary" onChangeCapture={onDirty} onPasteCapture={onDirty} onClickCapture={e=>{const b=(e.target as Element).closest("button");if(b&&(b.classList.contains("calendar-day")||/^(ใช้เวลา|ล้างเวลา)/.test(b.textContent??"")))onDirty();}}>
  {children}
  {leave&&<AdminDialog title="มีข้อมูลที่ยังไม่บันทึก" onClose={()=>setLeave(null)}><p>ข้อมูลที่แก้ไขในหน้านี้ยังไม่ได้บันทึก ต้องการแก้ไขต่อหรือออกจากหน้านี้?</p><div className="dialog-actions"><button className="primary-button" onClick={()=>setLeave(null)}>แก้ไขต่อ</button><button className="secondary-button" onClick={()=>{bypass.current=true;const url=new URL(leave,window.location.origin);if(url.origin===window.location.origin)router.replace(url.pathname+url.search+url.hash);else window.location.assign(url.href);}}>ออกโดยไม่บันทึก</button></div></AdminDialog>}
 </div>;
}
