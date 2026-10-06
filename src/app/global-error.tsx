"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="th"><body style={{ fontFamily: "Tahoma, sans-serif", margin: "3rem", lineHeight: 1.8 }}><h1>ไม่สามารถเปิดระบบได้ชั่วคราว</h1><p>กรุณาลองใหม่ หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ</p><button style={{ padding: "12px 24px" }} onClick={reset}>ลองใหม่</button></body></html>;
}
