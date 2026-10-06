import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";

export class DatabaseReadinessError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export async function checkDatabaseReadiness(database: PrismaClient) {
  const rows = await database.$queryRaw<Array<{
    version: string; vendor: string; engine: string; charset: string; collation: string;
  }>>`SELECT VERSION() AS version, @@version_comment AS vendor,
       @@default_storage_engine AS engine, @@character_set_database AS charset,
       @@collation_database AS collation`;
  const info = rows[0];
  if (!info || /mariadb/i.test(info.version + info.vendor) || !/^8\.4\./.test(info.version)) {
    throw new DatabaseReadinessError("MYSQL_8_4_REQUIRED");
  }
  if (info.engine.toLowerCase() !== "innodb" || info.charset !== "utf8mb4" || info.collation !== "utf8mb4_0900_ai_ci") {
    throw new DatabaseReadinessError("MYSQL_STORAGE_CONFIGURATION_INVALID");
  }
  const sample = "ภาษาไทย หมู ไก่ 📦";
  const roundTrip = await database.$queryRaw<Array<{ text: string }>>`SELECT ${sample} AS text`;
  if (roundTrip[0]?.text !== sample) throw new DatabaseReadinessError("MYSQL_UTF8_ROUNDTRIP_FAILED");
  return { status: "ok" as const, version: info.version, engine: info.engine, charset: info.charset, collation: info.collation };
}
