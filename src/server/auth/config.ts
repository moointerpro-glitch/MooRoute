import { ConfigurationError } from "../config/environment";

export function authConfiguration(env: Record<string, string | undefined>) {
  if (env.APP_ENV !== "local") throw new ConfigurationError("AUTH_DEPLOYMENT_NOT_CONFIGURED");
  let url: URL;
  try { url = new URL(env.BETTER_AUTH_URL ?? ""); } catch { throw new ConfigurationError("AUTH_URL_REQUIRED"); }
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new ConfigurationError("LOCAL_AUTH_LOOPBACK_REQUIRED");
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || /placeholder|change.me|replace.with/i.test(secret)) throw new ConfigurationError("AUTH_SECRET_REQUIRED");
  return { baseURL: url.origin, secret };
}
