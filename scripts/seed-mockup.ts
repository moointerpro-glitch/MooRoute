import "dotenv/config";
import { createHash } from "node:crypto";
import { createDatabase } from "../src/server/persistence/database";
import { parseDatabaseUrl } from "../src/server/config/environment";
import { installRoles } from "../src/server/auth/permissions";
import { mutateMaster } from "../src/server/services/masters";
import { MOCK_ACCOUNTS, MOCK_LOGIN_FILE, ensureMockAccounts } from "./mock-accounts";

/**
 * MOCK-UP data for hands-on testing of the local development database (moointer_dev).
 * Every record is fictitious and labelled ทดสอบ; no real branch, person, phone or plate is used.
 * Only master data and the mock accounts in mock-accounts.ts are created. No route, template, plan, trip, reservation or
 * consignment is created, so the owner can try those flows from an empty state.
 * Masters go through the same audited service as the admin screens. Re-running is safe: writes replay
 * by idempotency key and existing accounts are kept. Passwords go only to the ignored login file (see mock-accounts.ts).
 */
const MANIFEST_KEY = "mockup-dev-v1", ACTIVE_FROM = "2026-10-01", REASON = "ข้อมูล mock up สำหรับทดสอบระบบ (ไม่ใช่ข้อมูลจริง)";

type Values = Record<string, string | boolean>;
const storage = [["CHILLED", "แช่เย็น 0–4 °C (ทดสอบ)"], ["FROZEN", "แช่แข็ง −18 °C (ทดสอบ)"], ["AMBIENT", "อุณหภูมิห้อง (ทดสอบ)"]];
const vehicleTypes = [["T-4W", "กระบะ 4 ล้อตู้เย็น (ทดสอบ)", "4"], ["T-6W", "รถ 6 ล้อตู้เย็น (ทดสอบ)", "6"], ["T-10W", "รถ 10 ล้อตู้เย็น (ทดสอบ)", "10"]];
const productCategories = [["PORK", "หมู"], ["CHICKEN", "ไก่"], ["PROCESSED", "ผลิตภัณฑ์แปรรูป (ทดสอบ)"], ["DRY", "สินค้าแห้ง (ทดสอบ)"]];
const consignmentCategories = [["MARKETING", "สื่อการตลาด"], ["DOCUMENT", "เอกสาร"], ["EQUIPMENT", "อุปกรณ์"], ["SUPPLY", "วัสดุสิ้นเปลืองสาขา (ทดสอบ)"]];
const warehouses = [["WH-T01", "คลังกลางทดสอบ", "ที่อยู่ทดสอบ เลขที่ 1 ถนนทดสอบ ไม่ใช่ที่อยู่จริง"], ["WH-T02", "คลังสินค้าแช่แข็งทดสอบ", "ที่อยู่ทดสอบ เลขที่ 2 ถนนทดสอบ ไม่ใช่ที่อยู่จริง"]];
const departments = [["DEP-MKT", "ฝ่ายการตลาด (ทดสอบ)"], ["DEP-ACC", "ฝ่ายบัญชี (ทดสอบ)"], ["DEP-OPS", "ฝ่ายปฏิบัติการสาขา (ทดสอบ)"]];
const drivers = [["DRV-T01", "สมชาย ขับดี (ทดสอบ)"], ["DRV-T02", "สมศักดิ์ ตรงเวลา (ทดสอบ)"], ["DRV-T03", "วิชัย ปลอดภัย (ทดสอบ)"], ["DRV-T04", "ประเสริฐ ส่งไว (ทดสอบ)"], ["DRV-T05", "บุญมี ใจเย็น (ทดสอบ)"], ["DRV-T06", "สุรชัย รอบคอบ (ทดสอบ)"]];
// [plate, province, brand, model, color, type, storage, capacity kg]
const vehicles: string[][] = [
  ["ทดสอบ 1001", "เชียงใหม่", "อีซูซุ", "D-Max", "ขาว", "T-4W", "CHILLED", "1500"], ["ทดสอบ 1002", "เชียงใหม่", "โตโยต้า", "Hilux Revo", "ขาว", "T-4W", "CHILLED", "1500"],
  ["ทดสอบ 2001", "เชียงใหม่", "ฮีโน่", "300 Series", "ขาว", "T-6W", "CHILLED", "3500"], ["ทดสอบ 2002", "ลำพูน", "อีซูซุ", "NLR", "ขาว", "T-6W", "FROZEN", "3500"],
  ["ทดสอบ 3001", "เชียงใหม่", "ฮีโน่", "500 Series", "ขาว", "T-10W", "FROZEN", "8000"], ["ทดสอบ 3002", "ลำปาง", "อีซูซุ", "FTR", "ขาว", "T-10W", "CHILLED", "8000"],
];
// [code, name, type, aliases, subdistrict, district, province, postal]
const branches: string[][] = [
  ["BR-T01", "สาขาทดสอบ สันทราย", "BRANCH", "สันทราย\nสาขา 1", "สันทรายหลวง", "สันทราย", "เชียงใหม่", "50210"],
  ["BR-T02", "สาขาทดสอบ หางดง", "BRANCH", "หางดง", "หางดง", "หางดง", "เชียงใหม่", "50230"],
  ["BR-T03", "สาขาทดสอบ สารภี", "BRANCH", "สารภี", "ยางเนิ้ง", "สารภี", "เชียงใหม่", "50140"],
  ["BR-T04", "สาขาทดสอบ แม่ริม", "BRANCH", "แม่ริม", "ริมใต้", "แม่ริม", "เชียงใหม่", "50180"],
  ["BR-T05", "สาขาทดสอบ สันกำแพง", "BRANCH", "สันกำแพง", "สันกำแพง", "สันกำแพง", "เชียงใหม่", "50130"],
  ["BR-T06", "สาขาทดสอบ ลำพูน", "BRANCH", "ลำพูน\nในเมืองลำพูน", "ในเมือง", "เมืองลำพูน", "ลำพูน", "51000"],
  ["BR-T07", "สาขาทดสอบ ลำปาง", "BRANCH", "ลำปาง", "สวนดอก", "เมืองลำปาง", "ลำปาง", "52100"],
  ["BR-T08", "สาขาทดสอบ เชียงราย", "BRANCH", "เชียงราย", "เวียง", "เมืองเชียงราย", "เชียงราย", "57000"],
  ["DC-T01", "ศูนย์กระจายสินค้าทดสอบ", "DC", "ดีซี\nศูนย์กระจาย", "หนองป่าครั่ง", "เมืองเชียงใหม่", "เชียงใหม่", "50000"],
];

