import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import jsQRModule from "jsqr";
import { importKinds } from "../../src/server/domain/imports";
import { toCsv } from "../../src/server/domain/tabular";

// Synthetic fixture from scripts/prepare-labels-e2e.ts: `complete` goes to a branch with a long valid address, `incomplete` to one with postal code 00000.
const f = JSON.parse(readFileSync(".local/auth/e2e-labels.json", "utf8")) as Record<"password" | "requester" | "branch" | "dispatcher" | "warehouse" | "admin" | "otherBranch" | "complete" | "incomplete" | "trip" | "tripTwo", string>;
const jsQR = (jsQRModule as unknown as { default?: typeof jsQRModule }).default ?? jsQRModule;
const evidence = "docs/evidence/phase-7", ORIGIN = "http://127.0.0.1:3011", MM = 96 / 25.4;
mkdirSync(evidence, { recursive: true });

const sessions = new Map<string, Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>>();
async function login(page: Page, email: string) {
  await page.context().clearCookies();
  const cached = sessions.get(email);
  if (cached) { await page.context().addCookies(cached); return; }
  await page.goto("/login?next=%2Fguide");
  await page.getByLabel("อีเมล").fill(email); await page.getByLabel("รหัสผ่าน").fill(f.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/guide$/);
  sessions.set(email, await page.context().cookies());
}
async function shot(page: Page, name: string) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true }); }
/** Page count and page size (points) of a PDF produced with the page's own @page rule. */
async function pdfPages(page: Page, name: string) {
  const pdf = (await page.pdf({ path: `${evidence}/${name}.pdf`, preferCSSPageSize: true, printBackground: true })).toString("latin1");
  const boxes = [...pdf.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
  return { count: (pdf.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length, box: boxes[0] ?? [0, 0] };
}
const fits = (page: Page) => page.locator(".label").evaluateAll((labels) => labels.every((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1 &&
  [...el.querySelectorAll(".label-address, .label-branch, .label-contact")].every((t) => { const a = t.getBoundingClientRect(), b = el.getBoundingClientRect(); return a.bottom <= b.bottom && a.right <= b.right + 1; })));
async function decodeQr(page: Page, index: number) {
  const data = await page.locator(".label-qr svg").nth(index).evaluate(async (svg) => {
    const image = new Image(), size = 400;
    const markup = new XMLSerializer().serializeToString(svg);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup.includes("xmlns=") ? markup : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'))}`;
    await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
    const context = canvas.getContext("2d")!; context.fillStyle = "#fff"; context.fillRect(0, 0, size, size); context.drawImage(image, 0, 0, size, size);
    return { size, pixels: Array.from(context.getImageData(0, 0, size, size).data) };
  });
  return jsQR(new Uint8ClampedArray(data.pixels), data.size, data.size)?.data ?? null;
}
let lookupUrl = "", firstLabelUrl = "";

test("T16/T17: issue, actual-size A4 and 100×150 mm print with long Thai address, reprint without new records", async ({ page }) => {
  await page.addInitScript(() => { window.print = () => { (window as unknown as { printed: number }).printed = ((window as unknown as { printed?: number }).printed ?? 0) + 1; }; });
  await login(page, f.warehouse);
  await page.goto(`/consignments/${f.complete}/labels`);
  await expect(page.getByText("ยังไม่มีฉลากที่ใช้งานได้")).toBeVisible();
  await page.getByRole("button", { name: "ออกฉลาก", exact: true }).click();
  await expect(page.locator(".form-success")).toContainText("ออกฉลากแล้ว");
  await expect(page.getByText("ฉบับที่ 1").first()).toBeVisible();
  await shot(page, "labels-page-1440");
  await page.getByRole("link", { name: /พิมพ์ A4 4 ดวงต่อแผ่น/ }).click();
  await page.waitForURL("**/print/labels/*?format=A4_4UP");
  firstLabelUrl = page.url().split("?")[0];

  // A4: one sheet, three labels 1/3–3/3, each quadrant 105 × 148.5 mm.
  await expect(page.locator(".sheet-a4")).toHaveCount(1);
  await expect(page.locator(".label-count")).toHaveText(["1/3", "2/3", "3/3"]);
  const sheet = await page.locator(".sheet-a4").first().evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
  expect(Math.abs(sheet[0] - 210 * MM)).toBeLessThan(1.5); expect(Math.abs(sheet[1] - 297 * MM)).toBeLessThan(1.5);
  const label = await page.locator(".label").first().evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
  expect(Math.abs(label[0] - 105 * MM)).toBeLessThan(1.5); expect(Math.abs(label[1] - 148.5 * MM)).toBeLessThan(1.5);
  // D234: the packaging and the sender are printed, and the label still fits with an address at the 300-character limit.
  await expect(page.locator(".label-kind").first()).toHaveText("หีบห่อ");
  await expect(page.locator(".label-from").first()).toContainText("ผู้ฝาก: ผู้ฝากสังเคราะห์ · โทร 000-000-1000");
  const limit = await page.locator(".label").first().evaluate((el) => {
    const address = el.querySelector(".label-address")!, original = address.textContent!, mm = (v: number) => Math.round(v / (96 / 25.4) * 10) / 10;
    address.textContent = original.repeat(2).slice(0, 306); // 300 characters plus the postal code
    const result = { fits: el.scrollHeight <= el.clientHeight + 1, spare: mm(el.querySelector(".label-from")!.getBoundingClientRect().top - el.querySelector(".label-to")!.getBoundingClientRect().bottom), was: original.length };
    address.textContent = original; return result;
  });
  expect(limit.fits, "a 300-character address leaves room for the packaging and sender lines").toBe(true);
  expect(await fits(page)).toBe(true);
  await expect(page.locator(".label-address").first()).toContainText("ซอยทดสอบการตัดบรรทัดภาษาไทย");
  const addressFont = await page.locator(".label-address").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(addressFont, "recipient text is not shrunk below 11pt").toBeGreaterThanOrEqual(14);
  lookupUrl = (await decodeQr(page, 0)) ?? "";
  expect(lookupUrl).toMatch(/^http:\/\/127\.0\.0\.1:3011\/l\/[A-Za-z0-9_-]{32}\?p=1$/);
  expect(await decodeQr(page, 2)).toBe(lookupUrl.replace("p=1", "p=3"));
  await shot(page, "print-a4-screen");
  const a4 = await pdfPages(page, "labels-a4");
  expect(a4.count).toBe(1); expect(Math.abs(a4.box[0] - 595.3)).toBeLessThan(1.5); expect(Math.abs(a4.box[1] - 841.9)).toBeLessThan(1.5);

  // First print is recorded, then the browser dialog opens.
  await page.getByRole("button", { name: "บันทึกและพิมพ์", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed?: number }).printed ?? 0)).toBe(1);

  // 100 × 150 mm: one label per page, three pages.
  await page.getByRole("link", { name: "สติกเกอร์ 100 × 150 มม." }).click();
  await expect(page.locator(".sheet-sticker")).toHaveCount(3);
  const sticker = await page.locator(".sheet-sticker").first().evaluate((el) => { const r = el.getBoundingClientRect(); return [r.width, r.height]; });
  expect(Math.abs(sticker[0] - 100 * MM)).toBeLessThan(1.5); expect(Math.abs(sticker[1] - 150 * MM)).toBeLessThan(1.5);
  expect(await fits(page)).toBe(true);
  await shot(page, "print-sticker-screen");
  const pdf = await pdfPages(page, "labels-sticker");
  expect(pdf.count).toBe(3); expect(Math.abs(pdf.box[0] - 283.5)).toBeLessThan(1.5); expect(Math.abs(pdf.box[1] - 425.2)).toBeLessThan(1.5);

  // Reprint needs a reason and creates no label version, consignment or package.
  await expect(page.getByText("ฉลากฉบับนี้พิมพ์แล้ว 1 ครั้ง")).toBeVisible();
  await page.getByRole("button", { name: "บันทึกและพิมพ์ซ้ำ" }).click();
  await expect(page.locator(".form-error")).toContainText("กรุณาระบุเหตุผล");
  await page.getByLabel("เหตุผลการพิมพ์ซ้ำ").fill("ฉลากเดิมเปื้อน");
  await page.getByRole("button", { name: "บันทึกและพิมพ์ซ้ำ" }).click();
  // Format switching is a client-side navigation, so the stubbed counter continues from the first print.
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed?: number }).printed ?? 0)).toBe(2);
  await page.goto(`/consignments/${f.complete}/labels`);
  await expect(page.locator(".print-log li")).toHaveCount(2);
  await expect(page.locator(".print-log")).toContainText("พิมพ์ซ้ำครั้งที่ 1"); await expect(page.locator(".print-log")).toContainText("ฉลากเดิมเปื้อน");
  await expect(page.locator(".assignment-history > li")).toHaveCount(1);
  await page.goto(`/consignments/${f.complete}`);
  await expect(page.locator(".package-list li")).toHaveCount(3);
});

