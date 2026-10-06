import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { DomainError } from "../../src/server/domain/errors";
import { detectTabular, parseCsv, parseTabular, readXlsx, toCsv, writeXlsx, TABULAR_LIMITS } from "../../src/server/domain/tabular";
import { autoMapping, importKinds, parseRow, templateRows, validateMapping } from "../../src/server/domain/imports";

const code = (c: string) => (e: unknown) => e instanceof DomainError && e.code === c;
const bytes = (s: string) => new TextEncoder().encode(s);

test("CSV and XLSX readers keep Thai text, quotes and line breaks; limits and bad files are rejected", () => {
  const rows = [["รหัสสาขา", "ชื่อสาขาทางการ"], ["B01", 'สาขา "ทดสอบ" <1> & ก'], ["B02", "บรรทัด1\nบรรทัด2"]];
  assert.deepEqual(readXlsx(writeXlsx(rows)).rows, [{ "รหัสสาขา": "B01", "ชื่อสาขาทางการ": 'สาขา "ทดสอบ" <1> & ก' }, { "รหัสสาขา": "B02", "ชื่อสาขาทางการ": "บรรทัด1\nบรรทัด2" }]);
  assert.deepEqual(parseCsv(bytes(toCsv(rows))).rows[1]["ชื่อสาขาทางการ"], "บรรทัด1\nบรรทัด2");
  assert.deepEqual(parseCsv(bytes("a;b\r\n1;\"x;y\"\r\n\r\n")).rows, [{ a: "1", b: "x;y" }], "semicolon files and blank lines");
  assert.equal(toCsv([["=1+1"]]).includes("'=1+1"), true, "formula prefixes are neutralized in exports");
  assert.throws(() => parseCsv(bytes("a,a\n1,2")), code("INVALID_FILE"), "duplicate headers");
  assert.throws(() => parseCsv(bytes("a,b\n")), code("INVALID_FILE"), "no data rows");
  assert.throws(() => parseCsv(new Uint8Array([0x61, 0x2c, 0x62, 0x0a, 0xff, 0xfe])), code("INVALID_FILE"), "not UTF-8");
  assert.throws(() => parseCsv(bytes(`a\n${Array.from({ length: TABULAR_LIMITS.maxRows + 1 }, (_, i) => i).join("\n")}`)), code("INVALID_FILE"), "row limit");
  assert.throws(() => parseTabular(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]), "x.xlsx"), code("INVALID_FILE"), "corrupt workbook");
  assert.throws(() => parseTabular(new Uint8Array(TABULAR_LIMITS.maxBytes + 1), "x.csv"), code("INVALID_FILE"));
});

test("PDF and images are reference material; decompression bombs are refused", () => {
  for (const [name, head] of [["sheet.pdf", "%PDF-1.7"], ["photo.jpg", "ÿØÿ"], ["scan.png", "\u0089PNG"]]) {
    assert.throws(() => detectTabular(Uint8Array.from(head, (c) => c.charCodeAt(0)), name), code("REFERENCE_ONLY"), name);
  }
  assert.throws(() => detectTabular(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), "old.xls"), code("INVALID_FILE"));
  // A workbook whose sheet declares a huge uncompressed size is rejected before inflating.
  const xlsx = Buffer.from(writeXlsx([["a"], ["1"]])), view = new DataView(xlsx.buffer, xlsx.byteOffset, xlsx.byteLength);
  let end = xlsx.length - 22; while (view.getUint32(end, true) !== 0x06054b50) end--;
  let offset = view.getUint32(end + 16, true);
  for (let n = 0; n < view.getUint16(end + 10, true); n++) { view.setUint32(offset + 24, 0x7fffffff, true); offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true); }
  assert.throws(() => readXlsx(new Uint8Array(xlsx)), code("INVALID_FILE"));
  assert.ok(deflateRawSync(Buffer.alloc(10)).length > 0);
});

test("mapping matches Thai headers; values are parsed strictly and unknowns stay null", () => {
  const headers = templateRows("schedule")[0];
  const mapping = autoMapping("schedule", headers);
  assert.ok(Object.values(mapping).every((v) => v !== null), "the downloaded template maps itself completely");
  assert.equal(templateRows("branches").length, 1, "templates contain headers only, never an importable example row");
  assert.equal(validateMapping("schedule", headers, { ...mapping, routeCode: mapping.templateCode }), null, "one column cannot feed two fields");
  assert.equal(validateMapping("schedule", headers, { ...mapping, routeCode: "ไม่มีคอลัมน์นี้" }), null);
  const cells = Object.fromEntries(importKinds.schedule.fields.map((f) => [f.label, ""]));
  const row = (over: Record<string, string>) => parseRow("schedule", mapping, { ...cells, ...Object.fromEntries(Object.entries(over).map(([k, v]) => [importKinds.schedule.fields.find((f) => f.name === k)!.label, v])) });
  const ok = row({ templateCode: "T1", routeCode: "R1", routeName: "เส้นทาง", roundNo: "๑", weekdays: "1-5,7", loadingTime: "7.30", departureTime: "", stopSequence: "1", branchCode: "B1", categories: "pork| chicken |pork", effectiveFrom: "01/10/2569" });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual([ok.values.roundNo, ok.values.weekdays, ok.values.loadingTime, ok.values.departureTime, ok.values.categories, ok.values.effectiveFrom], [1, [1, 2, 3, 4, 5, 7], 450, null, ["pork", "chicken"], "2026-10-01"]);
  assert.equal(row({ effectiveFrom: "46296" }).values.effectiveFrom, "2026-10-01", "Excel date serial (46023 = 2026-01-01)");
  assert.equal(row({ loadingTime: "0.3125" }).values.loadingTime, 450, "Excel time fraction");
  const bad = row({ templateCode: "T1", routeCode: "R1", routeName: "x", roundNo: "หนึ่ง", weekdays: "0-8", loadingTime: "25:00", stopSequence: "1", branchCode: "B1", effectiveFrom: "01/10/2026" });
  assert.equal(bad.errors.length, 4);
  assert.ok(bad.errors.some((e) => e.includes("พ.ศ.")), "Gregorian day/month/year is refused to avoid mixing calendars");
  assert.ok(parseRow("schedule", { ...mapping, branchCode: null }, cells).errors.some((e) => e.includes("ยังไม่ได้จับคู่คอลัมน์")));
});
