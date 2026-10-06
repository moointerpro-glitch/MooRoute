import { createHash } from "node:crypto";
import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { authConfiguration } from "@/server/auth/config";
import { DomainError, requireCondition } from "@/server/domain/errors";
import { ATTACHMENT_LIMITS, addAttachment, sniffContentType } from "@/server/services/consignments";
import { removePrivateFile, storePrivateFile } from "@/server/storage/attachments";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let storedKey: string | null = null;
  try {
    const actor = await actorFromHeaders(request.headers), { id } = await params;
    requireCondition(request.headers.get("origin") === authConfiguration(process.env).baseURL, "FORBIDDEN", "คำขอไม่ถูกต้อง กรุณาเปิดหน้าเว็บใหม่");
    requireCondition(Number(request.headers.get("content-length") ?? 0) <= ATTACHMENT_LIMITS.maxBytes + 64 * 1024, "INVALID_FILE", "ไฟล์มีขนาดเกิน ๑๐ เมกะไบต์");
    const form = await request.formData().catch(() => { throw new DomainError("INVALID_FILE", "ไม่พบไฟล์แนบ"); });
    const file = form.get("file");
    requireCondition(file instanceof File && file.size > 0, "INVALID_FILE", "กรุณาเลือกไฟล์ที่ต้องการแนบ");
    requireCondition(file.size <= ATTACHMENT_LIMITS.maxBytes, "INVALID_FILE", "ไฟล์มีขนาดเกิน ๑๐ เมกะไบต์");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = sniffContentType(bytes);
    requireCondition(contentType, "INVALID_FILE", "รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF ที่เป็นไฟล์จริง");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    // The file is written before the transaction; any failure or replay removes the unused copy.
    storedKey = await storePrivateFile(bytes);
    const result = await addAttachment(getDatabase(), actor.id, request.headers.get("Idempotency-Key") ?? "", { consignmentId: id, displayName: file.name, contentType, sizeBytes: bytes.length, sha256, storageKey: storedKey });
    if (result.storageKey !== storedKey) await removePrivateFile(storedKey);
    storedKey = null;
    return Response.json({ id: result.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (storedKey) await removePrivateFile(storedKey).catch(() => undefined);
    return safeFailure(error);
  }
}
