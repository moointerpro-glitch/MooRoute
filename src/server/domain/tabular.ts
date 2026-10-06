import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";
import { DomainError } from "./errors";

/** Limits for staged imports. Files are reference transcriptions, not bulk data loads. */
export const TABULAR_LIMITS = { maxBytes: 2 * 1024 * 1024, maxRows: 500, maxColumns: 60, maxCell: 2000, maxInflated: 20 * 1024 * 1024 };
const invalid = (message: string) => new DomainError("INVALID_FILE", message);

function finish(rows: string[][]) {
  const cleaned = rows.map((r) => r.map((c) => c.normalize("NFC").trim())).filter((r) => r.some((c) => c !== ""));
  if (cleaned.length < 2) throw invalid("ไฟล์ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย ๑ แถว");
  if (cleaned.length - 1 > TABULAR_LIMITS.maxRows) throw invalid(`ไฟล์มีข้อมูลเกิน ${TABULAR_LIMITS.maxRows.toLocaleString("th-TH")} แถว กรุณาแบ่งไฟล์`);
  const width = Math.max(...cleaned.map((r) => r.length));
  if (width > TABULAR_LIMITS.maxColumns) throw invalid(`ไฟล์มีเกิน ${TABULAR_LIMITS.maxColumns} คอลัมน์`);
  if (cleaned.some((r) => r.some((c) => c.length > TABULAR_LIMITS.maxCell))) throw invalid("มีช่องข้อมูลยาวเกินกำหนด");
  const headers = cleaned[0].map((h, i) => h || `คอลัมน์ ${i + 1}`);
  if (new Set(headers).size !== headers.length) throw invalid("หัวตารางมีชื่อซ้ำกัน กรุณาตั้งชื่อคอลัมน์ไม่ให้ซ้ำ");
  return { headers, rows: cleaned.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))) };
}
export type Table = ReturnType<typeof finish>;

