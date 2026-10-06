import assert from "node:assert/strict";
import { test } from "node:test";
import { sniffContentType, safeDisplayName, uploadDirectory } from "../../src/server/domain/files";

test("file type comes from the signature, never the name or client type", () => {
  assert.equal(sniffContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])), "image/png");
  assert.equal(sniffContentType(new TextEncoder().encode("%PDF-1.7")), "application/pdf");
  assert.equal(sniffContentType(new TextEncoder().encode("<html><script>")), null);
  assert.equal(sniffContentType(new Uint8Array([0x4d, 0x5a])), null, "executables are rejected");
});

test("display names are sanitized and storage stays outside web-served folders", () => {
  assert.equal(safeDisplayName('..\\..\\a<b>:"c".pdf'), ".._.._a_b___c_.pdf");
  assert.equal(safeDisplayName("   "), "ไฟล์แนบ");
  const cwd = process.platform === "win32" ? "C:\\app" : "/app";
  assert.ok(uploadDirectory({}, cwd).endsWith(process.platform === "win32" ? ".local\\uploads" : ".local/uploads"));
  for (const unsafe of ["public/uploads", ".next/x", "src", "."]) assert.throws(() => uploadDirectory({ UPLOAD_DIR: unsafe }, cwd), /ไม่ปลอดภัย|CONFIGURATION/);
});
