"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, BookOpen, Menu, X } from "lucide-react";
import { SessionNavigation } from "./session-navigation";
import wordmark from "@/assets/brand/mooroute-wordmark.png";


export function AppHeader() {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  return <header className="site-header"><div className="container header-inner">
    <Link className="brand" href="/" aria-label="MooRoute | หมูอินเตอร์ หน้าหลัก" onClick={() => setExpanded(false)}>
      <Image src={wordmark} alt="" priority className="brand-wordmark" />
      <span className="brand-tagline">ระบบจัดการเส้นทาง<br />และขนส่งหมูอินเตอร์</span>
    </Link>
    <button className="menu-toggle icon-button" aria-label={expanded ? "ปิดเมนู" : "เปิดเมนู"}
      aria-controls="main-navigation" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      {expanded ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
    </button>
    <nav id="main-navigation" aria-label="เมนูหลัก" className={expanded ? "main-nav expanded" : "main-nav"}>
      <SessionNavigation onNavigate={() => setExpanded(false)} />
      <Link href="/guide" className="guide-link" aria-current={pathname === "/guide" ? "page" : undefined} onClick={() => setExpanded(false)}><BookOpen size={17} aria-hidden="true" />คู่มือ<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </nav>
  </div></header>;
}
