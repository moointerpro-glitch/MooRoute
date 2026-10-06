import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { authConfiguration } from "@/server/auth/config";
import { DomainError, requireCondition } from "@/server/domain/errors";
import { TABULAR_LIMITS, parseTabular } from "@/server/domain/tabular";
import { stageImport } from "@/server/services/imports";

/** Stages a CSV/XLSX file. Nothing is applied to master or schedule data until an explicit commit. */
export async function POST(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers);
    requireCondition(request.headers.get("origin") === authConfiguration(process.env).baseURL, "FORBIDDEN", "คำขอไม่ถูกต้อง กรุณาเปิดหน้าเว็บใหม่");
    requireCondition(Number(request.headers.get("content-length") ?? 0) <= TABULAR_LIMITS.maxBytes + 64 * 1024, "INVALID_FILE", "ไฟล์มีขนาดเกิน ๒ เมกะไบต์");
    const form = await request.formData().catch(() => { throw new DomainError("INVALID_FILE", "ไม่พบไฟล์"); });
    const file = form.get("file");
    requireCondition(file instanceof File && file.size > 0, "INVALID_FILE", "กรุณาเลือกไฟล์ CSV หรือ XLSX");
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Parsing happens before any database work; PDFs and images are refused as reference-only material.
    const table = parseTabular(bytes, file.name);
    const result = await stageImport(getDatabase(), actor.id, request.headers.get("Idempotency-Key") ?? "", { kind: String(form.get("kind") ?? ""), sourceName: file.name, sourceEdition: String(form.get("edition") ?? ""), bytes, table });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
