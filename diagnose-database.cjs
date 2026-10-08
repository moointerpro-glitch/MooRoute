/* eslint-disable @typescript-eslint/no-require-imports -- Standalone operator tool for the hosted CommonJS runtime. */
const { createRequire } = require("node:module");

// Print only known diagnostic fields. Driver messages can contain passwords, SQL or personal data.
function safeError(error) {
  const result = {};
  for (const candidate of [error, error?.cause]) {
    if (typeof candidate?.code === "string" && /^(?:ER_[A-Z0-9_]{1,80}|E[A-Z_]{2,40}|P\d{4}|MODULE_NOT_FOUND|\d{3,6})$/.test(candidate.code)) result.code ??= candidate.code;
    if (Number.isInteger(candidate?.errno)) result.errno ??= candidate.errno;
    if (typeof candidate?.sqlState === "string" && /^[A-Z0-9]{5}$/.test(candidate.sqlState)) result.sqlState ??= candidate.sqlState;
  }
  return result;
}

function connectionOptions(value) {
  const invalid = () => { throw Object.assign(new Error(), { code: "ER_DIAGNOSTIC_DATABASE_URL" }); };
  let url;
  try { url = new URL(value); } catch { return invalid(); }
  if (url.protocol !== "mysql:" || !url.hostname || url.hash || !/^\/[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(url.pathname)) return invalid();
  if ([...url.searchParams.keys()].some(key => key !== "ssl") || url.searchParams.getAll("ssl").length > 1) return invalid();
  const ssl = url.searchParams.get("ssl");
  if (ssl !== null && ssl !== "true" && ssl !== "false") return invalid();
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host) && ssl !== "true") return invalid();
  let user, password;
  try { user = decodeURIComponent(url.username); password = decodeURIComponent(url.password); } catch { return invalid(); }
  if (!user || !password || user.toLowerCase() === "root") return invalid();
  return {
    host, user, password, database: url.pathname.slice(1), port: Number(url.port || 3306),
    connectTimeout: 5000, socketTimeout: 7000, timezone: "+00:00", charset: "utf8mb4",
    allowPublicKeyRetrieval: ["localhost", "127.0.0.1", "::1"].includes(host),
    ...(ssl === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

async function diagnose({ env = process.env, connect, emit = value => console.log(JSON.stringify(value)) }) {
  let connection, stage = "configuration", failed = false;
  try {
    const options = connectionOptions(env.DATABASE_URL);
    stage = "connect";
    connection = await connect(options);
    await connection.query("SELECT 1 AS ok");
    emit({ status: "ok", stage, message: "เชื่อมต่อฐานข้อมูลด้วยค่าของแอปสำเร็จ" });
    // Fixed identifiers only; no values or credentials are printed.
    for (const [table, columns] of [
      ["User", "id, email, active"], ["AuthAccount", "userId, providerId, password"],
      ["AuthSession", "id, token, userId, expiresAt"], ["AuthRateLimit", "id, `key`, count, lastRequest"],
      ["Role", "id, code"], ["UserRole", "userId, roleId"], ["UserScope", "userId, kind"],
    ]) {
      stage = `table:${table}`;
      await connection.query(`SELECT ${columns} FROM \`${table}\` LIMIT 0`);
    }
    emit({ status: "ok", stage: "tables", message: "อ่านตารางที่ใช้เข้าสู่ระบบได้" });
    stage = "administrator";
    const rows = await connection.query(
      "SELECT u.active, EXISTS(SELECT 1 FROM `AuthAccount` a WHERE a.userId=u.id AND a.providerId='credential' AND a.password IS NOT NULL AND LENGTH(a.password)>0) AS hasPassword, EXISTS(SELECT 1 FROM `UserRole` ur JOIN `Role` r ON r.id=ur.roleId WHERE ur.userId=u.id AND r.code='ADMINISTRATOR') AS hasRole FROM `User` u WHERE u.email=? LIMIT 1",
      [env.DIAGNOSTIC_ADMIN_EMAIL || "admin@moointer.local"],
    );
    const row = rows[0];
    const checks = { found: !!row, active: !!Number(row?.active), hasPassword: !!Number(row?.hasPassword), hasRole: !!Number(row?.hasRole) };
    failed = Object.values(checks).some(value => !value);
    emit({ status: failed ? "error" : "ok", stage, ...checks, message: "ตรวจเฉพาะการมีบัญชี สถานะ รหัสผ่านที่บันทึก และสิทธิ์ผู้ดูแล" });
    emit({ status: "info", stage: "scope", message: "ตรวจแบบอ่านอย่างเดียว ไม่ยืนยันรหัสผ่านที่กรอก สิทธิ์เขียน หรือการเข้าสู่ระบบครบขั้นตอน" });
  } catch (error) {
    failed = true;
    emit({ status: "error", stage, ...safeError(error), message: "ส่งเฉพาะผลตรวจนี้ให้ผู้ดูแล ไม่ต้องส่งรหัสผ่าน" });
  } finally {
    if (connection) {
      try { await connection.end(); }
      catch (error) { failed = true; emit({ status: "error", stage: "disconnect", ...safeError(error) }); }
    }
  }
  return failed ? 1 : 0;
}

async function main() {
  // Resolve through installed parent packages so CloudLinux's isolated node_modules also works.
  const nextRequire = createRequire(require.resolve("next"));
  nextRequire("@next/env").loadEnvConfig(__dirname, false, { info() {}, error() {} });
  const adapterRequire = createRequire(require.resolve("@prisma/adapter-mariadb"));
  const driver = adapterRequire("mariadb");
  process.exitCode = await diagnose({ connect: options => driver.createConnection(options) });
}

module.exports = { safeError, connectionOptions, diagnose };
if (require.main === module) {
  const timeout = setTimeout(() => {
    console.log(JSON.stringify({ status: "error", stage: "timeout", message: "หมดเวลาตรวจฐานข้อมูล" }));
    process.exit(1);
  }, 30000);
  timeout.unref();
  main().catch(error => {
    console.log(JSON.stringify({ status: "error", stage: "dependencies", ...safeError(error), message: "โหลดเครื่องมือตรวจไม่สำเร็จ" }));
    process.exitCode = 1;
  });
}
