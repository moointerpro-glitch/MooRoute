"use client";
import {useState} from "react";

/** Signs out and returns to the login page; resolves to a Thai error message when it fails. */
export async function signOut(): Promise<string> {
  try { const r=await fetch("/api/auth/sign-out",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}); if(r.ok){window.location.assign("/login");return "";} return "ออกจากระบบไม่สำเร็จ กรุณาลองใหม่"; }
  catch { return "เชื่อมต่อไม่ได้ กรุณาลองใหม่"; }
}
export function LogoutButton(){const [message,setMessage]=useState("");return <><button className="secondary-button" onClick={async()=>setMessage(await signOut())}>ออกจากระบบ</button>{message&&<span role="alert">{message}</span>}</>;}
