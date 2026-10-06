"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
export function SessionNavigation(){const [signedIn,setSignedIn]=useState(false);useEffect(()=>{void fetch("/api/session",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>setSignedIn(!!d?.canOpenBackend)).catch(()=>{});},[]);return <Link href={signedIn?"/admin":"/login"}>{signedIn?"จัดการหลังบ้าน":"เข้าสู่ระบบ"}</Link>;}
