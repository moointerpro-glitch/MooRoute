import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { getDatabase } from "../persistence/database";
import { DomainError } from "../domain/errors";
import { logUnexpected } from "../logging";

export async function actorFromHeaders(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) throw new DomainError("UNAUTHENTICATED", "กรุณาเข้าสู่ระบบก่อนใช้งาน");
  const user = await getDatabase().user.findUnique({ where: { id: session.user.id } });
  if (!user?.active) throw new DomainError("UNAUTHENTICATED", "บัญชีนี้ไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล");
  return { id: user.id, name: user.displayName };
}
// A missing or inactive session is expected; anything else (for example an unreachable database) is
// logged for operators before the visitor is treated as signed out.
const reportUnlessSignedOut = (error: unknown) => { if (!(error instanceof DomainError)) logUnexpected("page.session_unavailable", error); };
/** Signed-in actor, or null for visitors. Never throws. */
export async function optionalActor(requestHeaders: Headers) {
  try { return await actorFromHeaders(requestHeaders); }
  catch (error) { reportUnlessSignedOut(error); return null; }
}
export async function requirePageActor() {
  // headers() stays outside the try block: during a build it signals dynamic rendering by throwing.
  const requestHeaders = await headers();
  let actor;
  try { actor = await actorFromHeaders(requestHeaders); }
  catch (error) { reportUnlessSignedOut(error); }
  // redirect() works by throwing, so it stays outside the try block.
  if (!actor) redirect("/login");
  return actor;
}
