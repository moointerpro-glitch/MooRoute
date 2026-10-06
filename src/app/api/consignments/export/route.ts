import { actorFromHeaders } from "@/server/auth/session";
import { getDatabase } from "@/server/persistence/database";
import { safeFailure } from "@/server/http";
import { listConsignments } from "@/server/services/consignments";
import { parseHistoryFilter, statusText, unitText } from "@/lib/consignment-format";
import { beDate } from "@/lib/trip-format";

// Formula-prefix escaping prevents spreadsheet injection from user-entered item names.
const cell = (v: unknown) => `"${String(v ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
export async function GET(request: Request) {
  try {
    const actor = await actorFromHeaders(request.headers);
    const result = await listConsignments(getDatabase(), actor.id, { ...parseHistoryFilter(new URL(request.url).searchParams), page: 1 }, { export: true });
    const header = ["เลขที่ฝากส่ง", "สถานะ", "วันที่สร้าง", "วันที่ต้องการส่ง", "สาขาปลายทาง", "คลังต้นทาง", "ผู้ฝาก", "รายการสิ่งของ", "จำนวนหีบห่อ", "รอบรถ", "ทะเบียนรถ"];
    const rows = result.rows.map((r) => [r.code, statusText(r.status), beDate(r.createdAt.slice(0, 10)), r.requestedServiceDate ? beDate(r.requestedServiceDate) : "", `${r.branch.code} ${r.branch.name}`, r.warehouse, r.requester,
      r.items.map((i) => `${i.name} ${i.quantity} ${unitText(i.unit)}`).join("; "), r.packageCount, r.trip ? `${r.trip.code}${r.trip.roundNo ? ` รอบ ${r.trip.roundNo}` : ""}` : "", r.trip?.plate ?? ""]);
    const csv = "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="consignments.csv"`, "Cache-Control": "no-store" } });
  } catch (error) { return safeFailure(error); }
}
