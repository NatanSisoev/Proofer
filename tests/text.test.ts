import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateMath } from "../lib/text.ts";

test("truncateMath: returns the string unchanged when under the limit", () => {
  assert.equal(truncateMath("short", 10), "short");
});

test("truncateMath: adds an ellipsis when truncating outside any math span", () => {
  const result = truncateMath("hello world, this is long", 11);
  assert.equal(result, "hello world…");
});

test("truncateMath: backs off before an unbalanced $ instead of splitting a math span", () => {
  const s = "before $x^2 + y^2$ after";
  // Cut lands inside the "$x^2 + y^2$" span (odd number of $ in the prefix).
  const result = truncateMath(s, 12);
  assert.ok(!result.includes("$"), `expected no dangling $ in "${result}"`);
  assert.equal(result, "before…");
});

test("truncateMath: a cut landing exactly on a closed math span keeps it intact", () => {
  const s = "$x$ and more text here";
  const result = truncateMath(s, 3);
  assert.equal(result, "$x$…");
});
