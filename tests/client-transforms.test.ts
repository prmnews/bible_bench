import assert from "node:assert/strict";
import test from "node:test";

import {
  filterTransformsBySeverity,
  getSeverityInfo,
  applyTransformSteps,
  compareText,
  applyTransformsAndScore,
  isTransformEnabled,
  createToggleableSteps,
  DEFAULT_COSMETIC_TRANSFORMS,
  type TransformStep,
} from "../src/lib/client-transforms";

// =============================================================================
// filterTransformsBySeverity tests
// =============================================================================

test("filterTransformsBySeverity returns all steps for critical severity", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "trim", enabled: true, params: {}, severity: "cosmetic" },
    { order: 2, type: "trim", enabled: true, params: {}, severity: "minor" },
    { order: 3, type: "trim", enabled: true, params: {}, severity: "significant" },
    { order: 4, type: "trim", enabled: true, params: {}, severity: "critical" },
  ];

  const result = filterTransformsBySeverity(steps, "critical");
  assert.equal(result.length, 4);
});

test("filterTransformsBySeverity filters to cosmetic only", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "trim", enabled: true, params: {}, severity: "cosmetic" },
    { order: 2, type: "trim", enabled: true, params: {}, severity: "minor" },
    { order: 3, type: "trim", enabled: true, params: {}, severity: "significant" },
  ];

  const result = filterTransformsBySeverity(steps, "cosmetic");
  assert.equal(result.length, 1);
  assert.equal(result[0].severity, "cosmetic");
});

test("filterTransformsBySeverity filters to minor and below", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "trim", enabled: true, params: {}, severity: "cosmetic" },
    { order: 2, type: "trim", enabled: true, params: {}, severity: "minor" },
    { order: 3, type: "trim", enabled: true, params: {}, severity: "significant" },
  ];

  const result = filterTransformsBySeverity(steps, "minor");
  assert.equal(result.length, 2);
});

test("filterTransformsBySeverity includes steps without severity", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "trim", enabled: true, params: {} }, // No severity
    { order: 2, type: "trim", enabled: true, params: {}, severity: "significant" },
  ];

  const result = filterTransformsBySeverity(steps, "cosmetic");
  assert.equal(result.length, 1); // Only the one without severity
});

test("filterTransformsBySeverity handles empty array", () => {
  const result = filterTransformsBySeverity([], "cosmetic");
  assert.equal(result.length, 0);
});

// =============================================================================
// getSeverityInfo tests
// =============================================================================

test("getSeverityInfo returns correct info for cosmetic", () => {
  const info = getSeverityInfo("cosmetic");
  assert.equal(info.label, "Cosmetic");
  assert.ok(info.color.includes("green"));
  assert.ok(info.description.includes("semantic"));
});

test("getSeverityInfo returns correct info for minor", () => {
  const info = getSeverityInfo("minor");
  assert.equal(info.label, "Minor");
  assert.ok(info.color.includes("blue"));
});

test("getSeverityInfo returns correct info for significant", () => {
  const info = getSeverityInfo("significant");
  assert.equal(info.label, "Significant");
  assert.ok(info.color.includes("yellow"));
});

test("getSeverityInfo returns correct info for critical", () => {
  const info = getSeverityInfo("critical");
  assert.equal(info.label, "Critical");
  assert.ok(info.color.includes("red"));
});

test("getSeverityInfo returns unknown for undefined", () => {
  const info = getSeverityInfo(undefined);
  assert.equal(info.label, "Unknown");
});

// =============================================================================
// applyTransformSteps tests
// =============================================================================

test("applyTransformSteps applies replaceMap for Unicode normalization", () => {
  const steps: TransformStep[] = [
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: {
        map: {
          "\u2019": "'",
          "\u201C": '"',
          "\u201D": '"',
        },
      },
    },
  ];

  const input = "The LORD\u2019s \u201Cword\u201D";
  const result = applyTransformSteps(input, steps);
  assert.equal(result, 'The LORD\'s "word"');
});

test("applyTransformSteps applies collapseWhitespace", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "collapseWhitespace", enabled: true, params: {} },
  ];

  const result = applyTransformSteps("In   the    beginning", steps);
  assert.equal(result, "In the beginning");
});

test("applyTransformSteps applies trim", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "trim", enabled: true, params: {} },
  ];

  const result = applyTransformSteps("   In the beginning   ", steps);
  assert.equal(result, "In the beginning");
});

test("applyTransformSteps applies steps in order", () => {
  const steps: TransformStep[] = [
    { order: 2, type: "trim", enabled: true, params: {} },
    { order: 1, type: "collapseWhitespace", enabled: true, params: {} },
  ];

  const result = applyTransformSteps("   In   the   beginning   ", steps);
  assert.equal(result, "In the beginning");
});

test("applyTransformSteps skips disabled steps", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "replaceMap", enabled: false, params: { map: { a: "x" } } },
  ];

  const result = applyTransformSteps("abc", steps);
  assert.equal(result, "abc");
});

test("applyTransformSteps applies stripMarkupTags", () => {
  const steps: TransformStep[] = [
    {
      order: 1,
      type: "stripMarkupTags",
      enabled: true,
      params: { tagNames: ["wj", "add"] },
    },
  ];

  const result = applyTransformSteps("<wj>Jesus</wj> said <add>to</add>", steps);
  assert.equal(result, "Jesus said to");
});

