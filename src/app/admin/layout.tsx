import { AdminHomeLink } from "@/components/admin-home-link";
import { requirePageActor } from "@/server/auth/session";
// The signed-in name, account type and sign-out live in the header profile menu (D221).
export default async function AdminLayout({children}:{children:React.ReactNode}){
  await requirePageActor();return <div className="container admin-page"><div className="admin-heading"><AdminHomeLink /></div>{children}</div>;
}