let db: ReturnType<typeof createDatabase> | undefined;
try {
  if (process.env.APP_ENV !== "local") throw new Error("LOCAL_ONLY");
  const config = parseDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  if (config.host !== "127.0.0.1" || config.port !== 3307 || config.database !== "moointer_dev") throw new Error("LOCAL_DEV_DATABASE_ONLY");
  db = createDatabase(config);
  await installRoles(db);

  // Accounts first: the mock administrator is the audited actor of every master write.
  const { admin } = await ensureMockAccounts(db, ["admin"]);

  const ids = new Map<string, string>();
  // A master that already exists (for example after the development reset cleared replay records) is reused as is.
  const existing = async (kind: string, code: string) => {
    const byCode = { where: { code }, select: { id: true } } as const;
    const row = kind === "vehicles" ? await db!.vehicle.findFirst({ where: { plateNormalized: code.replace(/[\s-]/g, "").toUpperCase() }, select: { id: true } })
      : kind === "storage-conditions" ? await db!.storageCondition.findUnique(byCode) : kind === "vehicle-types" ? await db!.vehicleType.findUnique(byCode)
      : kind === "product-categories" ? await db!.productCategory.findUnique(byCode) : kind === "consignment-categories" ? await db!.consignmentCategory.findUnique(byCode)
      : kind === "warehouses" ? await db!.warehouse.findUnique(byCode) : kind === "departments" ? await db!.department.findUnique(byCode)
      : kind === "drivers" ? await db!.driver.findUnique(byCode) : kind === "branches" ? await db!.branch.findUnique(byCode) : null;
    return row?.id;
  };
  const save = async (kind: string, code: string, values: Values) => {
    const found = await existing(kind, code);
    if (found) { ids.set(`${kind}:${code}`, found); return; }
    // Idempotency keys are ASCII only; Thai codes such as vehicle plates are replaced by a stable hash.
    const keyPart = /^[A-Za-z0-9_-]{1,40}$/.test(code) ? code : createHash("sha256").update(code).digest("hex").slice(0, 24);
    const result = await mutateMaster(db!, admin, kind, `${MANIFEST_KEY}:${kind}:${keyPart}`, { action: "save", expectedVersion: 0, reason: REASON, values: { ...values, active: true } });
    ids.set(`${kind}:${code}`, result.id);
  };
  for (const [code, name] of storage) await save("storage-conditions", code, { code, name });
  for (const [code, name, wheelCount] of vehicleTypes) await save("vehicle-types", code, { code, name, wheelCount });
  for (const [code, name] of productCategories) await save("product-categories", code, { code, name });
  for (const [code, name] of consignmentCategories) {
    const row = await db.consignmentCategory.findUnique({ where: { code } });
    if (!row) await save("consignment-categories", code, { code, name });
  }
  for (const [code, name, address] of warehouses) await save("warehouses", code, { code, name, address });
  for (const [code, name] of departments) await save("departments", code, { code, name });
  for (const [index, [code, name]] of drivers.entries()) await save("drivers", code, { code, name, phone: `000-000-${String(index + 101).padStart(4, "0")}` });
  for (const [plate, province, brand, model, color, type, cond, capacity] of vehicles) {
    await save("vehicles", plate, { plateNormalized: plate, province, brand, model, color, typeId: ids.get(`vehicle-types:${type}`)!, wheelCount: vehicleTypes.find((t) => t[0] === type)![2],
      bodyDescription: "ตู้ควบคุมอุณหภูมิ (ทดสอบ)", storageConditionId: ids.get(`storage-conditions:${cond}`)!, capacity, capacityUnit: "KG", ownerName: "บริษัททดสอบ (ไม่ใช่ข้อมูลจริง)" });
  }
  for (const [index, [code, name, destinationType, aliases, subdistrict, district, province, postalCode]] of branches.entries()) {
    await save("branches", code, { code, name, destinationType, aliases, addressLine: `ที่อยู่ทดสอบ เลขที่ ${index + 10} ถนนทดสอบ (ไม่ใช่ที่อยู่จริง)`, subdistrict, district, province, postalCode,
      contactName: `ผู้รับทดสอบ ${name.replace(/^สาขาทดสอบ |ทดสอบ$/g, "")}`, contactPhone: `000-000-${String(index + 201).padStart(4, "0")}`, receivingFromMinute: "06:00", receivingToMinute: "18:00", activeFrom: ACTIVE_FROM });
  }

  // The other mock accounts need the branch, warehouse, driver and department created above.
  await ensureMockAccounts(db);

  const payload = { storage: storage.length, vehicleTypes: vehicleTypes.length, productCategories: productCategories.length, warehouses: warehouses.length, departments: departments.length, drivers: drivers.length, vehicles: vehicles.length, branches: branches.length, accounts: MOCK_ACCOUNTS.length, planning: "none", consignments: "none" };
  if (!await db.seedManifest.findUnique({ where: { key: MANIFEST_KEY } })) await db.seedManifest.create({ data: { key: MANIFEST_KEY, version: 1, checksum: createHash("sha256").update(JSON.stringify(payload)).digest("hex"), payload } });

  console.log(`PASS: mock-up master data and ${MOCK_ACCOUNTS.length} mock accounts (five account types) are in moointer_dev (manifest ${MANIFEST_KEY}). No route, template, plan, trip or consignment was created. Logins are in ignored ${MOCK_LOGIN_FILE}; values not printed.`);
} catch (error) {
  // Business errors carry a safe Thai message; anything else is reported by class and code only.
  const e = error as Error & { code?: string };
  console.error(`MOCKUP_SEED_FAILED (${e?.name === "DomainError" ? `${e.code}: ${e.message}` : `${e?.name ?? "UNKNOWN"} ${e?.code ?? ""}`.trim()}) — records written before the failure remain; re-run after fixing.`);
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