test("applyTransformSteps applies stripParagraphMarkers", () => {
  const steps: TransformStep[] = [
    {
      order: 1,
      type: "stripParagraphMarkers",
      enabled: true,
      params: { markers: ["¶"] },
    },
  ];

  const result = applyTransformSteps("¶ The LORD is my shepherd", steps);
  assert.equal(result, " The LORD is my shepherd");
});

test("applyTransformSteps applies regexReplace", () => {
  const steps: TransformStep[] = [
    {
      order: 1,
      type: "regexReplace",
      enabled: true,
      params: { pattern: "\\d+", replacement: "#" },
    },
  ];

  const result = applyTransformSteps("Verse 123 text", steps);
  assert.equal(result, "Verse # text");
});

test("applyTransformSteps handles empty steps array", () => {
  const result = applyTransformSteps("unchanged", []);
  assert.equal(result, "unchanged");
});

// =============================================================================
// compareText tests
// =============================================================================

test("compareText returns 100 for identical text", () => {
  const result = compareText("In the beginning", "In the beginning");
  assert.equal(result.fidelityScore, 100);
  assert.equal(result.diff.substitutions, 0);
  assert.equal(result.diff.omissions, 0);
  assert.equal(result.diff.additions, 0);
});

test("compareText detects substitutions", () => {
  const result = compareText("abc", "axc");
  assert.ok(result.fidelityScore < 100);
  assert.equal(result.diff.substitutions, 1);
});

test("compareText detects additions", () => {
  const result = compareText("ab", "abc");
  assert.ok(result.fidelityScore < 100);
  assert.equal(result.diff.additions, 1);
});

test("compareText detects omissions", () => {
  const result = compareText("abc", "ab");
  assert.ok(result.fidelityScore < 100);
  assert.equal(result.diff.omissions, 1);
});

test("compareText handles empty strings", () => {
  const result = compareText("", "");
  assert.equal(result.fidelityScore, 100);
});

test("compareText handles one empty string", () => {
  const result = compareText("abc", "");
  assert.equal(result.fidelityScore, 0);
  assert.equal(result.diff.omissions, 3);
});

// =============================================================================
// applyTransformsAndScore tests
// =============================================================================

test("applyTransformsAndScore normalizes and scores", () => {
  const llmText = "  The LORD\u2019s   word  ";
  const canonicalText = "The LORD's word";
  const transforms: TransformStep[] = [
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: { map: { "\u2019": "'" } },
    },
    { order: 2, type: "collapseWhitespace", enabled: true, params: {} },
    { order: 3, type: "trim", enabled: true, params: {} },
  ];

  const result = applyTransformsAndScore(llmText, canonicalText, transforms);

  assert.equal(result.normalizedText, "The LORD's word");
  assert.equal(result.fidelityScore, 100);
});

test("applyTransformsAndScore handles non-matching text", () => {
  const llmText = "Different text";
  const canonicalText = "The LORD's word";
  const transforms: TransformStep[] = [];

  const result = applyTransformsAndScore(llmText, canonicalText, transforms);

  assert.equal(result.normalizedText, "Different text");
  assert.ok(result.fidelityScore < 100);
});

// =============================================================================
// isTransformEnabled tests
// =============================================================================

test("isTransformEnabled returns true for enabled step", () => {
  const step: TransformStep = { order: 1, type: "trim", enabled: true, params: {} };
  assert.equal(isTransformEnabled(step), true);
});

test("isTransformEnabled returns false for disabled step", () => {
  const step: TransformStep = { order: 1, type: "trim", enabled: false, params: {} };
  assert.equal(isTransformEnabled(step), false);
});

// =============================================================================
// createToggleableSteps tests
// =============================================================================

test("createToggleableSteps adds selected property", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "trim", enabled: true, params: {} },
    { order: 2, type: "collapseWhitespace", enabled: false, params: {} },
  ];

  const result = createToggleableSteps(steps);

  assert.equal(result.length, 2);
  assert.equal(result[0].selected, true);
  assert.equal(result[1].selected, false);
});

test("createToggleableSteps preserves original step properties", () => {
  const steps: TransformStep[] = [
    { order: 1, type: "trim", enabled: true, params: {}, severity: "cosmetic" },
  ];

  const result = createToggleableSteps(steps);

  assert.equal(result[0].order, 1);
  assert.equal(result[0].type, "trim");
  assert.equal(result[0].severity, "cosmetic");
});

// =============================================================================
// DEFAULT_COSMETIC_TRANSFORMS tests
// =============================================================================

test("DEFAULT_COSMETIC_TRANSFORMS is defined and has expected structure", () => {
  assert.ok(Array.isArray(DEFAULT_COSMETIC_TRANSFORMS));
  assert.ok(DEFAULT_COSMETIC_TRANSFORMS.length > 0);

  // First step should be replaceMap for Unicode normalization
  const firstStep = DEFAULT_COSMETIC_TRANSFORMS[0];
  assert.equal(firstStep.type, "replaceMap");
  assert.equal(firstStep.enabled, true);
  assert.equal(firstStep.severity, "cosmetic");
});

test("DEFAULT_COSMETIC_TRANSFORMS normalizes Unicode correctly", () => {
  const input = "The LORD\u2019s \u201Cword\u201D\u2014spoken";
  const result = applyTransformSteps(input, DEFAULT_COSMETIC_TRANSFORMS);
  assert.equal(result, 'The LORD\'s "word"-spoken');
});
