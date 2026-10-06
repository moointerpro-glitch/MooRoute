import type { MetadataRoute } from "next";

/** Install metadata for phones and tablets ("เพิ่มไปยังหน้าจอหลัก"); icons come from the supplied MOOROUTE pin logo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MOOROUTE หมูอินเตอร์ — ระบบเส้นทางเดินรถและฝากส่งสาขา",
    short_name: "MOOROUTE",
    description: "ค้นหารอบรถ วางแผนเดินรถ และฝากของส่งสาขา หมูอินเตอร์",
    lang: "th",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1b3044",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
