import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/**
 * D227 upload package for a host without a build pipeline (for example DirectAdmin "Setup Node.js App").
 * Builds the application, then assembles .local/deploy/app (ignored by Git) with only what the server needs to run:
 * the production build, static files, the Passenger startup file and a package.json limited to runtime dependencies,
 * so "Run NPM Install" on the host installs Linux binaries and never runs development tooling.
 * No .env, credentials, uploads, tests, sources or local data are copied.
 */
const OUT = resolve(".local/deploy"), APP = join(OUT, "app"), ZIP = join(OUT, "moointer-transport-app.zip");
const windows = process.platform === "win32";
const run = (command: string, args: string[], cwd = process.cwd()) => {
  const r = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`COMMAND_FAILED ${command} ${args[0] ?? ""}`);
};

try {
  // npm is a .cmd shim on Windows, so it is started through the command interpreter with fixed arguments.
  const npm = (args: string[], cwd?: string) => windows ? run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm", ...args], cwd) : run("npm", args, cwd);
  if (!process.argv.includes("--skip-build")) npm(["run", "build"]);
  if (!existsSync(".next/BUILD_ID")) throw new Error("BUILD_MISSING");
  rmSync(APP, { recursive: true, force: true }); mkdirSync(APP, { recursive: true });
  // The build cache, development output and trace files are not needed at run time.
  const skipped = new Set(["cache", "dev", "trace", "trace-build", "diagnostics", "types", "node_modules"]);
  cpSync(".next", join(APP, ".next"), { recursive: true, filter: (source) => { const parts = source.split(/[\\/]/); return !(parts[0] === ".next" && skipped.has(parts[1] ?? "")); } });
  // .next/node_modules holds links to packages on this machine. They are listed for server.cjs to recreate on the host.
  const externals: { link: string; target: string }[] = [], linkRoot = resolve(".next/node_modules"), modules = realpathSync("node_modules");
  const scan = (dir: string) => { for (const entry of existsSync(dir) ? readdirSync(dir) : []) {
    const full = join(dir, entry);
    const slashes = (value: string) => value.split(sep).join("/");
    if (lstatSync(full).isSymbolicLink()) externals.push({ link: slashes(relative(linkRoot, full)), target: slashes(relative(modules, realpathSync(full))) });
    else if (lstatSync(full).isDirectory()) scan(full);
  } };
  scan(linkRoot);
  if (externals.some((e) => e.target.startsWith(".."))) throw new Error("EXTERNAL_LINK_OUTSIDE_NODE_MODULES");
  writeFileSync(join(APP, "next-externals.json"), JSON.stringify(externals, null, 2));
  cpSync("public", join(APP, "public"), { recursive: true });
  for (const file of ["server.cjs", "diagnose-database.cjs", "next.config.ts", "package-lock.json"]) cpSync(file, join(APP, file));

  const source = JSON.parse(readFileSync("package.json", "utf8"));
  const runtime = {
    name: source.name, version: source.version, private: true, type: source.type,
    // Tested on Node.js 24.14 (all suites) and 20.20.2 (simulated host installation); the bound is what Next.js 16 and Prisma 7 accept.
    engines: { node: ">=20.19.0" },
    scripts: { start: "node server.cjs", "db:diagnose:host": "node diagnose-database.cjs" },
    dependencies: source.dependencies, overrides: source.overrides,
  };
  writeFileSync(join(APP, "package.json"), `${JSON.stringify(runtime, null, 2)}\n`);
  // Keep the reviewed dependency versions: the lock file is reduced to the runtime set, not resolved afresh.
  npm(["install", "--package-lock-only", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], APP);

  writeFileSync(join(APP, ".env.example"), [
    "# คัดลอกไฟล์นี้เป็น .env ในโฟลเดอร์เดียวกันบนโฮสต์ แล้วแก้ค่าทุกบรรทัด ห้ามนำ .env ไปไว้ใน public_html",
    "APP_ENV=production",
    "# โดเมนจริงของระบบ ต้องเป็น https และไม่มี / ต่อท้าย",
    "BETTER_AUTH_URL=https://transport.example.co.th",
    "# สุ่มใหม่อย่างน้อย 32 ตัวอักษร ห้ามใช้ค่าจากเครื่องพัฒนา (เปลี่ยนค่านี้ = ทุกคนถูกออกจากระบบ)",
    "BETTER_AUTH_SECRET=REPLACE_WITH_RANDOM_SECRET_AT_LEAST_32_CHARACTERS",
    "# ผู้ใช้ รหัสผ่าน และชื่อฐานข้อมูลที่สร้างใน DirectAdmin (รหัสผ่านที่มีอักขระพิเศษต้องเข้ารหัสแบบ URL)",
    "DATABASE_URL=mysql://DB_USER:DB_PASSWORD@localhost:3306/DB_NAME",
    "# ให้นับการลองรหัสผ่านผิดแยกตามเครื่องผู้ใช้ จากหัวข้อที่เว็บเซิร์ฟเวอร์ของโฮสต์ส่งมา",
    "TRUSTED_PROXY_HEADER=x-forwarded-for",
    "# TRUSTED_PROXY_HOPS=1",
    "# โฟลเดอร์เก็บไฟล์แนบ (อยู่นอก public_html) ค่าเริ่มต้นคือ .local/uploads ในโฟลเดอร์แอป",
    "# UPLOAD_DIR=.local/uploads",
    "# DATABASE_POOL_SIZE=5", "",
  ].join("\n"));

  writeFileSync(join(OUT, "INSTALL-TH.txt"), [
    "ระบบจัดการเส้นทางและขนส่งหมูอินเตอร์ (MooRoute) — ขั้นตอนติดตั้งบนโฮสต์ DirectAdmin",
    "",
    "ไฟล์ในโฟลเดอร์นี้",
    "  moointer-transport-app.zip        ตัวระบบที่ build แล้ว (อัปโหลดไฟล์นี้ไฟล์เดียว)",
    "  sql/1_schema_mysql8.sql           โครงสร้างฐานข้อมูล สำหรับ MySQL 8.x",
    "  sql/1_schema_mariadb.sql          โครงสร้างฐานข้อมูล สำหรับ MariaDB",
    "  sql/2_first_administrator.sql     บัญชีผู้ดูแลระบบคนแรก",
    "  sql/first-administrator.txt       อีเมลและรหัสผ่านชั่วคราวของผู้ดูแลระบบคนแรก (ห้ามอัปโหลดขึ้นโฮสต์)",
    "",
    "ก่อนเริ่ม ตรวจโฮสต์ 4 ข้อ",
    "  1. DirectAdmin มีเมนู Setup Node.js App (ถ้าไม่มี แพ็กเกจโฮสต์นี้รันระบบไม่ได้ ต้องขอเปิดหรือใช้ VPS)",
    "  2. มี Node.js รุ่น 20.19 ขึ้นไป (ทดสอบครบบนรุ่น 24.14 และทดสอบการติดตั้งจำลองผ่านบนรุ่น 20.20.2) ถ้ามีรุ่น 24 ให้เลือกรุ่น 24",
    "  3. เปิด phpMyAdmin ดูหัวข้อ Database server > Server type ว่าเป็น MySQL หรือ MariaDB และรุ่นอะไร",
    "  4. โดเมนหรือซับโดเมนที่จะใช้มีใบรับรอง SSL (เปิดด้วย https ได้) ระบบไม่ทำงานบน http",
    "",
    "ขั้นที่ 1 สร้างฐานข้อมูล",
    "  DirectAdmin > MySQL Management > Create new Database ตั้งชื่อฐานข้อมูล ชื่อผู้ใช้ และรหัสผ่าน จดไว้",
    "",
    "ขั้นที่ 2 นำเข้าตาราง",
    "  phpMyAdmin > คลิกชื่อฐานข้อมูลที่สร้าง > แท็บ Import > เลือกไฟล์ 1_schema_mysql8.sql (หรือ 1_schema_mariadb.sql ถ้าโฮสต์เป็น MariaDB) > Import",
    "  เสร็จแล้วต้องเห็น 57 ตาราง จากนั้น Import ไฟล์ 2_first_administrator.sql ต่อ",
    "  ห้ามนำเข้าไฟล์โครงสร้างซ้ำในฐานข้อมูลที่มีตารางแล้ว",
    "  ถ้าขึ้นข้อผิดพลาด #1419 (เรื่อง SUPER privilege / binary logging) ให้แจ้งผู้ให้บริการโฮสต์เปิดค่า log_bin_trust_function_creators แล้วนำเข้าใหม่ในฐานข้อมูลว่าง",
    "",
    "ขั้นที่ 3 อัปโหลดตัวระบบ",
    "  File Manager > สร้างโฟลเดอร์ moointer-transport ไว้ระดับเดียวกับ domains (นอก public_html) > อัปโหลด moointer-transport-app.zip เข้าโฟลเดอร์นี้ > Extract",
    "",
    "ขั้นที่ 4 ตั้งค่า",
    "  ในโฟลเดอร์ moointer-transport คัดลอก .env.example เป็น .env แล้วแก้ 4 ค่า: BETTER_AUTH_URL (https://โดเมนจริง), BETTER_AUTH_SECRET (สุ่มใหม่ 32 ตัวอักษรขึ้นไป), DATABASE_URL (ผู้ใช้ รหัสผ่าน ชื่อฐานข้อมูลจากขั้นที่ 1)",
    "",
    "ขั้นที่ 5 สร้างแอป Node.js",
    "  DirectAdmin > Setup Node.js App > Create Application",
    "    Node.js version: รุ่นสูงสุดที่มี (24 หรือ 20.20.2)   Application mode: Production",
    "    Application root: moointer-transport   (ห้ามใช้โฟลเดอร์ public_html เพราะไฟล์ .env ที่มีรหัสผ่านฐานข้อมูลจะถูกเปิดอ่านจากเว็บได้)",
    "    Application URL: โดเมนหรือซับโดเมนที่จะใช้ (ช่องต่อท้ายเว้นว่าง)",
    "    Application startup file: server.cjs   (ไม่ใช่ server.js)",
    "    Passenger log file: /home/ชื่อผู้ใช้โฮสต์/logs/mooroute-passenger.log (ใช้ดูสาเหตุถ้าเปิดเว็บไม่ขึ้น)",
    "  กด Create แล้วกด Run NPM Install รอจนเสร็จ แล้วกด Restart",
    "",
    "ขั้นที่ 6 ตรวจและเริ่มใช้",
    "  เปิด https://โดเมน/api/health/live ต้องได้ผลตอบกลับ จากนั้นเปิด https://โดเมน/login",
    "  เข้าด้วยอีเมลและรหัสผ่านชั่วคราวในไฟล์ first-administrator.txt แล้วเปลี่ยนรหัสผ่านที่ บัญชีของฉัน ทันที",
    "  สร้างแผนกที่ จัดการหลังบ้าน > แผนก แล้วสร้างบัญชีพนักงานที่ จัดการหลังบ้าน > ผู้ใช้งาน",
    "  ถ้าพนักงานหลายคนเข้าสู่ระบบพร้อมกันแล้วขึ้นว่าลองหลายครั้งเกินไป ให้ลองตั้ง TRUSTED_PROXY_HOPS=2 ใน .env แล้ว Restart",
    "",
    "ข้อจำกัดที่ควรรู้",
    "  - ระบบพัฒนาและทดสอบครบบน MySQL 8.4 ส่วน MariaDB ทดสอบชุดทดสอบฝั่งเซิร์ฟเวอร์และการติดตั้งจำลองผ่านบนรุ่น 10.4.32 เท่านั้น",
    "  - ยังไม่เคยรันบนโฮสต์ DirectAdmin จริง ขั้นตอนข้างบนเขียนจากวิธีทำงานมาตรฐานของ Setup Node.js App",
    "  - ยังไม่มีการสำรองข้อมูลอัตโนมัติ ให้ตั้ง backup ฐานข้อมูลใน DirectAdmin และสำรองโฟลเดอร์ .local/uploads (ไฟล์แนบ)",
    "  - ไฟล์ .env และ first-administrator.txt เป็นความลับ ห้ามวางใน public_html และห้ามส่งต่อ", "",
  ].join("\r\n"), "utf8");

  rmSync(ZIP, { force: true });
  // Windows ships bsdtar, which writes a real zip with forward-slash paths that Linux hosts extract correctly.
  if (windows) run(join(process.env.SystemRoot ?? "C:/Windows", "System32", "tar.exe"), ["-a", "-c", "-f", ZIP, "."], APP);
  else run("zip", ["-q", "-r", ZIP, "."], APP);
  console.log(`PASS: upload package ${ZIP} (folder ${APP}). No .env, credentials or local data included.`);
} catch (error) { console.error(`DEPLOY_PACKAGE_FAILED: ${(error as Error).message}`); process.exitCode = 1; }
