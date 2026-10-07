// Startup file for hosts that run Node.js applications through Phusion Passenger
// (DirectAdmin / CloudLinux "Setup Node.js App"). It serves the production build in .next from this folder.
// Passenger replaces the port passed to listen(); PORT is used when the file is started by hand.
/* eslint-disable @typescript-eslint/no-require-imports -- Passenger loads this file with require(), so it must be CommonJS. */
const { createServer } = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const next = require("next");

/**
 * The build refers to some packages through links under .next/node_modules that point at the build machine.
 * An uploaded copy lists them in next-externals.json instead, and they are recreated here against this folder's
 * node_modules (a copy is made where the host does not allow links). Nothing happens when the list is absent.
 */
function restoreExternalLinks() {
  const list = path.join(__dirname, "next-externals.json");
  if (!fs.existsSync(list)) return;
  for (const { link, target } of JSON.parse(fs.readFileSync(list, "utf8"))) {
    const from = path.join(__dirname, ".next", "node_modules", ...link.split("/")), to = path.join(__dirname, "node_modules", ...target.split("/"));
    if (!fs.existsSync(to)) throw Object.assign(new Error("DEPENDENCIES_NOT_INSTALLED"), { code: "DEPENDENCIES_NOT_INSTALLED" });
    if (fs.existsSync(path.join(from, "package.json"))) continue;
    fs.rmSync(from, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(from), { recursive: true });
    try { fs.symlinkSync(process.platform === "win32" ? to : path.relative(path.dirname(from), to), from, process.platform === "win32" ? "junction" : "dir"); }
    catch { fs.cpSync(to, from, { recursive: true }); }
  }
}

let app;
try { restoreExternalLinks(); app = next({ dev: false, dir: __dirname }); }
// Report only the kind of failure: configuration values and connection strings must never reach a log.
catch (error) { console.error("STARTUP_FAILED", (error && (error.code || error.name)) || "UNKNOWN"); process.exit(1); }
const handle = app.getRequestHandler();

app.prepare()
  .then(() => createServer((request, response) => handle(request, response)).listen(process.env.PORT || 3000))
  .catch((error) => { console.error("STARTUP_FAILED", (error && (error.code || error.name)) || "UNKNOWN"); process.exit(1); });
