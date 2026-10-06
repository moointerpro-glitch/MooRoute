import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

// Synthetic fixture from tests/fixtures/search.ts: 2028-03-01 (พ.ศ. 2571) has 8 published branch trips.
const account = JSON.parse(readFileSync(".local/auth/e2e-search.json", "utf8")) as { password: string; requester: string; branch: string; supervisor: string; admin: string; warehouse: string };
const DATE = "2028-03-01", A = "synthetic-branch-a";
const evidence = "docs/evidence/phase-5";
mkdirSync(evidence, { recursive: true });

// The real sign-in throttle allows 5 attempts/minute, so each account signs in through the UI once per worker.
const sessions = new Map<string, Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>>();
async function login(page: Page, email: string) {
  await page.context().clearCookies();
  const cached = sessions.get(email);
  if (cached) { await page.context().addCookies(cached); await page.goto("/"); return; }
  await page.goto("/login?next=%2F");
  await page.getByLabel("อีเมล").fill(email); await page.getByLabel("รหัสผ่าน").fill(account.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3011\/(\?.*)?$/);
  sessions.set(email, await page.context().cookies());
}
const badge = (page: Page) => page.locator(".count-badge");
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("T04/T05/T06/T19/T20: three search modes, aliases, chips, range validation, detail and honest consign hand-off", async ({ page }) => {
  await login(page, account.requester);
  await page.goto(`/?date=${DATE}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ค้นหาเส้นทางเดินรถ");
  await expect(page.getByTestId("metric-trips")).toContainText("8 รอบรถ");
  await expect(page.getByTestId("metric-span")).toHaveText("00:15 – 23:59");
  await expect(page.getByLabel("วันที่ให้บริการ (พ.ศ.)")).toHaveValue("01/03/2571");

  const combo = page.getByRole("combobox", { name: "ชื่อสาขา รหัสสาขา หรือชื่อเรียกอื่น" });
  await combo.fill("แจ้ห่ม");
  await expect(page.getByRole("option").first()).toContainText("ชื่อเรียกอื่น: แจ้ห่มสังเคราะห์");
  await combo.press("ArrowDown"); await combo.press("Enter");
  await expect(badge(page)).toHaveText("พบ 5 รอบรถ");
  await expect(page.locator(".results-table mark").first()).toContainText("สาขาสังเคราะห์ 1");
  await page.getByRole("checkbox", { name: "ไก่", exact: true }).check();
  await expect(badge(page)).toHaveText("พบ 4 รอบรถ", { timeout: 10000 });
  await page.getByRole("checkbox", { name: "ไก่", exact: true }).uncheck();
  await expect(badge(page)).toHaveText("พบ 5 รอบรถ");

  await page.getByRole("button", { name: "ล้างคำค้นหาสาขา" }).click();
  await combo.fill("สาขาร่วมสังเคราะห์"); await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.getByRole("heading", { name: /พบหลายสาขาที่ตรงกับ/ })).toBeVisible();
  await page.getByRole("button", { name: /สาขาสังเคราะห์ 3/ }).click();
  await expect(badge(page)).toHaveText("พบ 5 รอบรถ");
  await expect(combo).toHaveValue("สาขาสังเคราะห์ 3 📦 (SYNTHETIC-3)");

  await page.getByRole("tab", { name: "เลือกเวลา", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "08:00", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "08:00", exact: true }).check();
  await page.getByRole("checkbox", { name: "09:00", exact: true }).check();
  await expect(badge(page)).toHaveText("พบ 3 รอบรถ");
  await expect(page).toHaveURL(/times=480%2C540|times=480,540/);
  await page.getByLabel("ประเภทเวลาที่ใช้ค้นหา").selectOption("loading");
  await expect(page.getByRole("checkbox", { name: "23:45 (วันก่อนหน้า)", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "07:00", exact: true }).check();
  await expect(badge(page)).toHaveText("พบ 1 รอบรถ");
  await page.getByLabel("ประเภทเวลาที่ใช้ค้นหา").selectOption("departure");

  await page.getByRole("tab", { name: "เลือกช่วงเวลา", exact: true }).click();
  await page.getByLabel("เริ่มต้น", { exact: true }).selectOption("16:00");
  await page.getByLabel("สิ้นสุด", { exact: true }).selectOption("15:30");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.locator(".field-error")).toContainText("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่มต้น");
  await page.getByLabel("เริ่มต้น", { exact: true }).selectOption("15:30");
  await page.getByLabel("สิ้นสุด", { exact: true }).selectOption("16:00");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(badge(page)).toHaveText("พบ 2 รอบรถ");
  await expect(page.getByText("รวมเวลาเริ่มต้นและเวลาสิ้นสุด", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: /ดูรายละเอียดรอบรถ s5-2028-03-01-1530/ }).first().click();
  await expect(page.getByRole("heading", { name: "จุดส่งตามลำดับ (1 จุด)" })).toBeVisible();
  await expect(page.getByText("ข้อมูลติดต่อแสดงเฉพาะผู้มีสิทธิ์ของสาขานี้")).toBeVisible();
  await expect(page.getByRole("button", { name: "ฝากของกับรอบนี้" })).toBeDisabled();
  await page.goto(`/trips/s5-2028-03-01-trip-1?branch=${A}`);
  await expect(page.getByText("สาขาที่เลือก")).toBeVisible();
  await page.getByRole("link", { name: "ฝากของกับรอบนี้" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ฝากของส่งรถ" })).toBeVisible();
  await expect(page.getByLabel("สาขาปลายทาง")).toHaveValue(A);
  await expect(page.getByLabel("วันที่ต้องการส่ง (พ.ศ.)")).toHaveValue("01/03/2571");
  await page.screenshot({ path: `${evidence}/consign-handoff-1440.png`, fullPage: true });
});

test("Thai empty, unknown, error and directory states", async ({ page }) => {
  await login(page, account.requester);
  await page.goto("/?date=2032-01-01&mode=time");
  await expect(page.getByRole("heading", { name: "ยังไม่มีแผนเดินรถที่เผยแพร่" })).toBeVisible();
  await page.goto("/?date=2028-03-03&mode=time");
  await expect(page.locator(".results-table .time-unknown").first()).toHaveText("ยังไม่ระบุ");
  await page.goto(`/?date=${DATE}&mode=branch&q=${encodeURIComponent("ไม่มีสาขานี้แน่นอน")}`);
  await expect(page.getByRole("heading", { name: "ไม่พบสาขาที่ตรงกับคำค้น" })).toBeVisible();
  await page.goto(`/?date=${DATE}&mode=time&times=1`);
  await expect(page.getByRole("heading", { name: "ไม่พบรอบรถที่ตรงกับเงื่อนไข" })).toBeVisible();

  await page.route("**/api/search?**", (route) => route.abort());
  await page.goto(`/?date=${DATE}&mode=time`);
  await expect(page.getByRole("heading", { name: "ค้นหาไม่สำเร็จ" })).toBeVisible();
  await page.unroute("**/api/search?**");
  await page.getByRole("button", { name: "ลองอีกครั้ง" }).click();
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");

  await page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "สาขาทั้งหมด" }).click();
  await page.getByLabel("ค้นหาสาขา").fill("สาขาร่วมสังเคราะห์"); await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(badge(page)).toHaveText("พบ 2 สาขา");
  await expect(page.getByText("ข้อมูลติดต่อแสดงเฉพาะผู้มีสิทธิ์ของสาขานี้")).toHaveCount(2);
  await page.getByRole("link", { name: /ดูรอบรถที่ส่ง สาขาสังเคราะห์ 2/ }).click();
  await expect(page.getByRole("combobox", { name: "ชื่อสาขา รหัสสาขา หรือชื่อเรียกอื่น" })).toHaveValue("สาขาสังเคราะห์ 2 📦 (SYNTHETIC-2)");
});

test("T13: branch scope, contact visibility and denied roles on pages and APIs", async ({ page, request }) => {
  expect((await request.get(`/api/search?date=${DATE}`)).status()).toBe(401);
  expect((await request.get("/api/search/branches?q=สาขา")).status()).toBe(401);
  await page.goto("/branches"); await expect(page).toHaveURL(/\/login/);

  await login(page, account.branch);
  await page.goto(`/?date=${DATE}&mode=time`);
  await expect(badge(page)).toHaveText("พบ 5 รอบรถ");
  await expect(page.locator(".row-contact").first()).toBeHidden();
  await page.goto(`/trips/s5-2028-03-01-1530`);
  await expect(page.getByRole("heading", { name: "ไม่พบรอบรถหรือคุณไม่มีสิทธิ์เข้าถึง" })).toBeVisible();
  await page.goto(`/trips/s5-2028-03-01-trip-1?branch=${A}`);
  await expect(page.getByText("ผู้ติดต่อสังเคราะห์ 1")).toBeVisible();
  await expect(page.getByText("ผู้ติดต่อสังเคราะห์ 2")).toHaveCount(0);
  await expect(page.getByText("บัญชีนี้ไม่มีสิทธิ์สร้างคำขอฝากส่ง")).toBeVisible();
  await page.context().clearCookies();

  await login(page, account.requester);
  expect((await page.request.get(`/api/search?date=${DATE}&kinds=VAN_SALES`)).status()).toBe(403);
  const invalid = await page.request.get(`/api/search?date=${DATE}&mode=range&from=16:00&to=15:00`);
  expect(invalid.status()).toBe(400); expect((await invalid.json()).message).toBe("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่มต้น");
  await page.context().clearCookies();

  await login(page, account.warehouse);
  await expect(page.getByRole("heading", { name: "บัญชีนี้ยังไม่มีสิทธิ์ค้นหารอบรถ" })).toBeVisible();
  expect((await page.request.get(`/api/search?date=${DATE}`)).status()).toBe(403);
  // The administrator sees everything (D215).
  await login(page, account.admin);
  await page.goto(`/?date=${DATE}`);
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");
});

for (const width of [1440, 768, 390]) {
  test(`T19: responsive search modes, detail and directory at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page, account.supervisor);
    const shots: Array<[string, string]> = [
      ["branch", `/?date=${DATE}&mode=branch&branch=${A}`],
      ["time", `/?date=${DATE}&mode=time&times=480,540`],
      ["range", `/?date=${DATE}&mode=range&from=13:00&to=16:00`],
    ];
    for (const [mode, url] of shots) {
      await page.goto(url);
      await expect(badge(page)).toHaveText(/^พบ \d+ รอบรถ$/);
      await page.evaluate(() => document.fonts.ready);
      if (width <= 900) { await expect(page.locator(".result-cards")).toBeVisible(); await expect(page.locator(".results-table")).toBeHidden(); }
      else await expect(page.locator(".results-table")).toBeVisible();
      expect(await noHorizontalScroll(page)).toBe(true);
      await page.screenshot({ path: `${evidence}/search-${width}-${mode}.png`, fullPage: true });
    }
    await page.goto(`/trips/s5-2028-03-01-dup?branch=${A}`);
    await expect(page.getByText("สาขาที่เลือก").first()).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.screenshot({ path: `${evidence}/trip-detail-${width}.png`, fullPage: true });
    await page.goto("/branches");
    await expect(badge(page)).toHaveText(/^พบ \d+ สาขา$/);
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.screenshot({ path: `${evidence}/branches-${width}.png`, fullPage: true });
  });
}

