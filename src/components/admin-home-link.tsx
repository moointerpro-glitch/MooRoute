"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";

export function AdminHomeLink() {
  const pathname = usePathname();
  const atHome = pathname === "/admin" || pathname === "/admin/";
  const Icon = atHome ? Settings : ArrowLeft;
  return <Link href="/admin" className="eyebrow admin-eyebrow" aria-current={atHome ? "page" : undefined}><Icon size={15} aria-hidden="true" />จัดการหลังบ้าน</Link>;
}
