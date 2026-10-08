import {test,expect,type Page} from "@playwright/test";
import {readFileSync,mkdirSync} from "node:fs";
const credentials=JSON.parse(readFileSync(".local/auth/e2e.json","utf8"));
async function login(page:Page,role:"admin"|"branch"="admin"){
  await page.goto("/login");await page.getByLabel("อีเมลบัญชีผู้ใช้งาน").fill(credentials[role]);await page.getByLabel("รหัสผ่าน",{exact:true}).fill(credentials.password);
  // The search page adds ?date=…&mode=… to its URL after loading, so the home URL may carry a query string.
  await page.getByRole("button",{name:"เข้าสู่ระบบ",exact:true}).click();await expect(page).toHaveURL(role==="admin"?/\/admin$/:/127\.0\.0\.1:3011\/(\?.*)?$/);
}
test("real login, Thai backend, create/edit/delete masters and server validation",async({page})=>{
  await login(page);await expect(page.getByRole("heading",{name:"งานหลังบ้านของคุณ"})).toBeVisible();
  // Native browser constraints must agree with the server's integer wheel range.
  await page.goto("/admin/vehicle-types/new");
  const wheels=page.getByRole("spinbutton",{name:"จำนวนล้อ *",exact:true});
  for(const value of ["2","4","6","30"]){await wheels.fill(value);expect(await wheels.evaluate((input:HTMLInputElement)=>input.checkValidity()),`accept ${value} wheels`).toBe(true);}
  for(const value of ["1","4.001","31"]){await wheels.fill(value);expect(await wheels.evaluate((input:HTMLInputElement)=>input.checkValidity()),`reject ${value} wheels`).toBe(false);}
  await wheels.fill("4");await wheels.press("ArrowUp");await expect(wheels).toHaveValue("5");await wheels.press("ArrowDown");await expect(wheels).toHaveValue("4");
  await page.locator('[name="code"]').fill("BROWSER-WHEELS");await page.locator('[name="name"]').fill("รถสังเคราะห์ทดสอบจำนวนล้อ");await page.getByLabel("เหตุผลการเปลี่ยนแปลง").fill("ทดสอบบันทึกจำนวนล้อเต็มผ่านหน้าจอ");
  await page.getByRole("button",{name:"บันทึกข้อมูล"}).click();await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลสำเร็จ");
  await page.goto("/admin/vehicle-types?q=BROWSER-WHEELS");await page.getByRole("link",{name:"ดู / แก้ไข"}).click();await expect(wheels).toHaveValue("4");await page.reload();await expect(wheels).toHaveValue("4");
  await wheels.fill("6");await page.getByLabel("เหตุผลการเปลี่ยนแปลง").fill("ทดสอบแก้จำนวนล้อเต็ม");await page.getByRole("button",{name:"บันทึกข้อมูล"}).click();await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลสำเร็จ");await page.reload();await expect(wheels).toHaveValue("6");
  await page.goto("/admin/vehicles/new");
  await page.locator('[name="plateNormalized"]').fill("ทด-ล้อ4");await page.locator('[name="province"]').fill("จังหวัดสังเคราะห์");
  await page.locator('[name="typeId"]').selectOption({label:"BROWSER-WHEELS · รถสังเคราะห์ทดสอบจำนวนล้อ"});await page.locator('[name="storageConditionId"]').selectOption({index:1});
  await wheels.fill("4");expect(await wheels.evaluate((input:HTMLInputElement)=>input.checkValidity())).toBe(true);
  await page.locator('[name="capacity"]').fill("1500.125");await page.locator('[name="capacityUnit"]').selectOption("KG");
  expect(await page.locator('[name="capacity"]').evaluate((input:HTMLInputElement)=>input.checkValidity())).toBe(true);
  await page.getByLabel("เหตุผลการเปลี่ยนแปลง").fill("ทดสอบรถสี่ล้อและความจุทศนิยม");await page.getByRole("button",{name:"บันทึกข้อมูล"}).click();await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลสำเร็จ");
  await page.goto("/admin/vehicles?q="+encodeURIComponent("ทดล้อ4"));await page.getByRole("link",{name:"ดู / แก้ไข"}).click();await expect(wheels).toHaveValue("4");await page.reload();await expect(wheels).toHaveValue("4");await expect(page.locator('[name="capacity"]')).toHaveValue("1500.125");
  for(const value of [4.001,31]){const rejected=await page.request.post("/api/masters/vehicle-types",{headers:{origin:"http://127.0.0.1:3011","idempotency-key":`e2e-invalid-wheels-${value}`},data:{action:"save",expectedVersion:0,reason:"ทดสอบข้ามการตรวจหน้าเว็บ",values:{code:"BAD-WHEELS",name:"ข้อมูลสังเคราะห์",wheelCount:value,active:true}}});expect(rejected.status()).toBe(400);expect((await rejected.json()).message).toContain("จำนวนเต็ม");}
  await page.goto("/admin/drivers/new");await page.getByLabel("รหัส",{exact:false}).fill("BROWSER3");await page.getByLabel("ชื่อ",{exact:false}).fill("พนักงานสังเคราะห์ผ่านหน้าจอ");await page.getByLabel("เบอร์ติดต่อ").fill("0800000000");await page.getByLabel("เหตุผลการเปลี่ยนแปลง").fill("ทดสอบบันทึกจริงผ่านหน้าจอ");await page.getByRole("button",{name:"บันทึกข้อมูล"}).click();await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลสำเร็จ");
  await page.goto("/admin/drivers?q=BROWSER3");await page.getByRole("link",{name:"ดู / แก้ไข"}).click();await page.getByLabel("ชื่อ",{exact:false}).fill("พนักงานสังเคราะห์แก้ไขแล้ว");await page.getByLabel("เหตุผลการเปลี่ยนแปลง").fill("ทดสอบแก้ไขพร้อมบันทึกประวัติ");await page.getByRole("button",{name:"บันทึกข้อมูล"}).click();await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลสำเร็จ");
  await page.reload();await expect(page.getByLabel("ชื่อ",{exact:false})).toHaveValue("พนักงานสังเคราะห์แก้ไขแล้ว");
  await page.getByLabel("เหตุผลการเปลี่ยนแปลง").fill("ลบข้อมูลสังเคราะห์ที่ไม่มีรายการอ้างอิง");await page.getByRole("button",{name:"ลบ / เก็บเข้าคลัง",exact:true}).click();await page.getByRole("button",{name:"ยืนยันลบ / เก็บเข้าคลัง",exact:true}).click();await expect(page.getByRole("status")).toContainText("ลบข้อมูลที่ไม่มีรายการอ้างอิงแล้ว");
  const invalid=await page.request.post("/api/masters/vehicle-types",{headers:{origin:"http://127.0.0.1:3011","idempotency-key":"e2e-invalid"},data:{action:"save",expectedVersion:0,reason:"ทดสอบค่าผิด",values:{code:"BAD",name:"ทดสอบ",wheelCount:-1,active:true}}});expect(invalid.status()).toBe(400);expect((await invalid.json()).message).toContain("ต้องมากกว่าศูนย์");
  await page.goto("/admin/branches/new");
  for(const [name,value] of Object.entries({code:"BROWSER-BRANCH",name:"สาขาหน้าจอสังเคราะห์",addressLine:"ที่อยู่สังเคราะห์",subdistrict:"ตำบลทดสอบ",district:"อำเภอทดสอบ",province:"จังหวัดทดสอบ",postalCode:"50000",contactName:"ผู้รับสังเคราะห์",contactPhone:"0800000000",activeFrom:"01/01/2573",reason:"ทดสอบวันที่ พ.ศ. ผ่านหน้าจอ"}))await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="destinationType"]').selectOption("BRANCH");await page.getByRole("button",{name:"บันทึกข้อมูล"}).click();await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลสำเร็จ");
  const branches=await page.request.get("/api/masters/branches?q=BROWSER-BRANCH");expect((await branches.json()).rows[0].activeFrom).toBe("2030-01-01T00:00:00.000Z");
  const csv=await page.request.get("/api/masters/branches/export?q=BROWSER-BRANCH");expect(csv.status()).toBe(200);expect(await csv.text()).toContain("รหัสไปรษณีย์");
});
test("unauthenticated/cross-role/cross-branch/CSRF and mass assignment requests fail on server",async({page,request})=>{
  expect((await request.get("/api/masters/branches")).status()).toBe(401);
  await page.goto("/admin");await expect(page).toHaveURL(/\/login$/);await login(page,"branch");
  const rows=await page.request.get("/api/masters/branches?status=all");expect(rows.status()).toBe(200);expect((await rows.json()).rows).toHaveLength(1);
  expect((await page.request.get("/api/masters/branches/synthetic-branch-b")).status()).toBe(404);
  expect((await page.request.get("/api/masters/branches/export")).status()).toBe(403);
  expect((await page.request.post("/api/masters/drivers",{headers:{origin:"http://127.0.0.1:3011","idempotency-key":"e2e-forbidden"},data:{action:"save",expectedVersion:0,reason:"ทดสอบสิทธิ์",values:{code:"FORGED",name:"ปลอมสิทธิ์",active:true}}})).status()).toBe(403);
  expect((await page.request.post("/api/masters/drivers",{headers:{origin:"https://attacker.example"},data:{}})).status()).toBe(403);
  // D221 header profile: one account type, the working scope, and the account page.
  const trigger=page.getByRole("button",{name:/^บัญชี /});await expect(trigger).toHaveAccessibleName(/พนักงานสาขา$/);await trigger.click();
  await expect(page.locator(".profile-facts")).toContainText("ประเภทบัญชี");await expect(page.locator(".profile-facts")).toContainText("สาขา");
  await page.getByRole("link",{name:"บัญชีของฉัน"}).click();await expect(page).toHaveURL(/\/account$/);await expect(page.getByRole("heading",{name:"สิทธิ์การใช้งาน"})).toBeVisible();await expect(page.locator(".account-facts .type-chip")).toHaveText("พนักงานสาขา");
  await page.getByRole("button",{name:/^บัญชี /}).click();await page.getByRole("button",{name:"ออกจากระบบ"}).click();await expect(page).toHaveURL(/\/login$/);expect((await page.request.get("/api/masters/branches")).status()).toBe(401);
});
test("Thai vehicle and branch forms at desktop/mobile sizes with no horizontal page overflow",async({page})=>{
  await login(page);mkdirSync("docs/evidence/phase-3",{recursive:true});
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    for(const kind of ["vehicles","branches"]){await page.goto(`/admin/${kind}/new`);await expect(page.getByRole("button",{name:"บันทึกข้อมูล"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:`docs/evidence/phase-3/${kind}-${width}.png`,fullPage:true});}
  }
  await page.goto("/admin/vehicles");await expect(page.getByRole("region",{name:"รายการข้อมูลรถ"})).toBeVisible();
});
test("auth signup closed, unknown auth paths Thai, wrong origin and repeated invalid login rejected",async({request})=>{
  expect((await request.post("/api/auth/sign-up/email",{headers:{origin:"http://127.0.0.1:3011"},data:{email:"attacker@example.com",password:"password-untrusted",name:"ปลอม"}})).status()).toBe(404);
  expect((await request.post("/api/auth/sign-in/email",{headers:{origin:"https://attacker.example"},data:{email:credentials.admin,password:credentials.password}})).status()).toBe(403);
  const statuses=[];for(let i=0;i<7;i++)statuses.push((await request.post("/api/auth/sign-in/email",{headers:{origin:"http://127.0.0.1:3011"},data:{email:credentials.admin,password:"invalid-password"}})).status());expect(statuses).toContain(429);
});
