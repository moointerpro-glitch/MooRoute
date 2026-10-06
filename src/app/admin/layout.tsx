import Link from "next/link";
import { requirePageActor } from "@/server/auth/session";
import { Settings } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
export default async function AdminLayout({children}:{children:React.ReactNode}){
  const actor=await requirePageActor();return <div className="container admin-page"><div className="admin-heading"><div><Link href="/admin" className="eyebrow admin-eyebrow"><Settings size={15} aria-hidden="true" />จัดการหลังบ้าน</Link><p className="muted">{actor.name}</p></div><LogoutButton/></div>{children}</div>;
}
