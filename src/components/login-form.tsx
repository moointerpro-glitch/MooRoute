"use client";
import { useState } from "react";
export function LoginForm(){
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  return <form className="admin-form" onSubmit={async event=>{event.preventDefault();setBusy(true);setMessage("");const form=new FormData(event.currentTarget);
    try{const r=await fetch("/api/auth/sign-in/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:form.get("email"),password:form.get("password"),rememberMe:false})});const data=await r.json();if(!r.ok){setMessage(data.message??"เข้าสู่ระบบไม่สำเร็จ");return;}window.location.assign("/admin");}catch{setMessage("เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง");}finally{setBusy(false);}}}>
    <label>อีเมลบัญชีผู้ใช้งาน<input name="email" type="email" required autoComplete="username" maxLength={191}/></label>
    <label>รหัสผ่าน<input name="password" type="password" required autoComplete="current-password" maxLength={128}/></label>
    {message&&<p role="alert" className="form-error">{message}</p>}
    <button className="primary-button" disabled={busy}>{busy?"กำลังเข้าสู่ระบบ…":"เข้าสู่ระบบ"}</button>
    <p className="muted">บัญชีสร้างโดยผู้ดูแลระบบ หากลืมรหัสผ่านกรุณาติดต่อผู้ดูแล</p>
  </form>;
}
