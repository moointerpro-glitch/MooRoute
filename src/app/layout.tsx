import type { Metadata, Viewport } from "next";
import Image from "next/image";
import { AppHeader } from "@/components/app-header";
import banner from "@/assets/brand/moointer-mooroute-banner.png";
import "@fontsource/noto-sans-thai/thai-400.css";
import "@fontsource/noto-sans-thai/thai-500.css";
import "@fontsource/noto-sans-thai/thai-600.css";
import "@fontsource/noto-sans-thai/thai-700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MooRoute | หมูอินเตอร์", template: "%s | MooRoute | หมูอินเตอร์" },
  description: "ระบบจัดการเส้นทางและขนส่งหมูอินเตอร์",
  applicationName: "ระบบจัดการเส้นทางและขนส่งหมูอินเตอร์",
  appleWebApp: { title: "MooRoute | หมูอินเตอร์" },
  robots: { index: false, follow: false },
};
// Brand navy from the supplied logo, used by mobile browsers for the address bar.
export const viewport: Viewport = { themeColor: "#1b3044" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>
    <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหา</a>
    <AppHeader />
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="site-footer"><div className="container footer-inner">
      <span className="footer-brand"><Image src={banner} alt="MooRoute | หมูอินเตอร์" />ระบบจัดการเส้นทางและขนส่งหมูอินเตอร์</span><span>วันและเวลาประเทศไทย · แสดงปี พ.ศ.</span>
    </div></footer>
  </body></html>;
}
