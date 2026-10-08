"use client";
import Link from "next/link";
import {useEffect,type ReactNode} from "react";

/** Remember position only, never the row contents. Filters remain in the return URL. */
export function AdminListLink({href,children,className}:{href:string;children:ReactNode;className?:string}){
 return <Link href={href} className={className} onClick={()=>{try{sessionStorage.setItem("admin-list-position",JSON.stringify({path:window.location.pathname,search:window.location.search,scroll:window.scrollY}));}catch{}}}>{children}</Link>;
}
export function RestoreAdminList(){
 useEffect(()=>{try{const raw=sessionStorage.getItem("admin-list-position");if(!raw)return;const saved=JSON.parse(raw);if(saved.path===window.location.pathname){sessionStorage.removeItem("admin-list-position");requestAnimationFrame(()=>window.scrollTo(0,Number(saved.scroll)||0));}}catch{}},[]);
 return null;
}
