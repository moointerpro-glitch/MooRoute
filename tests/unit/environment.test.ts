import test from "node:test";
import assert from "node:assert/strict";
import { ConfigurationError, parseDatabaseUrl, testDatabaseConfiguration } from "../../src/server/config/environment";

const valid = "mysql://moointer_fixture:random%40password@127.0.0.1:3307/moointer_dev";

test("parses credentials without losing encoded characters", () => {
  const config = parseDatabaseUrl(valid);
  assert.equal(config.password, "random@password");
  assert.equal(config.database, "moointer_dev");
  assert.equal(config.port, 3307);
});

test("invalid configuration never echoes supplied secrets", () => {
  for (const input of [undefined, "invalid-secret-string", valid.replace("mysql:", "postgres:"),
    valid.replace("moointer_fixture", "APP_USER"), valid.replace("moointer_fixture", "root"), `${valid}?ssl=invalid`,
    `${valid}?connection_limit=99`, `${valid}#sensitive`, valid.replace("random%40password", "%ZZ")]) {
    assert.throws(() => parseDatabaseUrl(input), (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.match(error.message, /^DATABASE_[A-Z_]+$/);
      assert.ok(!error.message.includes("password"));
      return true;
    });
  }
});

test("remote connections require certificate-verified TLS", () => {
  const remote = valid.replace("127.0.0.1", "database.example.com");
  assert.throws(() => parseDatabaseUrl(remote), { message: "DATABASE_TLS_REQUIRED" });
  assert.throws(() => parseDatabaseUrl(`${remote}?ssl=false`), { message: "DATABASE_TLS_REQUIRED" });
  assert.deepEqual(parseDatabaseUrl(`${remote}?ssl=true`).ssl, { rejectUnauthorized: true });
});

test("integration tests reject application and remote databases", () => {
  const testUrl = valid.replace("moointer_dev", "moointer_test");
  assert.equal(testDatabaseConfiguration({ TEST_DATABASE_URL: testUrl, DATABASE_URL: valid }).database, "moointer_test");
  assert.throws(() => testDatabaseConfiguration({ TEST_DATABASE_URL: valid }), { message: "DISPOSABLE_TEST_DATABASE_REQUIRED" });
  assert.throws(() => testDatabaseConfiguration({ TEST_DATABASE_URL: testUrl, DATABASE_URL: testUrl }), { message: "TEST_DATABASE_MUST_BE_SEPARATE" });
  assert.throws(() => testDatabaseConfiguration({ TEST_DATABASE_URL: testUrl.replace("127.0.0.1", "db.example.com") + "?ssl=true" }), { message: "DISPOSABLE_TEST_DATABASE_REQUIRED" });
});
