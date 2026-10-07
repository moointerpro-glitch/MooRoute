import { isIP } from "node:net";
import { ConfigurationError } from "../config/environment";

/**
 * Where the application's own password accounts may run (D227).
 * - APP_ENV=local: a loopback origin only, for development and rehearsals.
 * - APP_ENV=production: an HTTPS origin on a real host name. Plain HTTP, IP literals and loopback are refused, so
 *   session cookies are always Secure and never sent to a development address.
 * Any other value makes authentication refuse to start; there is no fallback.
 */
export type AuthMode = "local" | "production";
const loopback = ["127.0.0.1", "localhost"];

export function authConfiguration(env: Record<string, string | undefined>) {
  const mode = env.APP_ENV;
  if (mode !== "local" && mode !== "production") throw new ConfigurationError("AUTH_DEPLOYMENT_NOT_CONFIGURED");
  let url: URL;
  try { url = new URL(env.BETTER_AUTH_URL ?? ""); } catch { throw new ConfigurationError("AUTH_URL_REQUIRED"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new ConfigurationError("AUTH_URL_REQUIRED");
  if (mode === "local" && !loopback.includes(url.hostname)) throw new ConfigurationError("LOCAL_AUTH_LOOPBACK_REQUIRED");
  if (mode === "production" && (url.protocol !== "https:" || loopback.includes(url.hostname) || isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0 || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)))
    throw new ConfigurationError("PRODUCTION_AUTH_HTTPS_HOST_REQUIRED");
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || /placeholder|change.me|replace.with/i.test(secret)) throw new ConfigurationError("AUTH_SECRET_REQUIRED");
  return { baseURL: url.origin, secret, mode: mode as AuthMode };
}

const SHARED_PEER = "127.0.0.1";
/**
 * Address used to count sign-in attempts per client. Forwarded headers are client-controlled unless a proxy the
 * operator trusts wrote them, so they are read only in production and only when TRUSTED_PROXY_HEADER names one
 * (x-forwarded-for or x-real-ip). For x-forwarded-for the entry written by the nearest trusted proxy is used:
 * the last one, or further left when TRUSTED_PROXY_HOPS proxies are chained. Anything missing or malformed falls
 * back to one shared bucket, which is safe (stricter) but can throttle everyone together.
 */
export function peerAddress(env: Record<string, string | undefined>, headers: Headers): string {
  if (env.APP_ENV !== "production") return SHARED_PEER;
  const name = env.TRUSTED_PROXY_HEADER?.trim().toLowerCase();
  if (name !== "x-forwarded-for" && name !== "x-real-ip") return SHARED_PEER;
  const hops = /^[1-5]$/.test(env.TRUSTED_PROXY_HOPS ?? "") ? Number(env.TRUSTED_PROXY_HOPS) : 1;
  const entries = (headers.get(name) ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const candidate = name === "x-real-ip" ? entries[0] : entries[entries.length - hops];
  return candidate && isIP(candidate) !== 0 ? candidate : SHARED_PEER;
}
