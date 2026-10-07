import assert from "node:assert/strict";
import { test } from "node:test";
import { ACCOUNT_TYPES, ROLE_NAMES, accountTypeOf, initialOf } from "../../src/lib/account-display";

test("D220: the profile badge shows one readable initial and skips Thai leading vowels", () => {
  assert.equal(initialOf("ผู้ดูแลระบบ (บัญชีทดสอบ)"), "ผู้");
  assert.equal(initialOf("เจ้าหน้าที่คลังกลาง"), "จ้");
  assert.equal(initialOf("  ไก่ทอด"), "ก่");
  assert.equal(initialOf("somchai"), "S");
  assert.equal(initialOf(""), "?");
});

test("D221: five account types; retired codes are named as the type that absorbed them", () => {
  assert.deepEqual(ACCOUNT_TYPES.map((t) => t.code), ["REQUESTER", "BRANCH_RECEIVER", "WAREHOUSE", "DISPATCHER", "ADMINISTRATOR"]);
  assert.deepEqual(ACCOUNT_TYPES.map((t) => t.name), ["พนักงานทั่วไป", "พนักงานสาขา", "คลังและรถขนส่ง", "ผู้วางแผนขนส่ง", "ผู้ดูแลระบบ"]);
  assert.equal(ROLE_NAMES.DRIVER, "คลังและรถขนส่ง");
  assert.equal(ROLE_NAMES.SUPERVISOR, "ผู้วางแผนขนส่ง");
  assert.equal(new Set(Object.values(ROLE_NAMES)).size, 5, "people only ever see five names");
});

test("D221: one account type per account; the widest wins and unknown codes are ignored", () => {
  assert.equal(accountTypeOf(["SUPERVISOR"])?.code, "DISPATCHER");
  assert.equal(accountTypeOf(["DRIVER"])?.code, "WAREHOUSE");
  assert.equal(accountTypeOf(["REQUESTER", "WAREHOUSE"])?.code, "WAREHOUSE");
  assert.equal(accountTypeOf(["DISPATCHER", "SUPERVISOR"])?.name, "ผู้วางแผนขนส่ง");
  assert.equal(accountTypeOf(["ADMINISTRATOR", "REQUESTER"])?.code, "ADMINISTRATOR");
  assert.equal(accountTypeOf(["CUSTOM_ROLE"]), null);
  assert.equal(accountTypeOf([]), null);
});
