import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

// Synthetic fixture (tests/fixtures/search.ts): trip s5-2028-03-01-trip-1 visits synthetic branch A on 01/03/2571.
const account = JSON.parse(readFileSync(".local/auth/e2e-search.json", "utf8")) as Record<"password" | "requester" | "branch" | "dispatcher" | "warehouse" | "supervisor", string>;
const A = "synthetic-branch-a", TRIP = "s5-2028-03-01-trip-1";
const evidence = "docs/evidence/phase-6";
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
let consignmentUrl = "", code = "";
// Full-page capture positions fixed elements relative to the current scroll; capture from the top.
async function shot(page: Page, path: string) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path, fullPage: true }); }

test("T14/T15/T18: marketing posters from search to closed receipt through every role", async ({ page }) => {
  await login(page, account.requester);
  await page.goto(`/trips/${TRIP}?branch=${A}`);
  await page.getByRole("link", { name: "ฝากของกับรอบนี้" }).click();
  await expect(page.getByLabel("สาขาปลายทาง")).toHaveValue(A);
  await expect(page.getByText(/s5-2028-03-01-trip-1|เส้นทางทดสอบ/).first()).toBeVisible();
  await page.getByLabel("เบอร์ติดต่อผู้ฝาก").fill("000-000-1000");
  await page.getByLabel("หมวดของรายการที่ 1").selectOption({ label: "สื่อการตลาด" });
  await page.getByLabel("ชื่อรายการที่ 1").fill("โปสเตอร์โปรโมชัน (ข้อมูลสังเคราะห์)");
  await page.getByLabel("จำนวนของรายการที่ 1").fill("30");
  await page.getByLabel("หน่วยของรายการที่ 1").selectOption("SHEET");
  await page.getByRole("textbox", { name: /^จำนวนหีบห่อ/ }).fill("3");
  await page.getByLabel("ตรวจรับทั้งหีบห่อและจำนวนสิ่งของ").check();
  await expect(page.getByText("ข้อมูลครบ พร้อมส่งให้ผู้จัดรถตรวจสอบ")).toBeVisible();
  await page.getByRole("button", { name: "บันทึกฉบับร่าง" }).click();
  await expect(success(page)).toContainText("บันทึกฉบับร่างแล้ว");
  await expect(page).toHaveURL(/\/consign\?id=/);
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
  await expect(page.getByText("ส่งคำขอแล้ว ผู้จัดรถจะตรวจสอบ")).toBeVisible();

  await login(page, account.dispatcher);
  await page.goto(consignmentUrl);
  await page.getByRole("button", { name: "แสดงรอบรถ" }).click();
  await page.locator(`input[type="radio"][value="${TRIP}"]`).check();
  await page.getByRole("button", { name: "จัดรถ", exact: true }).click();
  await expect(status(page)).toHaveText("จัดรถแล้ว");

  await login(page, account.warehouse);
  await page.goto(consignmentUrl);
  await page.getByRole("button", { name: "ยืนยันคลังรับของ" }).click();
  await expect(page.locator(".form-error")).toContainText("กรุณาตรวจและยืนยันหีบห่อครบทั้ง 3 หีบห่อ");
  await page.getByRole("button", { name: "เลือกครบทุกหีบห่อ" }).click();
  await page.getByRole("button", { name: "ยืนยันคลังรับของ" }).click();
  await expect(status(page)).toHaveText("คลังรับของแล้ว");
  await page.getByRole("button", { name: "เลือกครบทุกหีบห่อ" }).click();
  await page.getByRole("button", { name: "ยืนยันขึ้นรถ" }).click();
  await expect(status(page)).toHaveText("ขึ้นรถแล้ว");
  await page.getByRole("button", { name: "บันทึกรถออกทั้งรอบ" }).click();
  await expect(status(page)).toHaveText("อยู่ระหว่างขนส่ง");

  await login(page, account.branch);
  await page.goto(consignmentUrl);
  const scan = page.getByLabel("สแกนหรือพิมพ์รหัสหีบห่อ");
  await scan.fill(`${code}-1/3`); await scan.press("Enter");
  await expect(success(page)).toContainText(`เพิ่ม ${code}-1/3 แล้ว`);
  await page.getByLabel(`${code}-2/3`).first().check();
  await page.locator(".qty-fields input").fill("20");
  await page.getByRole("button", { name: "บันทึกรับของ" }).click();
  await expect(status(page)).toHaveText("รับบางส่วน");
  await page.getByLabel(`${code}-3/3`).first().check();
  await page.locator(".qty-fields input").fill("11");
  await page.getByRole("button", { name: "บันทึกรับของ" }).click();
  await expect(page.locator(".form-error")).toContainText("จำนวนรับเกินจำนวนที่ส่ง");
  await page.locator(".qty-fields input").fill("10");
  await page.getByRole("button", { name: "บันทึกรับของ" }).click();
  await expect(status(page)).toHaveText("รับครบแล้ว");
  await page.getByRole("button", { name: "ปิดงาน", exact: true }).click();
  await expect(status(page)).toHaveText("ปิดงาน");
  for (const label of ["ส่งคำขอ", "จัดรถ", "คลังรับของ", "ขึ้นรถ", "รถออก", "สาขารับของ", "ปิดงาน"]) await expect(page.locator(".timeline strong", { hasText: label }).first()).toBeVisible();
  const download = await page.request.get(await page.getByRole("link", { name: "แบบโปสเตอร์.png" }).getAttribute("href") ?? "");
  expect(download.status()).toBe(200); expect(download.headers()["content-type"]).toBe("image/png"); expect(download.headers()["cache-control"]).toContain("no-store");
  expect(download.headers()["content-security-policy"]).toBe("default-src 'none'; sandbox"); expect(download.headers()["content-disposition"]).toContain("attachment");
  await shot(page, `${evidence}/consignment-detail-1440.png`);
});

test("T13: history scope, CSV export, unauthenticated and cross-role denial", async ({ page, request }) => {
  const anonymous = await request.get("/api/consignments");
  expect(anonymous.status()).toBe(401);
  await login(page, account.dispatcher);
  await page.goto(`/consignments?q=${encodeURIComponent(code)}`);
  await expect(page.locator(".count-badge")).toHaveText("พบ 1 รายการ");
  await expect(page.getByRole("link", { name: code })).toBeVisible();
  const csv = await page.request.get(`/api/consignments/export?q=${encodeURIComponent(code)}`);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text.charCodeAt(0)).toBe(0xfeff); expect(text).toContain(code); expect(text).toContain("ปิดงาน");
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
  test(`T19: Thai consignment form, history and detail at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page, account.requester);
    for (const [name, url, ready] of [["form", "/consign", "ตรวจสอบก่อนส่ง"], ["history", "/consignments", "รายการฝากของส่งรถ"], ["detail", consignmentUrl, "ลำดับเหตุการณ์"]] as const) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: ready })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await noHorizontalScroll(page)).toBe(true);
      await shot(page, `${evidence}/${name}-${width}.png`);
    }
  });
}
