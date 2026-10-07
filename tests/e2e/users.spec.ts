import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

// D223 browser flow on an isolated database. Sign-ins are limited to 5 per minute, so this spec uses three.
const credentials = JSON.parse(readFileSync(".local/auth/e2e.json", "utf8"));
const evidence = "docs/evidence/user-management";
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("อีเมลบัญชีผู้ใช้งาน").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
}
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("D223: the administrator creates, changes, resets and disables an account; the person signs in and is locked out", async ({ page, browser }) => {
  test.setTimeout(90_000);
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, credentials.admin, credentials.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: /ผู้ใช้งาน/ }).first().click();
  await expect(page.getByRole("heading", { name: "ผู้ใช้งาน", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "รายชื่อผู้ใช้งาน" })).toContainText("ผู้ดูแลสังเคราะห์");
  await page.screenshot({ path: `${evidence}/list-1440.png`, fullPage: true });

  // Create: the form asks only for the scope the chosen type needs.
  await page.getByRole("link", { name: "เพิ่มบัญชี" }).click();
  await page.getByLabel("ชื่อที่แสดง").fill("สมใจ ทดสอบหน้าจอ");
  await page.getByLabel("อีเมลเข้าสู่ระบบ").fill("new.person@e2e.synthetic.test");
  await page.getByRole("combobox", { name: /^แผนกต้นสังกัด/ }).selectOption({ index: 1 });
  await page.getByRole("button", { name: "สร้างบัญชี" }).click();
  await expect(page.locator(".user-form .form-error")).toContainText("เลือกประเภทบัญชี");
  await page.getByRole("radio", { name: /^คลังและรถขนส่ง/ }).check();
  await expect(page.getByRole("combobox", { name: /^คลังที่ประจำ/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^สาขาที่ประจำ/ })).toHaveCount(0);
  await page.getByRole("combobox", { name: /^คลังที่ประจำ/ }).selectOption({ index: 1 });
  await page.screenshot({ path: `${evidence}/new-1440.png`, fullPage: true });
  await page.getByRole("button", { name: "สร้างบัญชี" }).click();
  await expect(page.getByRole("heading", { name: "สร้างบัญชีแล้ว" })).toBeVisible();
  const password = (await page.locator(".password-reveal code").textContent())!.trim();
  expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  await page.screenshot({ path: `${evidence}/created-1440.png`, fullPage: true });

  // The new person signs in with the temporary password and sees their account type.
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3011", locale: "th-TH" }), person = await other.newPage();
  await login(person, "new.person@e2e.synthetic.test", password);
  await expect(person.getByRole("button", { name: /^บัญชี สมใจ/ })).toHaveAccessibleName(/คลังและรถขนส่ง$/);

  // Change type: takes effect on the person's next request.
  await page.getByRole("link", { name: "เปิดหน้าบัญชีนี้" }).click();
  await page.getByRole("radio", { name: /^พนักงานสาขา/ }).check();
  await page.getByRole("combobox", { name: /^สาขาที่ประจำ/ }).selectOption({ index: 1 });
  await page.getByLabel("เหตุผลการเปลี่ยนแปลง").fill("ย้ายไปประจำสาขา");
  await page.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".user-history")).toContainText("เปลี่ยนชื่อ ประเภท หรือขอบเขต");
  await person.reload();
  await expect(person.getByRole("button", { name: /^บัญชี สมใจ/ })).toHaveAccessibleName(/พนักงานสาขา$/);

  // A new temporary password ends the person's sessions.
  await page.getByRole("button", { name: "ออกรหัสผ่านชั่วคราวใหม่" }).click();
  await page.locator(".user-actions .delete-confirm input").fill("ลืมรหัสผ่าน");
  await page.getByRole("button", { name: /^ยืนยันออกรหัสผ่านใหม่/ }).click();
  await expect(page.getByRole("heading", { name: "ออกรหัสผ่านชั่วคราวใหม่แล้ว" })).toBeVisible();
  const second = (await page.locator(".password-reveal code").textContent())!.trim();
  expect(second).not.toBe(password);
  await person.goto("/consignments");
  await expect(person).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "เสร็จแล้ว ปิดรหัสผ่าน" }).click();
  await page.waitForLoadState("networkidle");

  // Disable: kept with its history, cannot sign in.
  await page.getByRole("button", { name: "ปิดใช้งานบัญชี" }).click();
  await page.locator(".user-actions .delete-confirm input").fill("ลาออก");
  await page.getByRole("button", { name: /^ยืนยันปิดใช้งาน/ }).click();
  await expect(page.locator(".user-head .status-archived")).toHaveText("ปิดใช้งาน");
  await page.screenshot({ path: `${evidence}/detail-1440.png`, fullPage: true });
  await login(person, "new.person@e2e.synthetic.test", second);
  await expect(person).toHaveURL(/\/login/);
  await other.close();

  // The administrator cannot disable their own account; the page says so instead of offering it.
  await page.goto("/admin/users?status=all");
  await expect(page.getByRole("region", { name: "รายชื่อผู้ใช้งาน" })).toContainText("ปิดใช้งาน");
  await page.getByRole("row", { name: /ผู้ดูแลสังเคราะห์/ }).getByRole("link", { name: "ดู / แก้ไข" }).click();
  await expect(page.getByText("นี่คือบัญชีของคุณ").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "ปิดใช้งานบัญชี" })).toHaveCount(0);

  // Phone width: no sideways scrolling on the list and the form.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/admin/users", "/admin/users/new"]) {
    await page.goto(path); await page.waitForLoadState("networkidle");
    expect(await noSideScroll(page)).toBe(true);
    await page.screenshot({ path: `${evidence}/${path.endsWith("new") ? "new" : "list"}-390.png`, fullPage: true });
  }
});

test("D223: other account types cannot open user management, and the API refuses them", async ({ page }) => {
  await login(page, credentials.dispatcher, credentials.password);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: /ผู้ใช้งาน/ })).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(page.locator(".admin-card[role=alert]")).toContainText("ไม่สามารถเปิดรายชื่อผู้ใช้ได้");
  expect((await page.request.get("/api/users")).status()).toBe(403);
  const forged = await page.request.post("/api/users", { headers: { origin: "http://127.0.0.1:3011", "Idempotency-Key": "forged-user" },
    data: { action: "create", input: { name: "ปลอมสิทธิ์", email: "forged@e2e.synthetic.test", typeCode: "ADMINISTRATOR", departmentId: "synthetic-department" } } });
  expect(forged.status()).toBe(403);
});
