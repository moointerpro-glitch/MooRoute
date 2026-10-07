import Link from "next/link";
import { requirePageActor } from "@/server/auth/session";
import { Settings } from "lucide-react";
// The signed-in name, account type and sign-out live in the header profile menu (D221).
export default async function AdminLayout({children}:{children:React.ReactNode}){
  await requirePageActor();return <div className="container admin-page"><div className="admin-heading"><Link href="/admin" className="eyebrow admin-eyebrow"><Settings size={15} aria-hidden="true" />จัดการหลังบ้าน</Link></div>{children}</div>;
}
