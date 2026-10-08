import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";

// Synthetic fixture from tests/fixtures/search.ts: 2028-03-01 (พ.ศ. 2571) has 8 published branch trips.
const account = JSON.parse(readFileSync(".local/auth/e2e-search.json", "utf8")) as { password: string; requester: string; branch: string; supervisor: string; admin: string; warehouse: string };
const DATE = "2028-03-01", A = "synthetic-branch-a";
const evidence = process.env.E2E_EVIDENCE_DIR ?? "docs/evidence/phase-5";
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
  await page.getByLabel("เริ่มต้น", { exact: true }).fill("16:00");
  await page.getByLabel("สิ้นสุด", { exact: true }).fill("15:30");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(page.locator(".field-error")).toContainText("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่มต้น");
  await page.getByLabel("เริ่มต้น", { exact: true }).fill("15:30");
  await page.getByLabel("สิ้นสุด", { exact: true }).fill("16:00");
  await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
  await expect(badge(page)).toHaveText("พบ 2 รอบรถ");
  await expect(page.getByText("รวมเวลาเริ่มต้นและเวลาสิ้นสุด", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: /ดูรายละเอียดรอบรถ s5-2028-03-01-1530/ }).first().click();
  await expect(page.getByRole("heading", { name: "จุดส่งตามลำดับ (1 จุด)" })).toBeVisible();
  await expect(page.getByText("ข้อมูลติดต่อแสดงเฉพาะผู้มีสิทธิ์ของสาขานี้")).toBeVisible();
  // D226: without a chosen destination the page offers this trip's stops instead of a disabled button.
  await expect(page.getByRole("link", { name: /^ฝากของไป / })).toHaveCount(1);
  await page.goto(`/trips/s5-2028-03-01-trip-1?branch=${A}`);
  await expect(page.getByText("สาขาที่เลือก")).toBeVisible();
  await page.getByRole("link", { name: "ฝากของกับรอบนี้" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ฝากของส่งรถ" })).toBeVisible();
  await expect(page.getByLabel("สาขาปลายทาง")).toHaveValue(A);
  await expect(page.getByLabel("วันที่ต้องการส่ง (พ.ศ.)")).toHaveValue("01/03/2571");
  await page.screenshot({ path: `${evidence}/consign-handoff-1440.png`, fullPage: true });
  // D225: the trip list shows the plan-based departure status. D228: no consign button in the list; consigning starts from the trip detail.
  await page.goto("/trips?date=2028-03-01");
  await expect(page.locator(".results-table .departure-status").first()).toContainText("ยังไม่ถึงเวลาออก");
  await expect(page.locator(".results-table").getByText("ฝากของกับรอบนี้")).toHaveCount(0);
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
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");
  await expect(page.locator(".row-contact").first()).toBeHidden();
  await page.goto(`/trips/s5-2028-03-01-1530`);
  await expect(page.getByRole("heading", { name: "จุดส่งตามลำดับ (1 จุด)" })).toBeVisible();
  await page.goto(`/trips/s5-2028-03-01-trip-1?branch=${A}`);
  await expect(page.getByText("ผู้ติดต่อสังเคราะห์ 1")).toBeVisible();
  await expect(page.getByText("ผู้ติดต่อสังเคราะห์ 2")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "ฝากของกับรอบนี้" })).toBeVisible();
  await page.context().clearCookies();

  await login(page, account.requester);
  expect((await page.request.get(`/api/search?date=${DATE}&kinds=VAN_SALES`)).status()).toBe(200);
  const invalid = await page.request.get(`/api/search?date=${DATE}&mode=range&from=16:00&to=15:00`);
  expect(invalid.status()).toBe(400); expect((await invalid.json()).message).toBe("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่มต้น");
  await page.context().clearCookies();

  await login(page, account.warehouse);
  await page.goto(`/?date=${DATE}&mode=time`);
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");
  expect((await page.request.get(`/api/search?date=${DATE}`)).status()).toBe(200);
  expect((await page.request.get(`/api/planning?date=${DATE}`)).status()).toBe(403);
  // The administrator sees everything (D215).
  await login(page, account.admin);
  await page.goto(`/?date=${DATE}`);
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");
});

