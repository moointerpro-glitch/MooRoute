import assert from "node:assert/strict";
import { test } from "node:test";
import jsQRModule from "jsqr";
import { labelProblems, lookupPath, parseLookup, qrSvg, MAX_ADDRESS_CHARACTERS, type LabelPayload } from "../../src/server/domain/labels";

const jsQR = (jsQRModule as unknown as { default?: typeof jsQRModule }).default ?? jsQRModule;
const complete: Pick<LabelPayload, "recipient" | "sender" | "transport" | "packages"> = {
  recipient: { branchCode: "B01", branchName: "สาขาตัวอย่าง", addressLine: "99 ถนนตัวอย่าง", subdistrict: "ตำบลตัวอย่าง", district: "อำเภอตัวอย่าง", province: "เชียงใหม่", postalCode: "50000", contactName: "ผู้รับตัวอย่าง", contactPhone: "000-000-0000" },
  sender: { warehouseName: "คลังตัวอย่าง", warehouseCode: "W1", department: "การตลาด", contactName: null, contactPhone: null },
  transport: { tripCode: "T1", serviceDate: "2028-07-01", roundNo: 1, plate: "1กข1234", province: "เชียงใหม่", departureAt: null },
  packages: [{ id: "p1", sequence: 1, total: 3, label: "FS-1/3" }],
};

test("production labels need complete address, contact, trip and vehicle", () => {
  assert.deepEqual(labelProblems(complete), []);
  const missing = labelProblems({ ...complete, recipient: { ...complete.recipient, postalCode: "00000", contactPhone: " ", district: null }, transport: { ...complete.transport, plate: null } });
  assert.equal(missing.length, 4);
  assert.ok(missing.some((m) => m.includes("รหัสไปรษณีย์")) && missing.some((m) => m.includes("เบอร์ติดต่อผู้รับ")) && missing.some((m) => m.includes("อำเภอ")) && missing.some((m) => m.includes("ทะเบียนรถ")));
  const long = labelProblems({ ...complete, recipient: { ...complete.recipient, addressLine: "ก".repeat(MAX_ADDRESS_CHARACTERS) } });
  assert.ok(long.some((m) => m.includes("ล้นพื้นที่ฉลาก")), "over-long addresses are blocked instead of shrinking text");
});

test("QR encodes only the authenticated lookup URL with an opaque token", () => {
  const token = "Abc_def-0123456789ABCDEFGHIJKLMN", url = `http://127.0.0.1:3010${lookupPath(token, 2)}`;
  const qr = qrSvg(url), scale = 4, size = qr.size * scale, pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < qr.count; y++) for (let x = 0; x < qr.count; x++) if (qr.isDark(y, x)) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) { const i = (((y + 4) * scale + dy) * size + (x + 4) * scale + dx) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 0; }
  }
  assert.equal(jsQR(pixels, size, size)?.data, url, "the printed code decodes to exactly the lookup URL");
  assert.ok(qr.path.startsWith("M") && qr.size === qr.count + 8, "quiet zone of four modules");
  assert.deepEqual(parseLookup(url), { token, sequence: 2 });
  assert.deepEqual(parseLookup(`/l/${token}`), { token, sequence: null });
  assert.deepEqual(parseLookup(token), { token, sequence: null });
  for (const bad of ["FS-25710701-ABCDEF-1/3", "http://evil.example/x?token=1", "/l/short", ""]) assert.equal(parseLookup(bad), null);
});
