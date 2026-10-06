"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, BookOpen, Building2, History, ListOrdered, Menu, PackagePlus, Search, X } from "lucide-react";
import { SessionNavigation } from "./session-navigation";
import wordmark from "@/assets/brand/mooroute-wordmark.png";

const links = [
  { href: "/", label: "ค้นหาเส้นทาง", icon: Search, active: (p: string) => p === "/" },
  { href: "/trips", label: "รอบรถทั้งหมด", icon: ListOrdered, active: (p: string) => p.startsWith("/trips") },
  { href: "/branches", label: "สาขาทั้งหมด", icon: Building2, active: (p: string) => p.startsWith("/branches") },
  { href: "/consign", label: "ฝากของส่งรถ", icon: PackagePlus, active: (p: string) => p.startsWith("/consign") && !p.startsWith("/consignments") },
  { href: "/consignments", label: "ประวัติฝากส่ง", icon: History, active: (p: string) => p.startsWith("/consignments") },
];

export function AppHeader() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  return <header className="site-header"><div className="container header-inner">
    <Link className="brand" href="/" aria-label="MOOROUTE หมูอินเตอร์ หน้าหลัก" onClick={() => setExpanded(false)}>
      <Image src={wordmark} alt="" priority className="brand-wordmark" />
      <span className="brand-tagline">ระบบเส้นทางเดินรถ<br />และฝากส่งสาขา</span>
    </Link>
    <button className="menu-toggle icon-button" aria-label={expanded ? "ปิดเมนู" : "เปิดเมนู"}
      aria-controls="main-navigation" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
    </button>
    <nav id="main-navigation" aria-label="เมนูหลัก" className={expanded ? "main-nav expanded" : "main-nav"}>
      {links.map((item) => <Link key={item.href} href={item.href} aria-current={item.active(pathname) ? "page" : undefined} onClick={() => setExpanded(false)}><item.icon size={17} aria-hidden="true" />{item.label}</Link>)}
      <SessionNavigation />
      <Link href="/guide" className="guide-link" aria-current={pathname === "/guide" ? "page" : undefined} onClick={() => setExpanded(false)}><BookOpen size={17} aria-hidden="true" />คู่มือ<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </nav>
  </div></header>;
}
