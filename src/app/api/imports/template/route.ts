import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { requireCondition } from "@/server/domain/errors";
import { isImportKind, templateRows } from "@/server/domain/imports";
import { toCsv, writeXlsx } from "@/server/domain/tabular";
import { listImportBatches } from "@/server/services/imports";

export async function GET(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers), url = new URL(request.url), kind = url.searchParams.get("kind"), format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
    requireCondition(isImportKind(kind), "INVALID_INPUT", "ประเภทข้อมูลไม่ถูกต้อง");
    // Same authorization as the import screen; templates reveal only approved field names.
    const { kinds } = await listImportBatches(getDatabase(), actor.id, 1);
    requireCondition(kinds.includes(kind), "FORBIDDEN", "คุณไม่มีสิทธิ์นำเข้าข้อมูลประเภทนี้");
    const rows = templateRows(kind);
    const body = format === "xlsx" ? writeXlsx(rows) : toCsv(rows);
    return new Response(body, { headers: { "Content-Type": format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="moointer-import-${kind}.${format}"`, "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