test("T16/T18: incomplete address blocks a real label; sample is watermarked without QR; manifest groups by destination", async ({ page }) => {
  await login(page, f.warehouse);
  await page.goto(`/consignments/${f.incomplete}/labels`);
  await expect(page.locator(".problem-list")).toContainText("รหัสไปรษณีย์ไม่ถูกต้อง");
  await expect(page.getByRole("button", { name: "ออกฉลาก", exact: true })).toBeDisabled();
  const blocked = await page.request.post("/api/labels", { headers: { "Content-Type": "application/json", "Idempotency-Key": "e2e-incomplete", Origin: ORIGIN }, data: { action: "issue", input: { consignmentId: f.incomplete, expectedVersion: 3 } } });
  expect(blocked.status()).toBe(400); expect((await blocked.json()).code).toBe("LABEL_INCOMPLETE");
  await page.getByRole("link", { name: "A4 4 ดวงต่อแผ่น", exact: true }).click();
  await expect(page.locator(".label-watermark")).toHaveText(["ตัวอย่าง", "ตัวอย่าง"]);
  await expect(page.locator(".label-qr svg")).toHaveCount(0);
  await expect(page.locator(".label-foot").first()).toContainText("ตัวอย่าง ห้ามใช้ส่งจริง");
  await shot(page, "print-sample");

  await login(page, f.dispatcher);
  await page.goto(`/print/manifest/${f.trip}`);
  await expect(page.getByRole("heading", { name: "ใบคุมรถฝากของส่งสาขา" })).toBeVisible();
  await expect(page.locator(".manifest-group")).toHaveCount(2);
  await expect(page.locator(".manifest-group").first()).toContainText("ฉบับที่ 1"); await expect(page.locator(".manifest-group").nth(1)).toContainText("ยังไม่ออก");
  await expect(page.locator(".manifest-foot")).toContainText("2 ใบฝาก · 5 บรรจุภัณฑ์");
  await expect(page.locator(".signatures div")).toHaveText(["ผู้ส่งมอบ (คลัง)", "พนักงานขับรถ", "ผู้ตรวจสอบ"]);
  await shot(page, "manifest-screen");
  const manifest = await pdfPages(page, "manifest");
  expect(manifest.count).toBe(1); expect(Math.abs(manifest.box[0] - 595.3)).toBeLessThan(1.5);
  await login(page, f.branch);
  await page.goto(`/print/manifest/${f.trip}`);
  await expect(page.getByRole("heading", { name: "คุณไม่มีสิทธิ์ดูใบคุมรถ" })).toBeVisible();
});

