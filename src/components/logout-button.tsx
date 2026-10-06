"use client";
import {useState} from "react";
export function LogoutButton(){const [message,setMessage]=useState("");return <><button className="secondary-button" onClick={async()=>{try{const r=await fetch("/api/auth/sign-out",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if(r.ok)window.location.assign("/login");else setMessage("ออกจากระบบไม่สำเร็จ กรุณาลองใหม่");}catch{setMessage("เชื่อมต่อไม่ได้ กรุณาลองใหม่");}}}>ออกจากระบบ</button>{message&&<span role="alert">{message}</span>}</>;}
