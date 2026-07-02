import { test } from "node:test";
import assert from "node:assert/strict";
import { bktUpdate, halfLifeFactor, masteryEntropy, infoGainScore, P_INIT } from "../lib/mastery.ts";

test("bktUpdate: perfect evidence raises a low prior", () => {
  const updated = bktUpdate(P_INIT, 1.0);
  assert.ok(updated > P_INIT, `expected ${updated} > ${P_INIT}`);
  assert.ok(updated > 0 && updated < 1);
});

test("bktUpdate: zero evidence lowers a high prior", () => {
  const prior = 0.9;
  const updated = bktUpdate(prior, 0.0);
  assert.ok(updated < prior, `expected ${updated} < ${prior}`);
});

test("bktUpdate: a completely wrong answer must not raise a never-practiced prior", () => {
  // Regression: the learning-transition bonus (P_TRANSIT) used to apply
  // unconditionally, so a garbage/off-topic answer (evidence=0) on a
  // never-practiced concept (prior floored to P_INIT) still added a flat
  // +12pp — mastery jumped from 0% to ~14% on a nonsense answer.
  const updated = bktUpdate(P_INIT, 0.0);
  assert.ok(updated < P_INIT, `expected ${updated} < ${P_INIT} (evidence=0 must not increase mastery)`);
  assert.ok(updated < 0.05, `expected ${updated} well under 5%, got ${updated}`);
});

test("bktUpdate: output always stays within (0, 1)", () => {
  for (const prior of [0.01, 0.15, 0.5, 0.9, 0.99]) {
    for (const evidence of [0, 0.25, 0.5, 0.75, 1]) {
      const updated = bktUpdate(prior, evidence);
      assert.ok(updated > 0 && updated < 1, `bktUpdate(${prior}, ${evidence}) = ${updated} out of (0,1)`);
    }
  }
});

test("halfLifeFactor: strong evidence doubles, weak evidence halves", () => {
  assert.equal(halfLifeFactor(1.0), 2.0);
  assert.equal(halfLifeFactor(0.75), 2.0);
  assert.equal(halfLifeFactor(0.5), 1.2);
  assert.equal(halfLifeFactor(0.4), 1.2);
  assert.equal(halfLifeFactor(0.0), 0.5);
});

test("masteryEntropy: zero at the extremes, maximal at p=0.5", () => {
  assert.equal(masteryEntropy(0), 0);
  assert.equal(masteryEntropy(1), 0);
  assert.equal(masteryEntropy(0.5), 1); // 1 bit of uncertainty for a fair coin
  assert.ok(masteryEntropy(0.5) > masteryEntropy(0.2));
  assert.ok(masteryEntropy(0.5) > masteryEntropy(0.8));
});

test("infoGainScore: never-practiced concepts are treated as maximally uncertain", () => {
  const neverPracticed = infoGainScore({ p: 0, attempts: 0, unlocks: 0 });
  const knownLow = infoGainScore({ p: 0.05, attempts: 3, unlocks: 0 });
  assert.ok(neverPracticed > knownLow, "an untested concept should score above a confidently-low one");
});

test("infoGainScore: more unlocks scores higher at equal uncertainty", () => {
  const fewUnlocks = infoGainScore({ p: 0.5, attempts: 1, unlocks: 0 });
  const manyUnlocks = infoGainScore({ p: 0.5, attempts: 1, unlocks: 10 });
  assert.ok(manyUnlocks > fewUnlocks);
});
