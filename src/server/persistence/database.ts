import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { parseDatabaseUrl, type DatabaseConfiguration } from "../config/environment";

export function createDatabase(config: DatabaseConfiguration) {
  const adapter = new PrismaMariaDb({
    ...config,
    connectionLimit: 5,
    connectTimeout: 5000,
    acquireTimeout: 5000,
    timezone: "+00:00",
    charset: "utf8mb4",
    // Native MySQL 8.4 uses caching_sha2_password. Retrieval is limited to loopback;
    // remote connections require certificate-verified TLS in configuration validation.
    allowPublicKeyRetrieval: ["127.0.0.1", "localhost", "::1"].includes(config.host),
  });
  return new PrismaClient({ adapter, log: [] });
}

const processDatabase = globalThis as unknown as { moointerDatabase?: PrismaClient };

export function getDatabase() {
  processDatabase.moointerDatabase ??= createDatabase(parseDatabaseUrl(process.env.DATABASE_URL));
  return processDatabase.moointerDatabase;
}
