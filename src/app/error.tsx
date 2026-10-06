"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="container message-page" role="alert"><h1>ไม่สามารถแสดงหน้านี้ได้</h1><p>กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ</p><button className="primary-button" onClick={reset}>ลองใหม่</button></div>;
}
