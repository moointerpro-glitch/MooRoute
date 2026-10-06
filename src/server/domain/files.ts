import { isAbsolute, relative, resolve, sep } from "node:path";
import { DomainError } from "./errors";

export const ATTACHMENT_LIMITS = { maxBytes: 10 * 1024 * 1024, maxFiles: 5, types: ["image/jpeg", "image/png", "application/pdf"] as const };

/** Content type from the file signature, never from the client-supplied type or extension. */
export function sniffContentType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}
export function safeDisplayName(name: string) {
  const cleaned = name.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 150);
  return cleaned || "ไฟล์แนบ";
}
/**
 * Private attachment storage outside any web-served directory. Keys are opaque UUIDs with no
 * user-controlled path segments; downloads always pass through the authorized route.
 */
export function uploadDirectory(env: Record<string, string | undefined> = process.env, cwd = process.cwd()) {
  const dir = resolve(cwd, env.UPLOAD_DIR || ".local/uploads");
  const rel = relative(cwd, dir);
  if (!rel || (!rel.startsWith("..") && !isAbsolute(rel) && ["public", ".next", "src", "app"].includes(rel.split(sep)[0]))) throw new DomainError("CONFIGURATION", "ตำแหน่งจัดเก็บไฟล์แนบไม่ปลอดภัย");
  return dir;
}
