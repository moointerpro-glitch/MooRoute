import { actorFromHeaders } from "@/server/auth/session";
import { getAuth } from "@/server/auth/auth";
import { getDatabase } from "@/server/persistence/database";
import { readWriteBody, safeFailure } from "@/server/http";
import { DomainError, requireCondition } from "@/server/domain/errors";
import { myAccount, updateMyProfile } from "@/server/services/account";

/** The signed-in person's own account: read, update contact defaults, change password (D220). */
export async function GET(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers);
    return Response.json(await myAccount(getDatabase(), actor.id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers), body = await readWriteBody(request, 2000);
    requireCondition(body && typeof body === "object" && body.input && typeof body.input === "object", "INVALID_INPUT", "ข้อมูลไม่ถูกต้อง");
    if (body.action === "profile") {
      return Response.json(await updateMyProfile(getDatabase(), actor.id, request.headers.get("Idempotency-Key") ?? "", body.input), { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "password") {
      const { currentPassword, newPassword } = body.input as { currentPassword?: unknown; newPassword?: unknown };
      requireCondition(typeof currentPassword === "string" && currentPassword.length > 0 && currentPassword.length <= 128, "INVALID_INPUT", "กรุณากรอกรหัสผ่านปัจจุบัน");
      requireCondition(typeof newPassword === "string" && newPassword.length >= 12 && newPassword.length <= 128, "WEAK_PASSWORD", "รหัสผ่านใหม่ต้องยาว ๑๒ ถึง ๑๒๘ ตัวอักษร");
      requireCondition(newPassword !== currentPassword, "WEAK_PASSWORD", "รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม");
      try {
        // Other devices are signed out; this session stays signed in.
        await getAuth().api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: true }, headers: request.headers });
      } catch (error) {
        const status = (error as { statusCode?: number; status?: number }).statusCode ?? 0;
        if (status >= 400 && status < 500) throw new DomainError("PASSWORD_REJECTED", "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบรหัสผ่านปัจจุบัน");
        throw error;
      }
      await getDatabase().auditLog.create({ data: { actorId: actor.id, action: "PASSWORD_CHANGED", entityType: "User", entityId: actor.id, reason: "Self-service password change", after: { otherSessionsRevoked: true } } });
      return Response.json({ changed: true }, { headers: { "Cache-Control": "no-store" } });
    }
    throw new DomainError("INVALID_INPUT", "การดำเนินการไม่ถูกต้อง");
  } catch (error) { return safeFailure(error); }
}
