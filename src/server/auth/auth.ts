import "server-only";
import { betterAuth } from "better-auth/minimal";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../persistence/database";
import { authConfiguration } from "./config";
import type { PrismaClient } from "../../generated/prisma/client";

export function createAuth(db: PrismaClient, config: {baseURL: string; secret: string}) {
  return betterAuth({
    ...config, appName: "หมูอินเตอร์", trustedOrigins: [config.baseURL],
    database: prismaAdapter(db, { provider: "mysql" }),
    user: { modelName: "User", fields: { name: "displayName" } },
    session: { modelName: "AuthSession", expiresIn: 8 * 60 * 60, updateAge: 30 * 60, cookieCache: { enabled: false } },
    account: { modelName: "AuthAccount", accountLinking: { enabled: false } },
    verification: { modelName: "AuthVerification" },
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    rateLimit: { enabled: true, storage: "database", modelName: "AuthRateLimit", window: 60, max: 60,
      customRules: { "/sign-in/email": { window: 60, max: 5 } } },
    advanced: { database: { generateId: () => randomUUID() }, useSecureCookies: config.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      ipAddress: { ipAddressHeaders: ["x-moointer-peer"] } },
    logger: { disabled: true },
    databaseHooks: { session: { create: { before: async (session) => {
      const user = await db.user.findUnique({where:{id:session.userId}});
      if (!user?.active) return false;
      return { data: { ...session, ipAddress: null, userAgent: null } };
    } } } },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(getDatabase(), authConfiguration(process.env)); }