test("T17/T13: revoked QR is rejected with the replacement; lookup needs sign-in and scope", async ({ page, request }) => {
  const path = lookupUrl.replace(ORIGIN, "");
  expect(path).toMatch(/^\/l\//);
  await page.context().clearCookies();
  await page.goto(path);
  await expect(page).toHaveURL(/\/login\?next=%2Fl%2F/);
  expect((await request.get(`/api/labels/lookup?code=${encodeURIComponent(lookupUrl)}`)).status()).toBe(401);
  await login(page, f.branch);
  await page.goto(path);
  await expect(page.locator(".form-success")).toContainText("ฉลากฉบับที่ 1 เป็นฉบับปัจจุบัน");
  // The scan result names the piece and where it is; it never shows an internal code as if it were the sender.
  await expect(page.getByText("หีบห่อ 1/3 · อยู่กับผู้ฝาก")).toBeVisible();
  // A receiver of another branch is out of scope; the administrator sees everything (D215).
  await login(page, f.otherBranch);
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "คุณไม่มีสิทธิ์ดูรายการของฉลากนี้" })).toBeVisible();
  await login(page, f.admin);
  await page.goto(path);
  await expect(page.locator(".form-success")).toContainText("ฉลากฉบับที่ 1 เป็นฉบับปัจจุบัน");

  // Reassignment by the dispatcher revokes version 1.
  await login(page, f.dispatcher);
  const detail = await (await page.request.get(`/api/consignments/${f.complete}`)).json();
  const moved = await page.request.post("/api/consignments", { headers: { "Content-Type": "application/json", "Idempotency-Key": "e2e-reassign", Origin: ORIGIN }, data: { action: "reassign", input: { id: f.complete, expectedVersion: detail.version, tripId: f.tripTwo, reason: "ย้ายไปรอบ ๒ (ทดสอบ)" } } });
  expect(moved.status()).toBe(200);
  await login(page, f.branch);
  await page.goto(path);
  await expect(page.locator(".form-error")).toContainText("ฉลากฉบับที่ 1 ถูกยกเลิกแล้ว ห้ามใช้รับหรือส่งของ");
  await expect(page.locator(".form-error")).toContainText("ยังไม่มีฉลากฉบับใหม่");
  await login(page, f.warehouse);
  await page.goto(`${firstLabelUrl}?format=A4_4UP`);
  await expect(page.getByRole("heading", { name: /ฉลากฉบับที่ 1 ถูกยกเลิกแล้ว/ })).toBeVisible();
  await expect(page.locator(".label")).toHaveCount(0);
  const reprint = await page.request.post("/api/labels", { headers: { "Content-Type": "application/json", "Idempotency-Key": "e2e-revoked-print", Origin: ORIGIN }, data: { action: "print", input: { labelVersionId: firstLabelUrl.split("/").pop(), format: "A4_4UP", copies: 1, reason: "พิมพ์ฉบับเก่า" } } });
  expect(reprint.status()).toBe(400); expect((await reprint.json()).code).toBe("LABEL_REVOKED");
  await page.goto(`/consignments/${f.complete}/labels`);
  await page.getByRole("button", { name: "ออกฉลาก", exact: true }).click();
  await expect(page.locator(".form-success")).toContainText("ออกฉลากแล้ว");
  await expect(page.locator(".assignment-history > li")).toHaveCount(2);
  await shot(page, "labels-history-1440");
  const lookup = await (await page.request.get(`/api/labels/lookup?code=${encodeURIComponent(lookupUrl)}`)).json();
  expect(lookup.state).toBe("REVOKED"); expect(lookup.replacement.number).toBe(2);
  await login(page, f.branch);
  await page.goto(path);
  await expect(page.locator(".form-error")).toContainText("ฉบับปัจจุบันคือฉบับที่ 2");
  await shot(page, "lookup-revoked");
});

