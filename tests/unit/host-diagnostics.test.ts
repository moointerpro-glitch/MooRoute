import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
const require = createRequire(import.meta.url);
const { diagnose, safeError, connectionOptions } = require("../../diagnose-database.cjs");

test("host diagnostic errors exclude credentials, SQL, messages and personal data", () => {
  assert.deepEqual(safeError({ code: "ER_ACCESS_DENIED_ERROR", errno: 1045, sqlState: "28000", message: "secret", sql: "secret", password: "secret" }), { code: "ER_ACCESS_DENIED_ERROR", errno: 1045, sqlState: "28000" });
  assert.deepEqual(safeError({ code: "password-value", cause: { code: "ECONNREFUSED", message: "secret" } }), { code: "ECONNREFUSED" });
  assert.throws(() => connectionOptions("mysql://user:secret@remote.example/db"));
  assert.equal(connectionOptions("mysql://user:secret@localhost/db").connectTimeout, 5000);
});

test("host diagnostics emit driver code when connection fails, never the raw error", async () => {
  const output: unknown[] = [];
  const code = await diagnose({ env: { DATABASE_URL: "mysql://user:secret@localhost/db" }, emit: (v: unknown) => output.push(v), connect: async () => { throw Object.assign(new Error("password=secret"), { code: "ER_ACCESS_DENIED_ERROR", errno: 1045 }); } });
  assert.equal(code, 1);
  assert.equal(JSON.stringify(output).includes("secret"), false);
  assert.match(JSON.stringify(output), /ER_ACCESS_DENIED_ERROR/);
});

test("host diagnostics use read-only queries and report a missing credential without exposing it", async () => {
  const output: unknown[] = [], queries: string[] = [];
  let closed = false;
  const code = await diagnose({ env: { DATABASE_URL: "mysql://user:secret@localhost/db" }, emit: (v: unknown) => output.push(v), connect: async () => ({
    query: async (sql: string, params?: string[]) => { queries.push(sql); if (params) { assert.deepEqual(params, ["admin@moointer.local"]); return [{ active: 1, hasPassword: 0, hasRole: 1 }]; } return []; },
    end: async () => { closed = true; },
  }) });
  assert.equal(code, 1);
  assert.equal(closed, true);
  assert.equal(queries.every(sql => /^SELECT /.test(sql)), true);
  assert.match(JSON.stringify(output), /"hasPassword":false/);
  assert.equal(JSON.stringify(output).includes("secret"), false);
});
