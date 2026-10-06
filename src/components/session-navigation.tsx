"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
type Session = { name: string; canOpenBackend: boolean } | null;
export function SessionNavigation() {
  const [session, setSession] = useState<Session | undefined>(undefined), pathname = usePathname();
  useEffect(() => { void fetch("/api/session", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((d) => setSession(d)).catch(() => setSession(null)); }, [pathname]);
  if (session === undefined) return null;
  if (!session) return <Link href={pathname && pathname !== "/login" ? `/login?next=${encodeURIComponent(pathname)}` : "/login"}>เข้าสู่ระบบ</Link>;
  return <>{session.canOpenBackend && <Link href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined}>จัดการหลังบ้าน</Link>}{!pathname.startsWith("/admin") && <span className="nav-logout"><LogoutButton /></span>}</>;
}