test("T22: staged import with Thai row errors stays uncommitted until handled; same file never duplicates", async ({ page }) => {
  await login(page, f.admin);
  await page.goto("/admin/imports");
  const template = await page.request.get("/api/imports/template?kind=branches&format=csv");
  expect(template.headers()["content-type"]).toContain("text/csv"); expect(await template.text()).toContain("รหัสสาขา");
  // The administrator may import every kind (D215); a branch receiver may import none.
  expect((await page.request.get("/api/imports/template?kind=schedule&format=csv")).status()).toBe(200);
  await login(page, f.branch);
  expect((await page.request.get("/api/imports/template?kind=schedule&format=csv")).status()).toBe(403);
  await login(page, f.admin);
  await page.goto("/admin/imports/new");
  mkdirSync("docs/evidence/backoffice-ux/imports",{recursive:true});
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    await expect(page.getByRole("heading",{name:"อัปโหลดไฟล์ใหม่",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`docs/evidence/backoffice-ux/imports/upload-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  const fields = importKinds.branches.fields, row = (over: Record<string, string>) => fields.map((x) => ({ code: "E2E-B01", name: "สาขานำเข้าหน้าจอ (สังเคราะห์)", destinationType: "สาขา", addressLine: "๑ ถนนสังเคราะห์", subdistrict: "ตำบลสังเคราะห์", district: "อำเภอสังเคราะห์", province: "จังหวัดสังเคราะห์", postalCode: "50000", contactName: "ผู้รับนำเข้า (สังเคราะห์)", contactPhone: "000-000-7002", activeFrom: "01/01/2578", ...over } as Record<string, string>)[x.name] ?? "");
  const csv = Buffer.from(toCsv([fields.map((x) => x.label), row({}), row({ code: "E2E-B02", postalCode: "ABCDE", activeFrom: "31/02/2578" })]), "utf8");
  await page.locator('input[name="file"]').setInputFiles({ name: "reference.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 synthetic") });
  await page.getByLabel("ชุดหรือวันที่ของเอกสารอ้างอิง").fill("ชุดทดสอบหน้าจอ 01/10/2569");
  await page.getByRole("button", { name: "อัปโหลดเพื่อตรวจสอบ" }).click();
  await expect(page.locator(".form-error")).toContainText("เป็นเอกสารอ้างอิงเท่านั้น");
  await page.locator('input[name="file"]').setInputFiles({ name: "สาขา.csv", mimeType: "text/csv", buffer: csv });
  await page.getByRole("button", { name: "อัปโหลดเพื่อตรวจสอบ" }).click();
  await expect(page).toHaveURL(/\/admin\/imports\/(?!new$)[^/?]+$/);
  const batchUrl = page.url();
  await expect(page.locator(".import-summary")).toContainText("1 เพิ่มใหม่"); await expect(page.locator(".import-summary li.bad")).toContainText("1 ต้องแก้ไข");
  await expect(page.locator(".row-errors")).toContainText("ต้องเป็นวันที่แบบ");
  await expect(page.getByRole("button", { name: "นำเข้าจริง" })).toBeDisabled();
  await shot(page, "import-review-1440");
  await page.getByRole("button",{name:"แก้ไขการจับคู่คอลัมน์"}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({path:"docs/evidence/backoffice-ux/imports/mapping-dialog-1440.png",fullPage:true});
  await page.getByRole("button",{name:"ยกเลิกการจับคู่"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const forced = await page.request.post(batchUrl.replace("/admin/imports/", "/api/imports/"), { headers: { "Content-Type": "application/json", "Idempotency-Key": "e2e-force-commit", Origin: ORIGIN }, data: { action: "commit", input: { expectedVersion: 2 } } });
  expect(forced.status()).toBe(400); expect((await forced.json()).code).toBe("IMPORT_HAS_ERRORS");
  await page.getByRole("button", { name: /ข้ามแถวที่ต้องแก้ไขทั้งหมด/ }).click();
  await expect(page.locator(".form-success")).toContainText("ข้ามแถวที่ผิดพลาดแล้ว");
  await page.getByRole("button", { name: "นำเข้าจริง" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({path:"docs/evidence/backoffice-ux/imports/commit-dialog-1440.png",fullPage:true});
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "นำเข้าจริง" })).toBeEnabled();
  await page.getByRole("button", { name: "นำเข้าจริง" }).click();
  await page.getByRole("button", { name: "ยืนยันดำเนินการ" }).click();
  await expect(page.locator(".form-success")).toContainText("นำเข้าข้อมูลแล้ว");
  await expect(page.locator(".status-badge")).toHaveText("นำเข้าแล้ว");
  await expect(page.getByRole("button", { name: "นำเข้าจริง" })).toHaveCount(0);

  await page.goto("/admin/imports");
  await page.getByRole("link", {name:"อัปโหลดไฟล์ใหม่",exact:true}).click();
  await page.locator('input[name="file"]').setInputFiles({ name: "สาขา.csv", mimeType: "text/csv", buffer: csv });
  await page.getByLabel("ชุดหรือวันที่ของเอกสารอ้างอิง").fill("ชุดทดสอบหน้าจอ 01/10/2569");
  await page.getByRole("button", { name: "อัปโหลดเพื่อตรวจสอบ" }).click();
  await expect(page).toHaveURL(`${batchUrl}?existing=1`);
  await expect(page.getByText("ระบบเปิดชุดเดิมให้ ไม่มีการสร้างข้อมูลซ้ำ")).toBeVisible();
  await page.goto("/admin/branches?q=E2E-B0");
  await expect(page.locator("main")).toContainText("E2E-B01"); await expect(page.locator("main")).not.toContainText("E2E-B02");
  await login(page, f.warehouse);
  await page.goto("/admin/imports");
  await expect(page.getByRole("heading", { name: "ไม่มีสิทธิ์นำเข้าข้อมูล" })).toBeVisible();
});

for (const width of [768, 390]) {
  test(`T19: label, lookup and import screens at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page, f.warehouse);
    await page.goto(`/consignments/${f.complete}/labels`);
    await expect(page.getByRole("heading", { name: "ประวัติฉลากและการพิมพ์" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, `labels-page-${width}`);
    await page.goto(`/print/sample/${f.incomplete}?format=STICKER_100X150`);
    await expect(page.locator(".sheet-sticker").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await login(page, f.admin);
    await page.goto("/admin/imports");
    await expect(page.getByRole("heading", { name: "ประวัติชุดนำเข้า" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, `imports-${width}`);
  });
}
