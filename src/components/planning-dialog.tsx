"use client";

import {useEffect, useId, useRef, type ReactNode} from "react";
import {X} from "lucide-react";

/** Native modal semantics provide focus containment and make the background inert. */
export function PlanningDialog({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}) {
 const ref=useRef<HTMLDialogElement>(null), titleId=useId();
 useEffect(()=>{const dialog=ref.current!, trigger=document.activeElement as HTMLElement|null;
  const overflow=document.body.style.overflow;document.body.style.overflow="hidden";dialog.showModal();
  return()=>{dialog.close();document.body.style.overflow=overflow;if(trigger?.isConnected)trigger.focus({preventScroll:true});};
 },[]);
 return <dialog ref={ref} className="planning-dialog" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <header><h2 id={titleId}>{title}</h2><button type="button" className="secondary-button" aria-label="ปิดหน้าต่าง" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true"/></button></header>
  <div className="planning-dialog-body">{children}</div>
 </dialog>;
}
