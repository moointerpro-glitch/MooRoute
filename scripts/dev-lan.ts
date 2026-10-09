import "dotenv/config";
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { isPrivateNetworkAddress } from "../src/server/auth/config";

// Development server for devices on the same private network (D240). It listens on this machine's private
// address only, never on a public one, and nothing is written to .env: `npm run dev` stays loopback-only.
const PORT = 3010;
const requested = process.argv.find((value) => value.startsWith("--host="))?.slice(7);
const addresses = Object.values(networkInterfaces()).flat().filter((entry) => entry && !entry.internal && isPrivateNetworkAddress(entry.address)).map((entry) => entry!.address);
const host = requested ?? addresses[0];
if (process.env.APP_ENV !== "local" || !host || !addresses.includes(host)) {
  console.error(`DEV_LAN_UNAVAILABLE: APP_ENV must be local and the address must be one of this machine's private addresses (${addresses.join(", ") || "none found"}).`);
  process.exit(1);
}
const origin = `http://${host}:${PORT}`;
console.log(`Sharing the development server on the local network: ${origin} (sign in and open pages through this address, not 127.0.0.1).`);
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", host, "--port", String(PORT)],
  { env: { ...process.env, BETTER_AUTH_URL: origin, LOCAL_NETWORK_ACCESS: "1" }, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 1));