/** RFC 4180 CSV with BOM, quoted fields, embedded newlines and comma/semicolon/tab detection. */
export function parseCsv(bytes: Uint8Array): Table {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw invalid("ไฟล์ CSV ต้องบันทึกเป็น UTF-8"); }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (quoted) throw invalid("ไฟล์ CSV มีเครื่องหมายคำพูดไม่ครบคู่");
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return finish(rows);
}
/** CSV with BOM and formula-prefix escaping, for templates and exports. */
export function toCsv(rows: string[][]) {
  const cell = (v: string) => `"${v.replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- minimal XLSX (first worksheet, text and numbers)

function unzip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw invalid("ไฟล์ XLSX ไม่ถูกต้องหรือเสียหาย");
  const count = view.getUint16(end + 10, true); let offset = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>(); let total = 0;
  for (let n = 0; n < count; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw invalid("ไฟล์ XLSX ไม่ถูกต้องหรือเสียหาย");
    const method = view.getUint16(offset + 10, true), compressed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true), local = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extra + comment;
    if (!/^(xl\/(workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml))$/.test(name)) continue;
    // Declared sizes are checked before inflating to stop decompression bombs.
    total += size; if (size > TABULAR_LIMITS.maxInflated || total > TABULAR_LIMITS.maxInflated) throw invalid("ไฟล์ XLSX มีขนาดข้อมูลเกินกำหนด");
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true), data = bytes.subarray(dataStart, dataStart + compressed);
    if (method === 0) files.set(name, data);
    else if (method === 8) { try { files.set(name, inflateRawSync(data, { maxOutputLength: TABULAR_LIMITS.maxInflated })); } catch { throw invalid("ไฟล์ XLSX ไม่ถูกต้องหรือเสียหาย"); } }
    else throw invalid("ไฟล์ XLSX ใช้การบีบอัดที่ไม่รองรับ");
  }
  return files;
}
const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e: string) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e] ?? m);
const texts = (xml: string) => [...xml.replace(/<rPh[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");

export function readXlsx(bytes: Uint8Array): Table {
  const files = unzip(bytes), text = (name: string) => { const f = files.get(name); return f ? new TextDecoder().decode(f) : null; };
  const workbook = text("xl/workbook.xml");
  if (!workbook) throw invalid("ไฟล์ XLSX ไม่มีข้อมูลสมุดงาน");
  const relId = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1], rels = text("xl/_rels/workbook.xml.rels") ?? "";
  const target = relId ? rels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${relId}"[^>]*\\bTarget="([^"]+)"|<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${relId}"`)) : null;
  const sheetName = `xl/${(target?.[1] ?? target?.[2] ?? "worksheets/sheet1.xml").replace(/^\/?xl\//, "").replace(/^\//, "")}`;
  const sheet = text(sheetName);
  if (!sheet) throw invalid("ไฟล์ XLSX ไม่มีแผ่นงานแรก");
  const shared = [...(text("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = c[1].match(/\br="([A-Z]+)\d+"/)?.[1], type = c[1].match(/\bt="([^"]+)"/)?.[1], body = c[2] ?? "";
      const column = ref ? [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      row[column] = type === "s" ? shared[Number(value)] ?? "" : type === "inlineStr" ? texts(body) : type === "b" ? (value === "1" ? "TRUE" : "FALSE") : decodeXml(value ?? "");
    }
    rows.push(Array.from(row, (v) => v ?? ""));
  }
  return finish(rows);
}

/** Writes a single-sheet workbook with inline strings (templates and test fixtures). */
export function writeXlsx(rows: string[][]) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const letters = (n: number) => { let s = ""; for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, y) => `<row r="${y + 1}">${r.map((v, x) => `<c r="${letters(x)}${y + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const entries: Array<[string, string]> = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ข้อมูล" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", sheet],
  ];
  const chunks: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const [name, content] of entries) {
    const raw = Buffer.from(content, "utf8"), data = deflateRawSync(raw), nameBytes = Buffer.from(name, "utf8"), crc = crc32(raw);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBytes.length, 26);
    const header = Buffer.alloc(46); header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x0800, 8); header.writeUInt16LE(8, 10);
    header.writeUInt32LE(crc, 16); header.writeUInt32LE(data.length, 20); header.writeUInt32LE(raw.length, 24); header.writeUInt16LE(nameBytes.length, 28); header.writeUInt32LE(offset, 42);
    chunks.push(local, nameBytes, data); central.push(header, nameBytes); offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, directory, end]));
}

/** Detects the staged file type from its signature; PDFs and images are reference material, not import sources. */
export function detectTabular(bytes: Uint8Array, name: string): "csv" | "xlsx" {
  const head = String.fromCharCode(...bytes.slice(0, 5));
  if (head.startsWith("%PDF-") || (bytes[0] === 0xff && bytes[1] === 0xd8) || (bytes[0] === 0x89 && head.slice(1, 4) === "PNG")) {
    throw new DomainError("REFERENCE_ONLY", "ไฟล์ PDF หรือรูปภาพเป็นเอกสารอ้างอิงเท่านั้น ระบบไม่อ่านด้วย OCR กรุณาถอดความลงแม่แบบ CSV/XLSX และตรวจทานก่อนนำเข้า");
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "xlsx";
  if (/\.xls$/i.test(name) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) throw invalid("ไม่รองรับไฟล์ .xls รุ่นเก่า กรุณาบันทึกเป็น .xlsx หรือ .csv");
  return "csv";
}
export function parseTabular(bytes: Uint8Array, name: string): Table {
  if (!bytes.length) throw invalid("ไฟล์ว่างเปล่า");
  if (bytes.length > TABULAR_LIMITS.maxBytes) throw invalid("ไฟล์มีขนาดเกิน ๒ เมกะไบต์");
  return detectTabular(bytes, name) === "xlsx" ? readXlsx(bytes) : parseCsv(bytes);
}
