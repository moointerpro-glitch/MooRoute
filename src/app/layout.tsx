import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import "@fontsource/noto-sans-thai/thai-400.css";
import "@fontsource/noto-sans-thai/thai-500.css";
import "@fontsource/noto-sans-thai/thai-600.css";
import "@fontsource/noto-sans-thai/thai-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ค้นหาเส้นทางเดินรถ | หมูอินเตอร์", template: "%s | หมูอินเตอร์" },
  description: "ระบบค้นหารอบรถและฝากของส่งสาขา หมูอินเตอร์",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>
    <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหา</a>
    <AppHeader />
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="site-footer"><div className="container footer-inner">
      <span>หมูอินเตอร์ · ระบบขนส่งสาขา</span><span>วันและเวลาประเทศไทย · แสดงปี พ.ศ.</span>
    </div></footer>
  </body></html>;
}
