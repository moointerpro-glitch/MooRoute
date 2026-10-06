import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DomainError } from "../domain/errors";
import { uploadDirectory } from "../domain/files";

// Keys are opaque UUIDs; downloads always pass through the authorized route (see domain/files.ts).

const pathFor = (key: string) => {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new DomainError("NOT_FOUND", "ไม่พบไฟล์");
  return resolve(uploadDirectory(), key);
};
export async function storePrivateFile(bytes: Uint8Array) {
  const key = randomUUID();
  await mkdir(/*turbopackIgnore: true*/ uploadDirectory(), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ pathFor(key), bytes, { flag: "wx", mode: 0o600 });
  return key;
}
export async function readPrivateFile(key: string) { return readFile(/*turbopackIgnore: true*/ pathFor(key)); }
export async function removePrivateFile(key: string) { await rm(/*turbopackIgnore: true*/ pathFor(key), { force: true }); }
