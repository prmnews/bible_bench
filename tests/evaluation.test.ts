import assert from "node:assert/strict";
import test from "node:test";

import { compareText } from "../src/lib/evaluation";

test("compareText returns perfect score for identical text", () => {
  const result = compareText("In the beginning", "In the beginning");
  assert.equal(result.fidelityScore, 100);
  assert.deepEqual(result.diff, {
    substitutions: 0,
    omissions: 0,
    additions: 0,
    transpositions: 0,
  });
});

test("compareText tracks substitutions", () => {
  const result = compareText("abc", "axc");
  assert.equal(result.fidelityScore, 66.67);
  assert.equal(result.diff.substitutions, 1);
  assert.equal(result.diff.omissions, 0);
  assert.equal(result.diff.additions, 0);
});

test("compareText tracks additions", () => {
  const result = compareText("ab", "abc");
  assert.equal(result.fidelityScore, 66.67);
  assert.equal(result.diff.additions, 1);
  assert.equal(result.diff.substitutions, 0);
  assert.equal(result.diff.omissions, 0);
});
