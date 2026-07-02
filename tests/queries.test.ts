import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeCycle } from "../lib/queries.ts";

const NUL = String.fromCharCode(0);

test("canonicalizeCycle: rotates so the lexicographically smallest id leads", () => {
  const { rotated } = canonicalizeCycle(["c", "a", "b"]);
  assert.deepEqual(rotated, ["a", "b", "c"]);
});

test("canonicalizeCycle: rotations of the same cycle produce the same key", () => {
  const a = canonicalizeCycle(["a", "b", "c"]);
  const b = canonicalizeCycle(["b", "c", "a"]);
  const c = canonicalizeCycle(["c", "a", "b"]);
  assert.equal(a.key, b.key);
  assert.equal(b.key, c.key);
});

test("canonicalizeCycle: a different cycle produces a different key", () => {
  const a = canonicalizeCycle(["a", "b", "c"]);
  const d = canonicalizeCycle(["a", "b", "d"]);
  assert.notEqual(a.key, d.key);
});

test("canonicalizeCycle: handles a 2-cycle (mutual prerequisites), joined by NUL", () => {
  const { rotated, key } = canonicalizeCycle(["b", "a"]);
  assert.deepEqual(rotated, ["a", "b"]);
  assert.equal(key, ["a", "b"].join(NUL));
});
