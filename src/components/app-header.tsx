"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, BookOpen, Building2, ListOrdered, Menu, Route, Search, X } from "lucide-react";
import { SessionNavigation } from "./session-navigation";

const links = [
  { href: "/", label: "ค้นหาเส้นทาง", icon: Search, active: (p: string) => p === "/" },
  { href: "/trips", label: "รอบรถทั้งหมด", icon: ListOrdered, active: (p: string) => p.startsWith("/trips") },
  { href: "/branches", label: "สาขาทั้งหมด", icon: Building2, active: (p: string) => p.startsWith("/branches") },
];

export function AppHeader() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  return <header className="site-header"><div className="container header-inner">
    <Link className="brand" href="/" aria-label="หมูอินเตอร์ หน้าหลัก" onClick={() => setExpanded(false)}>
      <span className="brand-symbol"><Route size={28} strokeWidth={2.3} aria-hidden="true" /></span>
      <span><strong>หมูอินเตอร์</strong><small>Moointer · เชื่อมทุกสาขา ทุกวัน</small></span>
    </Link>
    <button className="menu-toggle icon-button" aria-label={expanded ? "ปิดเมนู" : "เปิดเมนู"}
      aria-controls="main-navigation" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
    </button>
    <nav id="main-navigation" aria-label="เมนูหลัก" className={expanded ? "main-nav expanded" : "main-nav"}>
      {links.map((item) => <Link key={item.href} href={item.href} aria-current={item.active(pathname) ? "page" : undefined} onClick={() => setExpanded(false)}><item.icon size={17} aria-hidden="true" />{item.label}</Link>)}
      {["ฝากของส่งรถ", "ประวัติฝากส่ง"].map((label) =>
        <span className="nav-unavailable" aria-disabled="true" key={label} title="ยังไม่เปิดให้บริการ">{label}<span className="sr-only"> ยังไม่เปิดให้บริการ</span></span>)}
      <SessionNavigation />
      <Link href="/guide" className="guide-link" aria-current={pathname === "/guide" ? "page" : undefined} onClick={() => setExpanded(false)}><BookOpen size={17} aria-hidden="true" />คู่มือ<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </nav>
  </div></header>;
}
