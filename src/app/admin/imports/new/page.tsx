import Link from "next/link";
import {requirePageActor} from "@/server/auth/session";
import {getDatabase} from "@/server/persistence/database";
import {listImportBatches} from "@/server/services/imports";
import {importKinds} from "@/server/domain/imports";
import {ImportUpload} from "@/components/import-upload";
import {DomainError} from "@/server/domain/errors";

export const metadata={title:"อัปโหลดเพื่อตรวจสอบ"};
export default async function NewImportPage(){
 const actor=await requirePageActor();
 let list;try{list=await listImportBatches(getDatabase(),actor.id,1);}catch(error){return <div className="admin-card" role="alert"><h1>ไม่สามารถอัปโหลดข้อมูลได้</h1><p>{error instanceof DomainError?error.message:"ระบบไม่พร้อมใช้งาน กรุณาลองใหม่"}</p><Link href="/admin">กลับหน้าจัดการหลังบ้าน</Link></div>;}
 return <div className="admin-edit-shell"><h1>อัปโหลดไฟล์ใหม่</h1><p className="muted">เลือกประเภทและไฟล์ก่อน ระบบจะเปิดหน้าตรวจสอบ ยังไม่เปลี่ยนข้อมูลจริง</p>
 <ol className="admin-process" aria-label="ขั้นตอนนำเข้า"><li aria-current="step">1. อัปโหลด</li><li>2. ตรวจและแก้ไข</li><li>3. ยืนยันนำเข้า</li></ol>
 {list.kinds.length?<section className="admin-card"><ImportUpload kinds={list.kinds.map(k=>({value:k,title:importKinds[k].title}))}/></section>:<p className="admin-card">บัญชีนี้ไม่มีประเภทข้อมูลที่สามารถนำเข้าได้</p>}
 <section className="admin-card"><h2>ดาวน์โหลดไฟล์แม่แบบก่อนเริ่ม</h2><p className="muted">เลือกแม่แบบให้ตรงกับประเภทข้อมูล แล้วกรอกตามหัวคอลัมน์ในไฟล์</p><div className="admin-template-list">{list.kinds.map(k=><div key={k}><strong>{importKinds[k].title}</strong><a download className="secondary-button" href={`/api/imports/template?kind=${k}&format=csv`}>ดาวน์โหลด CSV</a><a download className="secondary-button" href={`/api/imports/template?kind=${k}&format=xlsx`}>ดาวน์โหลด XLSX</a></div>)}</div></section></div>;
}
