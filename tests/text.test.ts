import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateMath, cleanContext } from "../lib/text.ts";

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

test("cleanContext: unwraps [[wikilinks]] to their display text", () => {
  assert.equal(
    cleanContext("Repeat [[Dirichlet Criterion]]'s proof until"),
    "Repeat Dirichlet Criterion's proof until"
  );
});

test("cleanContext: uses the alias side of [[Target|alias]] and drops #anchors", () => {
  assert.equal(cleanContext("see [[Target|the alias]] here"), "see the alias here");
  assert.equal(cleanContext("see [[Target#Section]] here"), "see Target here");
});

test("cleanContext: strips a leading list marker and bold markers", () => {
  assert.equal(
    cleanContext("- [[Convergent Series]] — **convergence** is the key hypothesis"),
    "Convergent Series — convergence is the key hypothesis"
  );
});

test("cleanContext: drops stray brackets from a context clipped mid-wikilink", () => {
  assert.equal(
    cleanContext("whose encoder is a [[Convolutional Neural Net"),
    "whose encoder is a Convolutional Neural Net"
  );
});

test("cleanContext: removes Templater proof scaffolding but keeps inline math", () => {
  assert.equal(
    cleanContext("by the [[Telescopic Series]] formula.`\\end{proof}`"),
    "by the Telescopic Series formula."
  );
  assert.equal(cleanContext("convergence of $\\sum a_n$ matters"), "convergence of $\\sum a_n$ matters");
});
