import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ErrorPage from "../../src/app/error";
import GlobalError from "../../src/app/global-error";

test("error boundaries offer Thai recovery without exposing internal error details", () => {
  const error = Object.assign(new Error("sensitive-database-password"), { digest: "internal-digest" });
  for (const component of [ErrorPage, GlobalError]) {
    const html = renderToStaticMarkup(createElement(component, { error, reset: () => {} }));
    assert.ok(html.includes("ลองใหม่"));
    assert.ok(!html.includes(error.message));
    assert.ok(!html.includes(error.digest));
  }
});
