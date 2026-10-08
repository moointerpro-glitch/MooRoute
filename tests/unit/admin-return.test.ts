import {test} from "node:test";
import assert from "node:assert/strict";
import {adminReturnHref} from "../../src/lib/admin-return";

test("admin return keeps approved list filters without allowing cross-page or external navigation",()=>{
 const fallback="/admin/users";
 assert.equal(adminReturnHref("/admin/users?q=test&status=active&page=2&type=WAREHOUSE&secret=discard#anchor",fallback),"/admin/users?q=test&status=active&page=2&type=WAREHOUSE");
 for(const value of [undefined,["/admin/users"],"https://evil.invalid/admin/users","//evil.invalid/admin/users","/\\evil.invalid/admin/users","/admin/users/new","/admin/users/../imports","javascript:alert(1)"])assert.equal(adminReturnHref(value,fallback),fallback);
 assert.equal(new URL(adminReturnHref("/admin/users?q="+"a".repeat(150),fallback),"https://admin.invalid").searchParams.get("q")?.length,100);
});
