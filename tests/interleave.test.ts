import { test } from "node:test";
import assert from "node:assert/strict";
import { interleave } from "../lib/interleave.ts";

// Distinct sentinels so we can assert on identity, order, and provenance.
const due = (n: number) => Array.from({ length: n }, (_, i) => `D${i}`);
const rest = (n: number) => Array.from({ length: n }, (_, i) => `R${i}`);

test("interleave: empty due returns the rest, capped at length", () => {
  assert.deepEqual(interleave([], rest(5), 3), ["R0", "R1", "R2"]);
  assert.deepEqual(interleave([], rest(2), 10), ["R0", "R1"]);
});

test("interleave: empty rest returns the due items, capped at length", () => {
  assert.deepEqual(interleave(due(5), [], 3), ["D0", "D1", "D2"]);
});

test("interleave: spreads due items rather than clustering them at the front", () => {
  // 2 due across 6 slots → the second due item should NOT be adjacent to the first.
  const out = interleave(due(2), rest(4), 6);
  const positions = out.map((x, i) => (x.startsWith("D") ? i : -1)).filter((i) => i >= 0);
  assert.equal(out.length, 6);
  assert.deepEqual(positions, [0, 3], "due items land at evenly spaced slots");
  assert.deepEqual(out, ["D0", "R0", "R1", "D1", "R2", "R3"]);
});

test("interleave: preserves each group's internal order", () => {
  const out = interleave(due(3), rest(3), 6);
  assert.deepEqual(out.filter((x) => x.startsWith("D")), ["D0", "D1", "D2"]);
  assert.deepEqual(out.filter((x) => x.startsWith("R")), ["R0", "R1", "R2"]);
});

test("interleave: never drops or duplicates an input item", () => {
  // Sweep a range of shapes and assert the multiset property everywhere.
  for (const d of [0, 1, 2, 3, 5, 8, 13]) {
    for (const r of [0, 1, 2, 4, 7, 11]) {
      for (const len of [1, 3, 6, 10, 20]) {
        const out = interleave(due(d), rest(r), len);
        const expected = Math.min(len, d + r);
        assert.equal(out.length, expected, `len for due=${d} rest=${r} length=${len}`);
        assert.equal(new Set(out).size, out.length, `no duplicates for due=${d} rest=${r} length=${len}`);
        const usable = new Set([...due(d), ...rest(r)]);
        for (const item of out) assert.ok(usable.has(item), `${item} is a real input item`);
      }
    }
  }
});

test("interleave: when due fills every slot, no new material sneaks in", () => {
  // More due than slots → the queue is all reviews (reviews are the priority).
  const out = interleave(due(5), rest(5), 3);
  assert.deepEqual(out, ["D0", "D1", "D2"]);
});

test("interleave: places every due item even when rest runs out early", () => {
  const out = interleave(due(3), rest(1), 6);
  assert.equal(out.length, 4);
  assert.deepEqual(out.filter((x) => x.startsWith("D")), ["D0", "D1", "D2"]);
  assert.deepEqual(out.filter((x) => x.startsWith("R")), ["R0"]);
});
