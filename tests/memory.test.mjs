// Checks the personal review schedule.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const source = readFileSync(new URL("../public/memory.js", import.meta.url), "utf8");
const Memory = vm.runInNewContext(`${source}; Memory`);

test("a new word comes back tomorrow, or today if missed", () => {
  assert.equal(Memory.review({ b: 0, d: 0 }, "good", 100).d, 101);
  assert.equal(Memory.review({ b: 0, d: 0 }, "bad", 100).d, 100);
});
test("each correct review stretches the gap", () => {
  let c = Memory.review({ b: 0, d: 0 }, "good", 0), gaps = [];
  for (let i = 0; i < 5; i++) { const day = c.d; c = Memory.review(c, "good", day); gaps.push(c.d - day); }
  gaps.forEach((g, i) => { if (i) assert.ok(g > gaps[i - 1], `gap ${i}`); });
  assert.equal(c.b, 5);
});
test("a missed word loses most of its strength and returns today", () => {
  const c = Memory.review({ b: 4, s: 20, ease: 2.2, last: 80, d: 100 }, "bad", 100);
  assert.equal(c.d, 100);
  assert.ok(c.s < 8);
  assert.equal(c.lapses, 1);
});
test("a right answer with accent slips grows less", () => {
  const start = { b: 3, s: 5, ease: 2.2, last: 95, d: 100 };
  assert.ok(Memory.review(start, "accent", 100).s < Memory.review(start, "good", 100).s);
});
test("a late correct answer earns a larger jump", () => {
  const onTime = Memory.review({ b: 3, s: 5, ease: 2.2, last: 95 }, "good", 100);
  const late = Memory.review({ b: 3, s: 5, ease: 2.2, last: 60 }, "good", 100);
  assert.ok(late.s > onTime.s);
});
test("older cards keep their progress", () => {
  const c = Memory.normalize({ b: 3, d: 107 }, 100);
  assert.equal(c.s, 7);
  assert.equal(c.last, 100);
  assert.equal(Memory.normalize({ b: 4, s: 12, ease: 2 }, 100).s, 12);
});
test("recall falls over time", () => {
  const c = { s: 10, last: 0 };
  assert.equal(Memory.recall(c, 0), 1);
  assert.ok(Math.abs(Memory.recall(c, 10) - 0.9) < 1e-9);
  assert.ok(Memory.recall(c, 30) < Memory.recall(c, 10));
});
test("gaps adapt to this learner's accuracy, within limits", () => {
  assert.equal(Memory.tune([1, 1, 1]), 1);
  assert.ok(Memory.tune(Array(40).fill(1)) > 1);
  assert.ok(Memory.tune(Array(40).fill(0)) < 1);
  assert.equal(Memory.tune(Array(40).fill(0)), 0.6);
  assert.ok(Memory.tune(Array(40).fill(1)) <= 1.5);
});
