import { getAuth } from "@/server/auth/auth";
import { authConfiguration } from "@/server/auth/config";

async function handler(request: Request) {
  try {
    const config = authConfiguration(process.env);
    const path = new URL(request.url).pathname.replace("/api/auth", "");
    const allowed = request.method === "GET" ? ["/get-session"] : ["/sign-in/email", "/sign-out"];
    if (!allowed.includes(path)) return Response.json({ code: "NOT_AVAILABLE", message: "ไม่เปิดให้ใช้งานรายการนี้" }, { status: 404 });
    if (request.method === "POST" && request.headers.get("origin") !== config.baseURL) return Response.json({ code: "FORBIDDEN", message: "คำขอไม่ถูกต้อง กรุณาเปิดหน้าเว็บใหม่" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({message:"ข้อมูลมีขนาดเกินกำหนด"},{status:413});
    const safeHeaders = new Headers(request.headers);
    // This local-only deployment has a single trusted peer. Never trust forwarded client IPs.
    safeHeaders.set("x-moointer-peer", "127.0.0.1");
    const body = request.method === "POST" ? await request.text() : undefined;
    if (body && body.length > 4096) return Response.json({message:"ข้อมูลมีขนาดเกินกำหนด"},{status:413});
    const response = await getAuth().handler(new Request(request.url, { method: request.method, headers: safeHeaders, body }));
    if (!response.ok) return Response.json({ code: response.status === 429 ? "TOO_MANY_ATTEMPTS" : "AUTH_FAILED", message: response.status === 429 ? "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่" : "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบบัญชีและรหัสผ่าน" }, { status: response.status, headers: { "Cache-Control": "no-store" } });
    response.headers.set("Cache-Control", "no-store"); return response;
  } catch { return Response.json({ code: "AUTH_UNAVAILABLE", message: "ระบบเข้าสู่ระบบยังไม่พร้อม กรุณาติดต่อผู้ดูแล" }, { status: 503 }); }
}
export const GET=handler;
export const POST=handler;