test("T19: search works with the keyboard only (tabs, chips, combobox, sort, detail link)", async ({ page }) => {
  await login(page, account.supervisor);
  await page.goto(`/?date=${DATE}`);
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");
  // Skip link is the first focus stop and moves focus to the main content.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "ข้ามไปยังเนื้อหา" })).toBeFocused();
  await page.keyboard.press("Enter");
  // Tab list: arrow keys move and activate; Home returns to the first tab.
  await page.getByRole("tab", { name: "ค้นหาจากสาขา" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "เลือกเวลา", exact: true })).toHaveAttribute("aria-selected", "true");
  // Time chips are real checkboxes: Space toggles them.
  const chip = page.getByRole("checkbox", { name: "08:00", exact: true });
  await chip.focus();
  await page.keyboard.press("Space");
  await expect(badge(page)).toHaveText("พบ 1 รอบรถ");
  // Regression: a search superseded mid-response once cleared the result and dropped focus from the chip.
  await expect(chip).toBeFocused();
  await page.keyboard.press("Space");
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");
  await page.getByRole("tab", { name: "เลือกเวลา", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "ค้นหาจากสาขา" })).toHaveAttribute("aria-selected", "true");
  // Combobox: type, arrow to an option, Enter selects; Escape closes the list.
  const combo = page.getByRole("combobox", { name: "ชื่อสาขา รหัสสาขา หรือชื่อเรียกอื่น" });
  await combo.focus();
  await page.keyboard.type("SYNTHETIC-3");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(combo).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await expect(badge(page)).toHaveText("พบ 5 รอบรถ");
  // Sort select and the detail link are reachable and operable from the keyboard.
  await page.getByLabel("เรียงลำดับ").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/sort=time_desc/);
  await page.locator(".results-table .detail-link").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /จุดส่งตามลำดับ/ })).toBeVisible();
  const focusRing = await page.getByRole("link", { name: "กลับหน้าค้นหา" }).evaluate((el) => { (el as HTMLElement).focus(); return getComputedStyle(el).outlineStyle; });
  expect(focusRing).not.toBe("none");
});
