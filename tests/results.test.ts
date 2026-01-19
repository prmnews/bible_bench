import assert from "node:assert/strict";
import test from "node:test";

import { summarizeResults } from "../src/lib/results";

test("summarizeResults returns zeroes for empty input", () => {
  const summary = summarizeResults([]);
  assert.deepEqual(summary, { total: 0, matches: 0, perfectRate: 0, avgFidelity: 0 });
});

test("summarizeResults computes aggregate metrics", () => {
  const summary = summarizeResults([
    { hashMatch: true, fidelityScore: 100 },
    { hashMatch: false, fidelityScore: 90 },
  ]);

  assert.equal(summary.total, 2);
  assert.equal(summary.matches, 1);
  assert.equal(summary.perfectRate, 0.5);
  assert.equal(summary.avgFidelity, 95);
});
