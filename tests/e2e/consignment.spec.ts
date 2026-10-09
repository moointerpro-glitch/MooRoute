import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

// Synthetic fixture (tests/fixtures/search.ts): trip s5-2028-03-01-trip-1 visits synthetic branch A on 01/03/2571.
const account = JSON.parse(readFileSync(".local/auth/e2e-search.json", "utf8")) as Record<"password" | "requester" | "branch" | "dispatcher" | "warehouse" | "supervisor", string>;
const A = "synthetic-branch-a", TRIP = "s5-2028-03-01-trip-1";
const evidence = "docs/evidence/consignment-flow";
mkdirSync(evidence, { recursive: true });
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("synthetic-test-image")]);

// One UI sign-in per account (the real throttle allows 5 attempts per minute).
const sessions = new Map<string, Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>>();
async function login(page: Page, email: string) {
  await page.context().clearCookies();
  const cached = sessions.get(email);
  if (cached) { await page.context().addCookies(cached); return; }
  await page.goto("/login?next=%2Fconsignments");
  await page.getByLabel("อีเมล").fill(email); await page.getByLabel("รหัสผ่าน").fill(account.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/consignments$/);
  sessions.set(email, await page.context().cookies());
}
const status = (page: Page) => page.locator(".status-pill.large");
const success = (page: Page) => page.locator(".form-success");
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("D216: dispatcher self-review is disabled in the UI and denied by the mutation API", async ({ page }) => {
  await login(page, account.dispatcher);
  await page.goto("/consign");
  await page.getByLabel(/^หมวดสิ่งของ/).selectOption({ label: "เอกสาร" });
  const categoryId = await page.getByLabel(/^หมวดสิ่งของ/).inputValue();
  const post = (action: string, input: unknown) => page.request.post("/api/consignments", { headers: { Origin: "http://127.0.0.1:3011", "Idempotency-Key": `self-${action}-${Date.now()}` }, data: { action, input } });
  // A request in the shape used before D234/D236 (one count and a separate item list) is still accepted.
  const created = await post("saveDraft", { expectedVersion: 0, departmentId: "synthetic-department", sourceWarehouseId: "synthetic-warehouse", destinationBranchId: A,
    requestedServiceDate: "2028-03-01", requestedRoundNo: 1, requestedTripId: null, senderName: "ผู้วางแผนขนส่งฝากเอง (สังเคราะห์)", senderPhone: "000-000-1000",
    recipientName: null, recipientPhone: null, receiptMode: "PACKAGES", packageCount: 1, packageWeight: null, packageWeightUnit: null, notes: null,
    items: [{ categoryId, name: "เอกสารสังเคราะห์", quantity: "1", unit: "SHEET" }] });
  expect(created.status()).toBe(200);
  const d = await created.json();
  const submitted = await post("submit", { id: d.id, expectedVersion: d.version });
  expect(submitted.status()).toBe(200);
  const s = await submitted.json();
  await page.goto(`/consignments/${d.id}`);
  await expect(page.getByRole("row", { name: /^หีบห่อ 1 —/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /เอกสารสังเคราะห์.*เอกสาร.*1 แผ่น/ })).toBeVisible();
  await page.getByText("ขั้นตอนที่ยังดำเนินการไม่ได้", { exact: true }).click();
  await expect(page.getByRole("button", { name: "จัดรถ", exact: true })).toBeDisabled();
  await expect(page.getByText("คำขอที่คุณสร้างต้องให้ผู้วางแผนขนส่งอีกคนตรวจและจัดรถ").first()).toBeVisible();
  // The requester may still cancel their own pending request; there is no reject action any more (D236).
  await expect(page.locator(".action-buttons").getByRole("button")).toHaveText(["ยกเลิกรายการ"]);
  mkdirSync("docs/evidence/access-policy", { recursive: true });
  await page.screenshot({ path: "docs/evidence/access-policy/self-review-blocked.png", fullPage: true });
  const denied = await post("assign", { id: d.id, expectedVersion: s.version, tripId: TRIP });
  expect(denied.status()).toBe(403);
  expect((await denied.json()).code).toBe("SELF_REVIEW");
  expect((await post("reject", { id: d.id, expectedVersion: s.version, reason: "ไม่มีการกระทำนี้แล้ว" })).status()).toBe(400);
});

