import assert from "node:assert/strict";
import { test } from "node:test";
import { describeError, logUnexpected } from "../../src/server/logging";
import { ConfigurationError, databasePoolSize } from "../../src/server/config/environment";
import { readBodyWithin, utf8BytesFor } from "../../src/server/request-body";

test("operational error logs never contain messages, SQL, parameters or secrets", () => {
  const secret = "mysql://app:SuperSecretPassword@db/prod", pii = "0812345678";
  const error = Object.assign(new Error(`Raw query failed for ${secret} phone ${pii}`), { name: "PrismaClientKnownRequestError", code: "P2010", meta: { code: "1213", message: `deadlock ${pii}` } });
  const lines: string[] = [];
  logUnexpected("api.unexpected_error", error, (line) => lines.push(line));
  const entry = JSON.parse(lines[0]);
  assert.deepEqual([entry.level, entry.event, entry.name, entry.code, entry.driverCode], ["error", "api.unexpected_error", "PrismaClientKnownRequestError", "P2010", "1213"]);
  assert.match(entry.at, /^[\w.-]+\.ts:\d+$/, "source location without absolute paths");
  assert.ok(!lines[0].includes("SuperSecret") && !lines[0].includes(pii) && !lines[0].includes("Raw query"));
  assert.equal(describeError(Object.assign(new Error("x"), { code: "has spaces and 'quotes'" })).code, undefined, "unsafe codes are dropped");
  assert.deepEqual(describeError("plain string"), { name: "string" });
  assert.equal(describeError(new ConfigurationError("AUTH_DEPLOYMENT_NOT_CONFIGURED")).code, "AUTH_DEPLOYMENT_NOT_CONFIGURED");
});

test("connection pool size is validated configuration with a safe default", () => {
  assert.equal(databasePoolSize({}), 5);
  assert.equal(databasePoolSize({ DATABASE_POOL_SIZE: "20" }), 20);
  for (const bad of ["0", "51", "ten", "-1", "5.5"]) assert.throws(() => databasePoolSize({ DATABASE_POOL_SIZE: bad }), /DATABASE_POOL_SIZE_INVALID/);
});

test("request bodies are refused at the byte limit without waiting for the rest of a chunked upload", async () => {
  // Phase 8 review R6: a body that never ends must still be refused once it passes the limit.
  let pulled = 0;
  const endless = new ReadableStream<Uint8Array>({ pull(controller) { pulled++; controller.enqueue(new Uint8Array(64 * 1024)); } });
  const request = new Request("http://127.0.0.1/upload", { method: "POST", body: endless, duplex: "half" } as RequestInit);
  assert.equal(await readBodyWithin(request, 1024 * 1024), null);
  assert.ok(pulled <= 20, `stopped after ${pulled} chunks`);
  assert.equal(await readBodyWithin(new Request("http://127.0.0.1/upload", { method: "POST", headers: { "content-length": "5000" }, body: "x" }), 4096), null, "declared length over the limit");
  const text = "ข้อมูลไทย".repeat(100);
  const within = await readBodyWithin(new Request("http://127.0.0.1/upload", { method: "POST", body: text }), utf8BytesFor(text.length));
  assert.equal(new TextDecoder().decode(within!), text, "a Thai body at the character limit still fits the byte cap");
});
