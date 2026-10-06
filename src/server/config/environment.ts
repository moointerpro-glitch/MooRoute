export class ConfigurationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ConfigurationError";
  }
}

export interface DatabaseConfiguration {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: { rejectUnauthorized: true };
}

/** Never include a supplied URL or parser error in diagnostics. */
export function parseDatabaseUrl(value: string | undefined): DatabaseConfiguration {
  if (!value) throw new ConfigurationError("DATABASE_URL_REQUIRED");
  let url: URL;
  try { url = new URL(value); } catch { throw new ConfigurationError("DATABASE_URL_INVALID"); }
  if (url.protocol !== "mysql:" || !url.hostname || url.hash ||
      !/^\/[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(url.pathname)) {
    throw new ConfigurationError("DATABASE_URL_INVALID");
  }
  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch { throw new ConfigurationError("DATABASE_URL_INVALID"); }
  if (!user || !password || /^(APP_USER|TEST_USER|placeholder)$/i.test(user) ||
      /^(APP_PASSWORD|TEST_PASSWORD|placeholder)$/i.test(password)) {
    throw new ConfigurationError("DATABASE_CREDENTIALS_REQUIRED");
  }
  if (user.toLowerCase() === "root") throw new ConfigurationError("DATABASE_DEDICATED_USER_REQUIRED");
  const port = url.port ? Number(url.port) : 3306;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigurationError("DATABASE_PORT_INVALID");
  if ([...url.searchParams.keys()].some((key) => key !== "ssl") || url.searchParams.getAll("ssl").length > 1) {
    throw new ConfigurationError("DATABASE_OPTIONS_UNSUPPORTED");
  }
  const sslValue = url.searchParams.get("ssl");
  if (sslValue !== null && sslValue !== "true" && sslValue !== "false") throw new ConfigurationError("DATABASE_TLS_INVALID");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!local && sslValue !== "true") throw new ConfigurationError("DATABASE_TLS_REQUIRED");
  return {
    host: url.hostname.replace(/^\[|\]$/g, ""), port, user, password,
    database: url.pathname.slice(1),
    ...(sslValue === "true" ? { ssl: { rejectUnauthorized: true as const } } : {}),
  };
}

/** Connection pool size per application process; tune from measured load, default 5. */
export function databasePoolSize(env: Record<string, string | undefined>): number {
  const raw = env.DATABASE_POOL_SIZE;
  if (raw === undefined || raw === "") return 5;
  const value = Number(raw);
  if (!/^\d{1,2}$/.test(raw) || value < 1 || value > 50) throw new ConfigurationError("DATABASE_POOL_SIZE_INVALID");
  return value;
}

export function testDatabaseConfiguration(env: Record<string, string | undefined>): DatabaseConfiguration {
  const config = parseDatabaseUrl(env.TEST_DATABASE_URL);
  if (!/^moointer_test(?:_run_[a-z0-9]{1,24})?$/.test(config.database) || !["127.0.0.1", "localhost", "::1"].includes(config.host)) {
    throw new ConfigurationError("DISPOSABLE_TEST_DATABASE_REQUIRED");
  }
  if (env.DATABASE_URL) {
    const app = parseDatabaseUrl(env.DATABASE_URL);
    if (app.database === config.database) throw new ConfigurationError("TEST_DATABASE_MUST_BE_SEPARATE");
  }
  return config;
}
