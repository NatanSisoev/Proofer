import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSessionCalibration, actualOutcome } from "../lib/sessionCalibration.ts";

test("actualOutcome: maps verdicts to their score", () => {
  assert.equal(actualOutcome("correct"), 1);
  assert.equal(actualOutcome("partial"), 0.5);
  assert.equal(actualOutcome("incorrect"), 0);
});

test("computeSessionCalibration: no rated attempts returns null", () => {
  assert.equal(computeSessionCalibration([]), null);
});

test("computeSessionCalibration: perfect calibration scores 100 with zero bias", () => {
  const result = computeSessionCalibration([
    { verdict: "correct", predicted: 1.0 },
    { verdict: "incorrect", predicted: 0.0 },
  ]);
  assert.ok(result);
  assert.equal(result.score, 100);
  assert.equal(result.bias, 0);
  assert.equal(result.overconfCount, 0);
});

test("computeSessionCalibration: high confidence on a wrong answer is overconfident", () => {
  // Predicted 90%, actually incorrect (0) — a 0.9 gap, well past the 0.15 threshold.
  const result = computeSessionCalibration([{ verdict: "incorrect", predicted: 0.9 }]);
  assert.ok(result);
  assert.ok(result.bias > 0, `expected positive bias, got ${result.bias}`);
  assert.equal(result.overconfCount, 1);
  assert.equal(result.avgGapPp, 90);
  assert.ok(result.score < 20, `expected a low calibration score, got ${result.score}`);
});

test("computeSessionCalibration: low confidence on a correct answer is underconfident, not overconfident", () => {
  const result = computeSessionCalibration([{ verdict: "correct", predicted: 0.1 }]);
  assert.ok(result);
  assert.ok(result.bias < 0, `expected negative bias, got ${result.bias}`);
  assert.equal(result.overconfCount, 0);
});

test("computeSessionCalibration: mixed session averages the gap across only the overconfident attempts", () => {
  const result = computeSessionCalibration([
    { verdict: "correct", predicted: 1.0 },   // well-calibrated, diff = 0
    { verdict: "incorrect", predicted: 0.8 }, // overconfident, diff = 0.8
    { verdict: "incorrect", predicted: 0.6 }, // overconfident, diff = 0.6
  ]);
  assert.ok(result);
  assert.equal(result.overconfCount, 2);
  assert.equal(result.avgGapPp, 70); // (0.8 + 0.6) / 2 = 0.7 -> 70pp
});
