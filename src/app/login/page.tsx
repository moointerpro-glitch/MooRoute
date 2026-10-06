import Image from "next/image";
import { LoginForm } from "@/components/login-form";
import stacked from "@/assets/brand/mooroute-stacked.png";
import { safeNext } from "@/lib/trip-format";
export default async function LoginPage({searchParams}:{searchParams:Promise<{next?:string}>}){const {next}=await searchParams;return <section className="container admin-page"><div className="admin-card login-card"><Image src={stacked} alt="MOOROUTE หมูอินเตอร์" priority className="brand-mark-stacked"/><p className="eyebrow">หมูอินเตอร์ · สำหรับเจ้าหน้าที่</p><h1>เข้าสู่ระบบ</h1><p className="muted">ใช้บัญชีที่ได้รับสิทธิ์เพื่อค้นหารอบรถ จัดการข้อมูล และปฏิบัติงาน</p><LoginForm next={safeNext(next)}/></div></section>;}