let pendingUrl = "";
test("D233: warehouse without department membership chooses and changes its sender department", async ({ page }) => {
  await login(page, account.warehouse);
  await page.goto("/consign");
  const nav = page.getByRole("navigation", { name: "เมนูหลัก" });
  for (const label of ["ค้นหาเส้นทาง", "รอบรถทั้งหมด", "สาขาทั้งหมด", "ฝากของส่งรถ", "ติดตาม", "ประวัติ"]) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "จัดการหลังบ้าน" })).toHaveCount(0);
  await expect(page.getByLabel("แผนกผู้ส่ง",{exact:false})).toHaveValue("");
  await page.getByRole("button",{name:"บันทึกฉบับร่าง",exact:true}).click();
  await expect(page.locator(".form-error")).toContainText("กรุณาเลือกแผนกผู้ส่ง");
  await page.getByLabel("แผนกผู้ส่ง",{exact:false}).selectOption("synthetic-department");
  await page.screenshot({ path: "docs/evidence/access-policy/warehouse-own-form.png", fullPage: true });
  await page.getByLabel("สาขาปลายทาง").selectOption(A);
  await page.getByLabel("วันที่ต้องการส่ง (พ.ศ.)").fill("01/03/2571");
  await page.getByLabel("เบอร์ติดต่อผู้ฝาก").fill("000-000-1000");
  // D236: one table. A row needs its packaging, a count and the item name; the inner quantity is optional.
  await expect(page.getByRole("heading", { name: /รายการสิ่งของข้างใน/ })).toHaveCount(0);
  await expect(page.locator(".problem-list")).toContainText("กรุณาเลือกหมวดสิ่งของ");
  await page.getByLabel(/^หมวดสิ่งของ/).selectOption({ label: "เอกสาร" });
  await page.getByLabel("บรรจุภัณฑ์ของแถวที่ 1").selectOption("ENVELOPE");
  await page.getByLabel("จำนวนของแถวที่ 1").fill("1");
  await expect(page.locator(".problem-list")).toContainText("กรุณากรอกชื่อรายการของทุกแถวว่าข้างในคืออะไร");
  await page.getByLabel("ชื่อรายการของแถวที่ 1").fill("เอกสารจากคลัง (สังเคราะห์)");
  await expect(page.getByText("ข้อมูลครบ พร้อมส่งให้ผู้วางแผนขนส่งตรวจสอบ")).toBeVisible();
  await expect(page.getByLabel(/ให้สาขานับจำนวนข้างใน/)).toHaveCount(0);
  await page.getByRole("button",{name:"บันทึกฉบับร่าง",exact:true}).click();
  await expect(success(page)).toContainText("บันทึกฉบับร่างแล้ว");
  await page.getByLabel("แผนกผู้ส่ง",{exact:false}).selectOption("synthetic-choice-department");
  await page.getByRole("button",{name:"บันทึกฉบับร่าง",exact:true}).click();
  await expect(success(page)).toContainText("รุ่น 2");
  await page.reload();
  await expect(page.getByLabel("แผนกผู้ส่ง",{exact:false})).toHaveValue("synthetic-choice-department");
  await expect(page.getByLabel("บรรจุภัณฑ์ของแถวที่ 1")).toHaveValue("ENVELOPE");
  await expect(page.getByLabel("ชื่อรายการของแถวที่ 1")).toHaveValue("เอกสารจากคลัง (สังเคราะห์)");
  await page.getByRole("button", { name: "ส่งคำขอ", exact: true }).click();
  await expect(status(page)).toHaveText("รอตรวจสอบ");
  pendingUrl = page.url().split("?")[0];
  await expect(page.getByRole("row", { name: /^ซอง 1 เอกสารจากคลัง/ })).toBeVisible();
  await expect(page.getByText(/^ซอง 1 · หมวดเอกสาร/)).toBeVisible();
  await expect(page.getByText(/โดย .*แผนกเลือกตอนฝาก \(สังเคราะห์\)/)).toBeVisible();
  await page.goto("/consign");
  await expect(page.getByLabel("แผนกผู้ส่ง",{exact:false})).toHaveValue("");
  expect((await page.request.get("/api/planning?date=2028-03-01")).status()).toBe(403);
});
let consignmentUrl = "", code = "";
// Full-page capture positions fixed elements relative to the current scroll; capture from the top.
async function shot(page: Page, path: string) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path, fullPage: true }); }
const dialog = (page: Page) => page.locator("dialog.planning-dialog");
const steps = (page: Page) => page.locator(".progress-step").evaluateAll((list) => list.map((li) => li.className.replace("progress-step step-", "")));

