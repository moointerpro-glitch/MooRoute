import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { getDatabase } from "../persistence/database";
import { DomainError } from "../domain/errors";

export async function actorFromHeaders(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) throw new DomainError("UNAUTHENTICATED", "กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const user = await getDatabase().user.findUnique({ where: { id: session.user.id } });
  if (!user?.active) throw new DomainError("UNAUTHENTICATED", "บัญชีนี้ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล");
  return { id: user.id, name: user.displayName };
}
export async function requirePageActor() {
  try { return await actorFromHeaders(await headers()); }
  catch { redirect("/login"); }
}
