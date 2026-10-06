import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("Thai shell, keyboard tabs and honest unavailable actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ค้นหาเส้นทางเดินรถ");
  await expect(page.getByRole("button", { name: "ค้นหา", exact: true })).toBeDisabled();
  await expect(page.getByText("กรุณาเข้าสู่ระบบเพื่อค้นหารอบรถที่เผยแพร่", { exact: false })).toBeVisible();
  const branchTab = page.getByRole("tab", { name: "ค้นหาจากสาขา" });
  await branchTab.focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "เลือกเวลา", exact: true })).toBeFocused();
  await expect(page.getByLabel("เวลาที่ใช้ค้นหา")).toHaveValue("departure");
  await page.getByLabel("เวลาที่ใช้ค้นหา").selectOption("loading");
  await page.getByRole("tab", { name: "เลือกช่วงเวลา" }).click();
  await expect(page.getByLabel("เวลาที่ใช้ค้นหา")).toHaveValue("loading");
  await expect(page.getByLabel("เวลาเริ่มต้น")).toBeDisabled();
  await page.getByRole("tab", { name: "เลือกช่วงเวลา" }).press("Home");
  await expect(branchTab).toBeFocused();
  await expect(page.getByRole("link", { name: "จัดการหลังบ้าน" })).toHaveCount(0);
});

for (const width of [1440, 768, 390]) {
  test(`responsive shell and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await mkdir("docs/evidence/phase-1", { recursive: true });
    for (const [mode, label] of [["branch", "ค้นหาจากสาขา"], ["time", "เลือกเวลา"], ["range", "เลือกช่วงเวลา"]]) {
      await page.getByRole("tab", { name: label, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `docs/evidence/phase-1/shell-${width}-${mode}.png`, fullPage: true });
    }
    if (width <= 1000) {
      const menu = page.getByRole("button", { name: "เปิดเมนู" });
      await menu.click();
      await expect(page.getByRole("navigation", { name: "เมนูหลัก" })).toBeVisible();
      await expect(page.getByRole("button", { name: "ปิดเมนู" })).toHaveAttribute("aria-expanded", "true");
    }
    await page.getByRole("navigation", { name: "เมนูหลัก" }).getByRole("link", { name: "คู่มือ" }).click();
    await expect(page.getByRole("heading", { name: "รู้จักรอบรถและการฝากส่ง" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "กลับหน้าค้นหา" }).click();
    await expect(page.getByRole("tab", { name: "ค้นหาจากสาขา" })).toBeVisible();
  });
}

test("health exposes no configuration and unknown pages are Thai", async ({ request, page }) => {
  const response = await request.get("/api/health/live");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const missing = await page.goto("/unavailable-route");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "หน้านี้อาจถูกย้ายหรือยังไม่เปิดใช้งาน" })).toBeVisible();
  expect((await request.get("/api/health/ready")).status()).toBe(404);
});