test("T14/T15/T18 and D236: one table, progress to delivery, a dialog per action, through every role", async ({ page }) => {
  await login(page, account.requester);
  await page.goto(`/trips/${TRIP}?branch=${A}`);
  await page.getByRole("link", { name: "ฝากของกับรอบนี้" }).click();
  await expect(page.getByLabel("สาขาปลายทาง")).toHaveValue(A);
  await page.getByLabel("แผนกผู้ส่ง",{exact:false}).selectOption("synthetic-department");
  await expect(page.getByText(/s5-2028-03-01-trip-1|เส้นทางทดสอบ/).first()).toBeVisible();
  await page.getByLabel("เบอร์ติดต่อผู้ฝาก").fill("000-000-1000");
  // One table: 2 boxes of posters with an inner quantity, and 1 custom container without one.
  await page.getByLabel(/^หมวดสิ่งของ/).selectOption({ label: "สื่อการตลาด" });
  await page.getByLabel("บรรจุภัณฑ์ของแถวที่ 1").selectOption("BOX");
  await page.getByLabel("จำนวนของแถวที่ 1").fill("2");
  await page.getByLabel("ชื่อรายการของแถวที่ 1").fill("โปสเตอร์โปรโมชัน (ข้อมูลสังเคราะห์)");
  await page.getByLabel("จำนวนข้างในของแถวที่ 1").fill("30");
  await expect(page.locator(".problem-list")).toContainText("แถวที่ 1: กรุณากรอกจำนวนข้างในและหน่วยให้ครบคู่");
  await page.getByLabel("หน่วยของแถวที่ 1").selectOption("SHEET");
  await page.getByLabel("รายละเอียดของแถวที่ 1").fill("ระวังพับ");
  await page.getByRole("button", { name: "เพิ่มแถว", exact: true }).click();
  await page.getByLabel("บรรจุภัณฑ์ของแถวที่ 2").selectOption("OTHER");
  await page.getByLabel("จำนวนของแถวที่ 2").fill("1");
  await expect(page.locator(".problem-list")).toContainText("แถวที่ 2: กรุณาพิมพ์ชื่อบรรจุภัณฑ์");
  await page.getByLabel("ชื่อบรรจุภัณฑ์ของแถวที่ 2").fill("ถัง");
  await page.getByLabel("ชื่อรายการของแถวที่ 2").fill("ขาตั้งโปสเตอร์ (ข้อมูลสังเคราะห์)");
  await expect(page.locator(".pack-total")).toHaveText("กล่อง 2 · ถัง 1 (รวม 3)");
  await expect(page.getByLabel(/น้ำหนัก/)).toHaveCount(0);
  await page.getByLabel(/ให้สาขานับจำนวนข้างในตอนรับของด้วย/).check();
  await expect(page.getByText("ข้อมูลครบ พร้อมส่งให้ผู้วางแผนขนส่งตรวจสอบ")).toBeVisible();
  await page.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
  await expect(success(page)).toContainText("บันทึกฉบับร่างแล้ว");
  await expect(page).toHaveURL(/\/consign\?id=/);
  await page.reload();
  await expect(page.getByLabel("แผนกผู้ส่ง",{exact:false})).toHaveValue("synthetic-department");
  await expect(page.getByLabel("ชื่อบรรจุภัณฑ์ของแถวที่ 2")).toHaveValue("ถัง");
  await expect(page.getByLabel("จำนวนข้างในของแถวที่ 1")).toHaveValue("30");
  await expect(page.getByLabel(/ให้สาขานับจำนวนข้างในตอนรับของด้วย/)).toBeChecked();
  await page.waitForLoadState("networkidle");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "not-really.png", mimeType: "image/png", buffer: Buffer.from("<html>not an image</html>") });
  await expect(page.locator(".form-error")).toContainText("รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF");
  await fileInput.setInputFiles({ name: "แบบโปสเตอร์.png", mimeType: "image/png", buffer: png });
  await expect(success(page)).toContainText("แนบไฟล์แล้ว");
  await shot(page, `${evidence}/consign-form-1440.png`);
  await page.getByRole("button", { name: "ส่งคำขอ" }).click();
  await expect(page).toHaveURL(/\/consignments\/[^/?]+\?submitted=1/);
  await expect(status(page)).toHaveText("รอตรวจสอบ");
  consignmentUrl = page.url().split("?")[0]; code = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
  expect(code).toMatch(/^FS-\d{8}-/);
  await expect(page.getByText("ส่งคำขอแล้ว ผู้วางแผนขนส่งจะตรวจสอบ")).toBeVisible();
  // The table mirrors the form: no weight and no "where is it now" column, no internal package code.
  await expect(page.locator("#items-title ~ .table-scroll thead th")).toHaveText(["บรรจุภัณฑ์", "จำนวน", "ชื่อรายการ", "จำนวนข้างใน", "รายละเอียด"]);
  // D237: the packaging is the unit of the count; the word for a generic piece is not used.
  await expect(page.getByRole("row", { name: /^กล่อง 2 โปสเตอร์โปรโมชัน.*30 แผ่น.*ระวังพับ/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /^ถัง 1 ขาตั้งโปสเตอร์/ })).toBeVisible();
  await expect(page.locator(".detail-page")).not.toContainText("ชิ้น");
  await expect(page.locator(".package-list")).toBeHidden();
  await page.getByText("ดูทีละบรรจุภัณฑ์ (3)").click();
  await expect(page.locator(".package-list li")).toHaveText([/^กล่อง 1\/3.*อยู่กับผู้ฝาก/, /^กล่อง 2\/3.*อยู่กับผู้ฝาก/, /^ถัง 3\/3.*อยู่กับผู้ฝาก/]);
  await expect(page.locator(".package-list")).not.toContainText(code);
  // Progress: the whole path to delivery is visible from the start.
  await expect(page.locator(".progress-step strong")).toHaveText(["1. ส่งคำขอ", "2. จัดรถ", "3. คลังรับของ", "4. ขึ้นรถ", "5. รถออก", "6. สาขารับของ", "7. จัดส่งสำเร็จ"]);
  expect(await steps(page)).toEqual(["done", "current", "todo", "todo", "todo", "todo", "todo"]);
  await expect(page.locator(".progress-next")).toHaveText("ขั้นต่อไป: รอผู้วางแผนขนส่งจัดรถ");
  await expect(page.locator(".action-buttons").getByRole("button")).toHaveText(["ยกเลิกรายการ"]);
  // Tracking: unfinished work with its next step; typing searches without a button.
  await page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "ติดตาม", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ติดตามงานฝากส่ง" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ค้นหา", exact: true })).toHaveCount(0);
  await page.getByPlaceholder(/พิมพ์เพื่อค้นหา/).fill(code);
  await expect(page).toHaveURL(new RegExp(`/tracking\\?q=${code}`));
  await expect(page.locator(".count-badge")).toHaveText("พบ 1 รายการ");
  await expect(page.locator(".history-item")).toContainText("ขั้นต่อไป: รอผู้วางแผนขนส่งจัดรถ");
  await expect(page.locator(".history-item")).toContainText("กล่อง 2 · ถัง 1 (รวม 3) — โปสเตอร์โปรโมชัน (ข้อมูลสังเคราะห์) 30 แผ่น, ขาตั้งโปสเตอร์ (ข้อมูลสังเคราะห์)");
  await expect(page.locator(".auto-refresh")).toContainText("อัปเดตเองทุก 20 วินาที");
  await expect(page.getByPlaceholder(/พิมพ์เพื่อค้นหา/)).toBeFocused();
  await page.getByPlaceholder(/พิมพ์เพื่อค้นหา/).fill("ไม่มีรายการนี้แน่นอน");
  await expect(page.locator(".count-badge")).toHaveText("พบ 0 รายการ");
  await page.getByRole("button", { name: "ล้างตัวกรอง" }).click();
  await expect(page).toHaveURL(/\/tracking$/);
  await shot(page, `${evidence}/tracking-1440.png`);
  await page.goto(`/consignments?q=${encodeURIComponent(code)}`);
  await expect(page.locator(".count-badge")).toHaveText("พบ 0 รายการ");

  await login(page, account.dispatcher);
  // Arrive from the tracking list, so that going back later shows whether the list follows the workflow.
  await page.goto(`/tracking?q=${encodeURIComponent(code)}`);
  await expect(page.locator(".history-item .status-pill")).toHaveText("รอตรวจสอบ");
  await page.getByRole("link", { name: code }).click();
  await expect(page).toHaveURL(consignmentUrl);
  // Nothing to fill in until an action is chosen: no reject, no reason box on the page.
  await expect(page.locator(".action-buttons").getByRole("button")).toHaveText(["จัดรถ", "ยกเลิกรายการ"]);
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.getByRole("button", { name: "ยกเลิกรายการ" }).click();
  await expect(dialog(page).getByRole("heading")).toHaveText(`ยกเลิกรายการ ${code}`);
  await dialog(page).getByRole("button", { name: "ยืนยันยกเลิกรายการ" }).click();
  await expect(dialog(page).locator(".form-error")).toContainText("กรุณาระบุเหตุผลอย่างน้อย");
  await dialog(page).getByRole("button", { name: "ปิดโดยไม่บันทึก" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(status(page)).toHaveText("รอตรวจสอบ");
  await page.getByRole("button", { name: "จัดรถ", exact: true }).click();
  await expect(dialog(page).getByRole("heading")).toHaveText(`จัดรถ ${code}`);
  // The trips of the requested date load by themselves; the calendar works inside the dialog.
  await expect(dialog(page).locator(`input[type="radio"][value="${TRIP}"]`)).toBeVisible();
  await dialog(page).getByRole("button", { name: "วันถัดไป" }).click();
  await expect(dialog(page).getByLabel("วันที่ให้บริการ (พ.ศ.)")).toHaveValue("02/03/2571");
  await expect(dialog(page).locator(`input[type="radio"][value="${TRIP}"]`)).toHaveCount(0);
  await dialog(page).getByRole("button", { name: "เลือกวันที่จากปฏิทิน" }).click();
  await dialog(page).locator(".picker-popover").getByRole("button", { name: /(^|[^0-9])1 มีนาคม/ }).click();
  await expect(dialog(page).getByLabel("วันที่ให้บริการ (พ.ศ.)")).toHaveValue("01/03/2571");
  await dialog(page).locator(`input[type="radio"][value="${TRIP}"]`).check();
  await shot(page, `${evidence}/assign-dialog-1440.png`);
  await dialog(page).getByRole("button", { name: "ยืนยันจัดรถ" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(success(page)).toContainText("จัดรถแล้ว");
  await expect(status(page)).toHaveText("จัดรถแล้ว");
  expect(await steps(page)).toEqual(["done", "done", "current", "todo", "todo", "todo", "todo"]);
  // Back to tracking with the browser's Back button: the list shows the new status and the next step.
  // (This already held before D237, because acting on the detail page invalidates the client cache;
  // the case D237 adds is another person acting, tested in the next test.)
  await page.goBack();
  await expect(page).toHaveURL(/\/tracking\?q=/);
  await expect(page.locator(".history-item .status-pill")).toHaveText("จัดรถแล้ว");
  await expect(page.locator(".history-item")).toContainText("ขั้นต่อไป: รอคลังต้นทางรับของจากผู้ฝาก");
  await expect(page.locator(".status-chip.selected")).toContainText("ทั้งหมด");

  await login(page, account.warehouse);
  await page.goto(consignmentUrl);
  await page.getByRole("button", { name: "คลังรับของ", exact: true }).click();
  await dialog(page).getByRole("button", { name: "ยืนยันคลังรับของ" }).click();
  await expect(dialog(page).locator(".form-error")).toContainText("กรุณาตรวจนับและเลือกให้ครบ: กล่อง 2 · ถัง 1 (รวม 3)");
  await expect(dialog(page).getByLabel(/^ถัง 3\/3/)).toBeVisible();
  await dialog(page).getByRole("button", { name: "เลือกครบทั้งหมด" }).click();
  await dialog(page).getByRole("button", { name: "ยืนยันคลังรับของ" }).click();
  await expect(status(page)).toHaveText("คลังรับของแล้ว");
  await page.getByRole("button", { name: "ขึ้นรถ", exact: true }).click();
  await dialog(page).getByRole("button", { name: "เลือกครบทั้งหมด" }).click();
  await dialog(page).getByRole("button", { name: "ยืนยันขึ้นรถ" }).click();
  await expect(status(page)).toHaveText("ขึ้นรถแล้ว");
  await login(page, account.branch);
  await page.goto(consignmentUrl);
  await page.getByText("ขั้นตอนที่ยังดำเนินการไม่ได้", { exact: true }).click();
  await expect(page.getByRole("button", { name: "บันทึกรับของ", exact: true })).toBeDisabled();
  await expect(page.getByText("ต้องขึ้นรถและบันทึกรถออกก่อนรับของ")).toBeVisible();
  await expect(page.getByRole("button", { name: "จัดรถ", exact: true })).toHaveCount(0);
  await expect(page.locator(".progress-next")).toHaveText("ขั้นต่อไป: รอคลังต้นทางหรือคนขับบันทึกรถออก");
  await login(page, account.warehouse);
  await page.goto(consignmentUrl);
  await page.getByRole("button", { name: "บันทึกรถออก", exact: true }).click();
  await dialog(page).getByRole("button", { name: "ยืนยันรถออกทั้งรอบ" }).click();
  await expect(status(page)).toHaveText("อยู่ระหว่างขนส่ง");

  await login(page, account.branch);
  await page.goto(consignmentUrl);
  await page.getByRole("button", { name: "สาขารับของ", exact: true }).click();
  const scan = dialog(page).getByLabel("สแกนคิวอาร์ หรือพิมพ์เลขบนฉลาก");
  // The full code still works for a scanner; a person types only the number printed large on the label.
  await scan.fill(`${code}-1/3`); await scan.press("Enter");
  await expect(dialog(page).locator(".form-success")).toContainText("เพิ่ม กล่อง 1/3 แล้ว");
  await scan.fill("9"); await scan.press("Enter");
  await expect(dialog(page).locator(".form-error")).toContainText("ไม่พบเลข “9” ในใบฝากนี้");
  await scan.fill("2"); await scan.press("Enter");
  await expect(dialog(page).locator(".form-success")).toContainText("เพิ่ม กล่อง 2/3 แล้ว");
  await expect(dialog(page).getByLabel(/^กล่อง 2\/3/)).toBeChecked();
  await dialog(page).locator(".qty-fields input").fill("20");
  await dialog(page).getByRole("button", { name: "บันทึกรับของ" }).click();
  await expect(status(page)).toHaveText("รับบางส่วน");
  await expect(page.locator(".progress-next")).toContainText("รับแล้ว 2 จาก 3 รอสาขา");
  await expect(page.getByRole("row", { name: /กล่อง.*30 แผ่น.*รับแล้ว 20/ })).toBeVisible();
  await page.getByRole("button", { name: "สาขารับของ", exact: true }).click();
  await dialog(page).getByLabel(/^ถัง 3\/3/).check();
  await dialog(page).locator(".qty-fields input").fill("11");
  await dialog(page).getByRole("button", { name: "บันทึกรับของ" }).click();
  await expect(dialog(page).locator(".form-error")).toContainText("จำนวนรับเกินจำนวนที่ส่ง");
  await dialog(page).locator(".qty-fields input").fill("10");
  await dialog(page).getByRole("button", { name: "บันทึกรับของ" }).click();
  await expect(status(page)).toHaveText("รับครบแล้ว");
  expect(await steps(page)).toEqual(["done", "done", "done", "done", "done", "done", "current"]);
  await page.getByRole("button", { name: "ยืนยันจัดส่งสำเร็จ", exact: true }).click();
  await expect(dialog(page)).toContainText("สาขารับแล้ว 3 จาก 3");
  await dialog(page).getByRole("button", { name: "ยืนยันจัดส่งสำเร็จ" }).click();
  await expect(status(page)).toHaveText("จัดส่งสำเร็จ");
  expect(await steps(page)).toEqual(["done", "done", "done", "done", "done", "done", "done"]);
  await expect(page.locator(".progress-next")).toHaveText("สถานะสุดท้าย: จัดส่งสำเร็จ");
  await expect(page.getByRole("link", { name: "กลับไปประวัติ" })).toBeVisible();
  for (const label of ["ส่งคำขอ", "จัดรถ", "คลังรับของ", "ขึ้นรถ", "รถออก", "สาขารับของ", "ปิดงาน"]) await expect(page.locator(".timeline strong", { hasText: label }).first()).toBeVisible();
  const download = await page.request.get(await page.getByRole("link", { name: "แบบโปสเตอร์.png" }).getAttribute("href") ?? "");
  expect(download.status()).toBe(200); expect(download.headers()["content-type"]).toBe("image/png"); expect(download.headers()["cache-control"]).toContain("no-store");
  expect(download.headers()["content-security-policy"]).toBe("default-src 'none'; sandbox"); expect(download.headers()["content-disposition"]).toContain("attachment");
  await shot(page, `${evidence}/consignment-detail-1440.png`);
});

test("T13, D236 and D237: history holds finished work, tracking follows another person's step by itself, the planner cancels a pending request, CSV export and denials", async ({ page, request, browser }) => {
  const anonymous = await request.get("/api/consignments");
  expect(anonymous.status()).toBe(401);
  await login(page, account.dispatcher);
  // The delivered request left tracking and is in history; typing searches by itself.
  await page.goto(`/tracking?q=${encodeURIComponent(code)}`);
  await expect(page.locator(".count-badge")).toHaveText("พบ 0 รายการ");
  await page.goto("/consignments");
  await expect(page.getByRole("heading", { name: "ประวัติฝากส่ง" })).toBeVisible();
  await page.getByPlaceholder(/พิมพ์เพื่อค้นหา/).fill("โปสเตอร์โปรโมชัน");
  await expect(page).toHaveURL(/\/consignments\?q=/);
  await expect(page.locator(".count-badge")).toHaveText("พบ 1 รายการ");
  await expect(page.getByRole("link", { name: code })).toBeVisible();
  await expect(page.locator(".history-item .status-pill")).toHaveText("จัดส่งสำเร็จ");
  await page.getByLabel("สถานะ").selectOption("CANCELLED");
  await expect(page.locator(".count-badge")).toHaveText("พบ 0 รายการ");
  const csv = await page.request.get(`/api/consignments/export?phase=finished&q=${encodeURIComponent(code)}`);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text.charCodeAt(0)).toBe(0xfeff); expect(text).toContain(code); expect(text).toContain("จัดส่งสำเร็จ"); expect(text).toContain("สื่อการตลาด"); expect(text).toContain("กล่อง 2 · ถัง 1");
  // D237: tracking follows the workflow by itself. Another person (the warehouse account in its own browser
  // session) submits a request and later cancels it; the planner's open list changes with no click and no reload.
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3011", locale: "th-TH", timezoneId: "Asia/Bangkok" });
  await other.addCookies(sessions.get(account.warehouse)!);
  const api = (action: string, input: unknown) => other.request.post("/api/consignments", { headers: { Origin: "http://127.0.0.1:3011", "Idempotency-Key": `live-${action}-${Date.now()}` }, data: { action, input } });
  const delivered = await (await page.request.get(`/api/consignments/${consignmentUrl.split("/").pop()}`)).json();
  const made = await (await api("saveDraft", { expectedVersion: 0, departmentId: "synthetic-department", sourceWarehouseId: "synthetic-warehouse", destinationBranchId: A,
    requestedServiceDate: "2028-03-01", requestedRoundNo: 1, requestedTripId: null, senderName: "คลังฝากเอง (สังเคราะห์)", senderPhone: "000-000-1000", recipientName: null, recipientPhone: null,
    notes: null, receiptMode: "PACKAGES", categoryId: delivered.categoryId, packaging: [{ kind: "ROLL", customName: null, count: 1, name: "ป้ายราคา (สังเคราะห์)", quantity: null, unit: null, description: null, weight: null }] })).json();
  const sent = await (await api("submit", { id: made.id, expectedVersion: made.version })).json();
  expect(sent.status).toBe("PENDING_REVIEW");
  await page.goto(`/tracking?q=${encodeURIComponent(made.code)}`);
  await expect(page.locator(".history-item")).toContainText("ม้วน 1 — ป้ายราคา (สังเคราะห์)");
  await expect(page.locator(".history-item .status-pill")).toHaveText("รอตรวจสอบ");
  expect((await api("cancel", { id: made.id, expectedVersion: sent.version, reason: "ยกเลิกโดยผู้ฝากจากอีกเครื่อง (ทดสอบ)" })).status()).toBe(200);
  // No interaction with the page from here: the timer re-reads the list and the request leaves tracking.
  await expect(page.locator(".count-badge")).toHaveText("พบ 0 รายการ", { timeout: 30_000 });
  await page.goto(`/consignments?q=${encodeURIComponent(made.code)}`);
  await expect(page.locator(".history-item .status-pill")).toHaveText("ยกเลิก");
  await other.close();
  // D236: instead of "reject", the planner cancels the warehouse's pending request with a reason.
  await page.goto(pendingUrl);
  await expect(page.locator(".action-buttons").getByRole("button")).toHaveText(["จัดรถ", "ยกเลิกรายการ"]);
  await page.getByRole("button", { name: "ยกเลิกรายการ" }).click();
  await dialog(page).getByLabel(/เหตุผลการยกเลิก/).fill("ไม่มีรอบรถไปสาขานี้ในวันที่ต้องการ (ทดสอบ)");
  await dialog(page).getByRole("button", { name: "ยืนยันยกเลิกรายการ" }).click();
  await expect(status(page)).toHaveText("ยกเลิก");
  await expect(page.locator(".progress-stopped")).toContainText("ยกเลิกแล้ว");
  await expect(page.locator(".progress-stopped")).toContainText("เหตุผล: ไม่มีรอบรถไปสาขานี้ในวันที่ต้องการ (ทดสอบ)");
  expect(await steps(page)).toEqual(["done", "unreached", "unreached", "unreached", "unreached", "unreached", "unreached"]);
  await expect(page.locator(".action-buttons").getByRole("button")).toHaveCount(0);
  const attachmentHref = await (await page.goto(consignmentUrl), page.getByRole("link", { name: "แบบโปสเตอร์.png" }).getAttribute("href"));
  expect(attachmentHref).toMatch(/^\/api\/attachments\//);
  expect((await request.get(attachmentHref!)).status()).toBe(401);
  const forged = await page.request.post("/api/consignments", { headers: { "Content-Type": "application/json", "Idempotency-Key": "forged-1", Origin: "http://127.0.0.1:3011" }, data: { action: "close", input: { id: consignmentUrl.split("/").pop(), expectedVersion: 1 } } });
  expect([403, 409, 400]).toContain(forged.status());
  await login(page, account.warehouse);
  const wrongRole = await page.request.post("/api/consignments", { headers: { "Content-Type": "application/json", "Idempotency-Key": "forged-2", Origin: "http://127.0.0.1:3011" }, data: { action: "assign", input: { id: consignmentUrl.split("/").pop(), expectedVersion: 1, tripId: TRIP } } });
  expect(wrongRole.status()).toBe(403);
  const crossOrigin = await page.request.post("/api/consignments", { headers: { "Content-Type": "application/json", "Idempotency-Key": "forged-3", Origin: "http://evil.example" }, data: { action: "close", input: {} } });
  expect(crossOrigin.status()).toBe(403);
});

for (const width of [1440, 768, 390]) {
  test(`T19: Thai consignment form, tracking, history and detail at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page, account.requester);
    for (const [name, url, ready] of [["form", "/consign", "ตรวจสอบก่อนส่ง"], ["tracking", "/tracking", "ติดตามงานฝากส่ง"], ["history", "/consignments", "ประวัติฝากส่ง"], ["detail", consignmentUrl, "ความคืบหน้า"]] as const) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: ready })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `${evidence}/${name}-${width}.png`);
    }
  });
}