for (const width of [1440, 390]) {
  test(`time input: typed validation, scroll wheels, cancel and confirmation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page, account.requester);
    await page.goto(`/?date=${DATE}&mode=range&from=08:30&to=23:59`);
    await expect(badge(page)).toHaveText(/^พบ \d+ รอบรถ$/);
    const start = page.getByRole("textbox", { name: "เริ่มต้น", exact: true });
    const clock = page.locator(".range-fields .time-field").first().getByRole("button", { name: "เปิดตัวเลือกเวลา" });
    const popup = page.getByRole("dialog", { name: "เลือกเวลา", exact: true });
    await expect(page.locator(".range-fields select")).toHaveCount(0);
    await start.fill(""); await start.pressSequentially("830"); await start.press("Tab");
    await expect(start).toHaveValue("08:30");
    await start.fill("24:00"); await start.press("Tab");
    await expect(start).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".time-input-error")).toContainText("00:00–23:59");
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await expect(page.locator(".field-error")).toContainText("ให้ถูกต้อง");
    await start.fill("08:30"); await start.press("Tab");
    await clock.click();
    await expect(popup.getByRole("spinbutton", { name: "ชั่วโมง", exact: true })).toBeFocused();
    await expect(popup.locator("select, [role=listbox]")).toHaveCount(0);
    await popup.getByRole("button", { name: "เพิ่มชั่วโมง", exact: true }).click();
    await expect(start, "picker changes are drafts until confirmed").toHaveValue("08:30");
    await popup.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    await expect(popup).toHaveCount(0); await expect(clock).toBeFocused();
    await clock.click();
    const hours = popup.getByRole("spinbutton", { name: "ชั่วโมง", exact: true });
    const minutes = popup.getByRole("spinbutton", { name: "นาที", exact: true });
    await hours.press("End"); await expect(hours).toHaveAttribute("aria-valuenow", "23");
    await expect(popup.getByRole("button", { name: "เพิ่มชั่วโมง", exact: true })).toBeDisabled();
    await hours.press("Home"); await hours.press("PageUp"); await hours.press("ArrowUp");
    await expect(hours).toHaveAttribute("aria-valuenow", "6");
    await minutes.hover(); await page.mouse.wheel(0, 132);
    await expect(minutes).toHaveAttribute("aria-valuenow", "33");
    await minutes.press("End"); await expect(minutes).toHaveAttribute("aria-valuenow", "59");
    await expect(popup.getByRole("button", { name: "เพิ่มนาที", exact: true })).toBeDisabled();
    expect(await noHorizontalScroll(page)).toBe(true);
    const bounds = await popup.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    const shots = "docs/evidence/time-picker"; mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: `${shots}/picker-${width}.png`, fullPage: true });
    await popup.screenshot({ path: `${shots}/panel-${width}.png` });
    await popup.getByRole("button", { name: "ใช้เวลา 06:59", exact: true }).click();
    await expect(start).toHaveValue("06:59"); await expect(start).toBeFocused();
    await start.press("Alt+ArrowDown"); await expect(popup).toBeVisible();
    await hours.press("ArrowDown"); await hours.press("Escape");
    await expect(popup).toHaveCount(0); await expect(start).toHaveValue("06:59");
    await clock.click(); await popup.getByRole("button", { name: "ล้างเวลา", exact: true }).click();
    await expect(start).toHaveValue("");
    await clock.click(); await popup.getByRole("button", { name: "ยกเลิก", exact: true }).click();
    await expect(start, "opening an empty field must not invent a time").toHaveValue("");
    await start.fill("08:00"); await clock.click();
    await popup.getByRole("button", { name: "เพิ่มชั่วโมง", exact: true }).click();
    await page.getByRole("textbox", { name: "สิ้นสุด", exact: true }).click();
    await expect(popup).toHaveCount(0); await expect(start).toHaveValue("08:00");
    await expect(page.getByRole("textbox", { name: "สิ้นสุด", exact: true })).toBeFocused();
  });
}

test("time picker supports native touch scrolling without committing until confirmation", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: "th-TH", timezoneId: "Asia/Bangkok" });
  const page = await context.newPage();
  try {
    await login(page, account.requester);
    await page.goto(`/?date=${DATE}&mode=range&from=08:30&to=23:59`);
    await expect(badge(page)).toHaveText(/^พบ \d+ รอบรถ$/);
    await page.locator(".range-fields .time-field").first().getByRole("button", { name: "เปิดตัวเลือกเวลา" }).tap();
    const popup = page.getByRole("dialog", { name: "เลือกเวลา", exact: true });
    const minutes = popup.getByRole("spinbutton", { name: "นาที", exact: true });
    const box = (await minutes.boundingBox())!;
    const session = await context.newCDPSession(page);
    const x = box.x + box.width / 2, y = box.y + box.height / 2 + 35;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (const delta of [15, 30, 45, 60, 80]) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - delta }] });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => Number(await minutes.getAttribute("aria-valuenow"))).toBeGreaterThan(30);
    await expect(page.getByRole("textbox", { name: "เริ่มต้น", exact: true })).toHaveValue("08:30");
    await popup.getByRole("button", { name: "ยกเลิก", exact: true }).tap();
    await expect(page.getByRole("textbox", { name: "เริ่มต้น", exact: true })).toHaveValue("08:30");
  } finally { await context.close(); }
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

test("T19 (D218): the Thai date field shapes typed digits and its calendar works from the keyboard", async ({ page }) => {
  await login(page, account.supervisor);
  await page.goto(`/?date=${DATE}`);
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");
  const date = page.getByLabel("วันที่ให้บริการ (พ.ศ.)");
  // Digits typed without separators become วว/ดด/ปปปป; Enter applies the date.
  await date.fill("");
  await date.pressSequentially("02032571");
  await expect(date).toHaveValue("02/03/2571");
  await date.press("Enter");
  await expect(page).toHaveURL(/date=2028-03-02/);
  // The calendar opens on the selected day; arrows move, Enter picks, Escape closes and returns focus.
  await page.getByRole("button", { name: "เลือกวันที่จากปฏิทิน" }).click();
  const dialog = page.getByRole("dialog", { name: "เลือกวันที่" });
  await expect(dialog.getByRole("button", { name: "วันพฤหัสบดีที่ 2 มีนาคม พ.ศ. 2571" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("button", { name: "วันพุธที่ 1 มีนาคม พ.ศ. 2571" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(date).toHaveValue("01/03/2571");
  await expect(page).toHaveURL(/date=2028-03-01/);
  await expect(badge(page)).toHaveText("พบ 8 รอบรถ");
  await page.getByRole("button", { name: "เลือกวันที่จากปฏิทิน" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "เลือกวันที่จากปฏิทิน" })).toBeFocused();
  // An impossible date is refused with a Thai message instead of being searched.
  await date.fill("31/02/2571");
  await date.press("Enter");
  await expect(page.getByText(/กรุณาระบุวันที่เป็น วัน\/เดือน\/ปี พ\.ศ\./)).toBeVisible();
});
