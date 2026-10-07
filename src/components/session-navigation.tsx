"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Building2, History, ListOrdered, PackagePlus, Search, Settings } from "lucide-react";
import type { NavigationAccess } from "@/lib/navigation";
import type { ProfileSummary } from "./profile-menu";

export type Session = NavigationAccess & { name: string; profile: ProfileSummary };

/** Session for the header: menu access and profile. Refreshed on navigation; null when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined), pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then((r) => r.ok ? r.json() : null).then((d) => { if (!controller.signal.aborted) setSession(d); })
      .catch(() => { if (!controller.signal.aborted) setSession(null); });
    return () => controller.abort();
  }, [pathname]);
  return session;
}

export function SessionNavigation({ session, onNavigate }: { session: Session | null | undefined; onNavigate?: () => void }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "ค้นหาเส้นทาง", icon: Search, allowed: !session || session.canSearch, active: pathname === "/" },
    { href: "/trips", label: "รอบรถทั้งหมด", icon: ListOrdered, allowed: session?.canSearch, active: pathname.startsWith("/trips") },
    { href: "/branches", label: "สาขาทั้งหมด", icon: Building2, allowed: session?.canSearch, active: pathname.startsWith("/branches") },
    { href: "/consign", label: "ฝากของส่งรถ", icon: PackagePlus, allowed: session?.canConsign, active: pathname === "/consign" },
    { href: "/consignments", label: "ประวัติฝากส่ง", icon: History, allowed: session?.canHistory, active: pathname.startsWith("/consignments") },
    { href: "/admin", label: "จัดการหลังบ้าน", icon: Settings, allowed: session?.canOpenBackend, active: pathname.startsWith("/admin") },
  ];
  return <>{links.filter((l) => l.allowed).map(({ href, label, icon: Icon, active }) =>
    <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={onNavigate}><Icon size={17} aria-hidden="true" />{label}</Link>)}
    {session === null && <Link href={pathname !== "/login" ? `/login?next=${encodeURIComponent(pathname)}` : "/login"} onClick={onNavigate}>เข้าสู่ระบบ</Link>}
  </>;
}
