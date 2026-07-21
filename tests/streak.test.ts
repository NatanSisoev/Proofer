import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveStreak, type StreakFreezeState } from "../lib/streak.ts";

const NO_FREEZES: StreakFreezeState = { earned: 0, usedDates: [], lastMilestone: 0 };
// Local midnight, so the walk's calendar arithmetic is unambiguous.
const JUL_15 = new Date(2026, 6, 15);

test("resolveStreak: counts consecutive days ending today", () => {
  const r = resolveStreak(new Set(["2026-07-15", "2026-07-14", "2026-07-13"]), NO_FREEZES, JUL_15);
  assert.equal(r.streakDays, 3);
  assert.deepEqual(r.newlyUsed, []);
});

test("resolveStreak: a streak stays alive until midnight when today has no practice yet", () => {
  const r = resolveStreak(new Set(["2026-07-14", "2026-07-13"]), NO_FREEZES, JUL_15);
  assert.equal(r.streakDays, 2);
});

test("resolveStreak: a banked freeze bridges a gap inside an active streak", () => {
  // Missed the 14th, but practiced on either side of it.
  const state: StreakFreezeState = { earned: 1, usedDates: [], lastMilestone: 0 };
  const r = resolveStreak(new Set(["2026-07-15", "2026-07-13", "2026-07-12"]), state, JUL_15);
  assert.equal(r.streakDays, 4);
  assert.deepEqual(r.newlyUsed, ["2026-07-14"]);
  assert.equal(r.freezesAvailable, 0);
});

test("resolveStreak: an already-spent freeze keeps counting without being re-spent", () => {
  const state: StreakFreezeState = { earned: 1, usedDates: ["2026-07-14"], lastMilestone: 0 };
  const r = resolveStreak(new Set(["2026-07-15", "2026-07-13"]), state, JUL_15);
  assert.equal(r.streakDays, 3);
  assert.deepEqual(r.newlyUsed, []);
});

test("resolveStreak: freezes are NOT spent resurrecting a streak that already lapsed", () => {
  // Regression: the student last practiced two weeks ago. Opening the app must
  // not burn banked tokens to manufacture a streak they never had.
  const state: StreakFreezeState = { earned: 2, usedDates: [], lastMilestone: 0 };
  const r = resolveStreak(new Set(["2026-07-01"]), state, JUL_15);
  assert.equal(r.streakDays, 0);
  assert.deepEqual(r.newlyUsed, []);
  assert.equal(r.freezesAvailable, 2, "banked freezes must survive an absence");
});

test("resolveStreak: trailing freezes past the last real practice day are not spent", () => {
  // Regression: freezes used to be burned padding the far end of the walk,
  // inflating the streak with days that no practice anchors.
  const state: StreakFreezeState = { earned: 3, usedDates: [], lastMilestone: 0 };
  const r = resolveStreak(new Set(["2026-07-15", "2026-07-14"]), state, JUL_15);
  assert.equal(r.streakDays, 2);
  assert.deepEqual(r.newlyUsed, []);
  assert.equal(r.freezesAvailable, 3);
});

test("resolveStreak: walks calendar days across a month boundary", () => {
  const r = resolveStreak(
    new Set(["2026-03-01", "2026-02-28", "2026-02-27"]),
    NO_FREEZES,
    new Date(2026, 2, 1)
  );
  assert.equal(r.streakDays, 3);
});

test("resolveStreak: awards one freeze per 7-day milestone, once", () => {
  const week = new Set([
    "2026-07-15", "2026-07-14", "2026-07-13", "2026-07-12",
    "2026-07-11", "2026-07-10", "2026-07-09",
  ]);
  const first = resolveStreak(week, NO_FREEZES, JUL_15);
  assert.equal(first.streakDays, 7);
  assert.equal(first.earned, 1);
  assert.equal(first.lastMilestone, 1);

  // Recomputing with the milestone already credited must not award another.
  const again = resolveStreak(week, { earned: 1, usedDates: [], lastMilestone: 1 }, JUL_15);
  assert.equal(again.earned, 1);
});
