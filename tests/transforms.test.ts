import assert from "node:assert/strict";
import test from "node:test";

import { applyTransformProfile, type TransformProfile } from "../src/lib/transforms";

// Helper to create a minimal profile with given steps
function createProfile(
  steps: TransformProfile["steps"]
): TransformProfile {
  return {
    profileId: 1,
    name: "TEST_PROFILE",
    scope: "canonical",
    steps,
    isActive: true,
  };
}

// =============================================================================
// stripMarkupTags tests
// =============================================================================

test("stripMarkupTags removes specified HTML-like tags", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripMarkupTags",
      enabled: true,
      params: { tagNames: ["wj", "add"] },
    },
  ]);

  const input = '<wj>Jesus said</wj> to <add>the</add> disciples';
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "Jesus said to the disciples");
});

test("stripMarkupTags handles self-closing and attribute tags", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripMarkupTags",
      enabled: true,
      params: { tagNames: ["verse", "char"] },
    },
  ]);

  const input = '<verse number="1"/> In <char style="italic">the</char> beginning';
  const result = applyTransformProfile(input, profile);
  assert.equal(result, " In the beginning");
});

test("stripMarkupTags preserves text when no tags specified", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripMarkupTags",
      enabled: true,
      params: { tagNames: [] },
    },
  ]);

  const input = "<wj>Jesus said</wj>";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "<wj>Jesus said</wj>");
});

// =============================================================================
// stripParagraphMarkers tests
// =============================================================================

test("stripParagraphMarkers removes pilcrow markers", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripParagraphMarkers",
      enabled: true,
      params: { markers: ["¶"] },
    },
  ]);

  const input = "¶ The LORD is my shepherd";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, " The LORD is my shepherd");
});

test("stripParagraphMarkers removes multiple different markers", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripParagraphMarkers",
      enabled: true,
      params: { markers: ["¶", "§"] },
    },
  ]);

  const input = "¶ First paragraph § Second paragraph";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, " First paragraph  Second paragraph");
});

// =============================================================================
// stripVerseNumbers tests
// =============================================================================

test("stripVerseNumbers removes leading verse numbers", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripVerseNumbers",
      enabled: true,
      params: { patterns: ["^\\d+\\s*"] },
    },
  ]);

  const input = "1 In the beginning God created the heaven and the earth.";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning God created the heaven and the earth.");
});

test("stripVerseNumbers handles multiple patterns", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripVerseNumbers",
      enabled: true,
      params: { patterns: ["^\\d+\\s*", "\\[\\d+\\]"] },
    },
  ]);

  const input = "1 In the beginning [1] God created";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning  God created");
});

// =============================================================================
// stripHeadings tests
// =============================================================================

test("stripHeadings removes heading patterns from start of string", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripHeadings",
      enabled: true,
      params: { patterns: ["^#[^\\n]*"] },
    },
  ]);

  const input = "# Chapter Title\nIn the beginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "\nIn the beginning");
});

test("stripHeadings removes inline patterns", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripHeadings",
      enabled: true,
      params: { patterns: ["\\[CHAPTER\\]"] },
    },
  ]);

  const input = "[CHAPTER] In the beginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, " In the beginning");
});

// =============================================================================
// regexReplace tests
// =============================================================================

test("regexReplace applies regex pattern replacement", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "regexReplace",
      enabled: true,
      params: { pattern: "\\s+", replacement: " " },
    },
  ]);

  const input = "In   the    beginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning");
});

test("regexReplace handles invalid patterns gracefully", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "regexReplace",
      enabled: true,
      params: { pattern: "[invalid(", replacement: "" },
    },
  ]);

  const input = "In the beginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning"); // Should return unchanged
});

test("regexReplace handles null pattern", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "regexReplace",
      enabled: true,
      params: { pattern: null, replacement: "x" },
    },
  ]);

  const input = "In the beginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning");
});

// =============================================================================
// replaceMap tests (CRITICAL - Unicode normalization)
// =============================================================================

test("replaceMap normalizes curly single quotes to straight quotes", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: {
        map: {
          "\u2018": "'", // LEFT SINGLE QUOTATION MARK
          "\u2019": "'", // RIGHT SINGLE QUOTATION MARK
        },
      },
    },
  ]);

  const input = "The LORD\u2019s prayer"; // RIGHT SINGLE QUOTATION MARK
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "The LORD's prayer");
});

test("replaceMap normalizes curly double quotes to straight quotes", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: {
        map: {
          "\u201C": '"', // LEFT DOUBLE QUOTATION MARK
          "\u201D": '"', // RIGHT DOUBLE QUOTATION MARK
        },
      },
    },
  ]);

  const input = '\u201CIn the beginning\u201D said God';
  const result = applyTransformProfile(input, profile);
  assert.equal(result, '"In the beginning" said God');
});

test("replaceMap normalizes em-dash and en-dash to hyphen", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: {
        map: {
          "\u2014": "-", // EM DASH
          "\u2013": "-", // EN DASH
        },
      },
    },
  ]);

  const input = "God\u2014the Creator\u2013spoke";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "God-the Creator-spoke");
});

test("replaceMap applies full Unicode normalization map", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: {
        map: {
          "\u2018": "'",
          "\u2019": "'",
          "\u201C": '"',
          "\u201D": '"',
          "\u2014": "-",
          "\u2013": "-",
        },
      },
    },
  ]);

  const input = '\u201CThe LORD\u2019s\u201D word\u2014spoken\u2013aloud';
  const result = applyTransformProfile(input, profile);
  assert.equal(result, '"The LORD\'s" word-spoken-aloud');
});

test("replaceMap handles empty map", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: { map: {} },
    },
  ]);

  const input = "In the beginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning");
});

test("replaceMap handles invalid map value", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: { map: "not-an-object" },
    },
  ]);

  const input = "In the beginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning");
});

// =============================================================================
// collapseWhitespace tests
// =============================================================================

test("collapseWhitespace reduces multiple spaces to single", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
  ]);

  const input = "In   the    beginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning");
});

test("collapseWhitespace handles tabs and newlines", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
  ]);

  const input = "In\t\tthe\n\nbeginning";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning");
});

// =============================================================================
// trim tests
// =============================================================================

test("trim removes leading and trailing whitespace", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "trim",
      enabled: true,
      params: {},
    },
  ]);

  const input = "   In the beginning   ";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning");
});

test("trim handles tabs and newlines at edges", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "trim",
      enabled: true,
      params: {},
    },
  ]);

  const input = "\t\nIn the beginning\n\t";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning");
});

// =============================================================================
// Disabled steps tests
// =============================================================================

test("disabled steps are skipped", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "replaceMap",
      enabled: false,
      params: { map: { a: "x" } },
    },
  ]);

  const input = "abcabc";
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "abcabc"); // Should not replace
});

// =============================================================================
// Step ordering tests
// =============================================================================

test("steps are applied in order", () => {
  const profile = createProfile([
    {
      order: 2,
      type: "trim",
      enabled: true,
      params: {},
    },
    {
      order: 1,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
  ]);

  const input = "   In   the   beginning   ";
  const result = applyTransformProfile(input, profile);
  // collapseWhitespace first: " In the beginning "
  // trim second: "In the beginning"
  assert.equal(result, "In the beginning");
});

// =============================================================================
// Full KJV_CANONICAL_V1 profile simulation
// =============================================================================

test("full canonical profile processes verse correctly", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripMarkupTags",
      enabled: true,
      params: { tagNames: ["wj", "add", "verse-span", "para", "char", "verse", "chapter"] },
    },
    {
      order: 2,
      type: "stripParagraphMarkers",
      enabled: true,
      params: { markers: ["¶"] },
    },
    {
      order: 3,
      type: "stripVerseNumbers",
      enabled: true,
      params: { patterns: ["^\\s*\\d+\\s+"] }, // Pattern that handles leading whitespace
    },
    {
      order: 4,
      type: "replaceMap",
      enabled: true,
      params: {
        map: {
          "\u2018": "'",
          "\u2019": "'",
          "\u201C": '"',
          "\u201D": '"',
          "\u2014": "-",
          "\u2013": "-",
        },
      },
    },
    {
      order: 5,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
    {
      order: 6,
      type: "trim",
      enabled: true,
      params: {},
    },
  ]);

  // Test with verse number at start (after paragraph marker is stripped)
  const input = '¶ 1 <verse number="1"/>In the beginning God created the <add>heaven</add> and the earth.';
  const result = applyTransformProfile(input, profile);
  assert.equal(result, "In the beginning God created the heaven and the earth.");
});

test("canonical profile handles verse with leading space", () => {
  const profile = createProfile([
    {
      order: 1,
      type: "stripParagraphMarkers",
      enabled: true,
      params: { markers: ["¶"] },
    },
    {
      order: 2,
      type: "stripVerseNumbers",
      enabled: true,
      params: { patterns: ["^\\d+\\s*"] },
    },
    {
      order: 3,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
    {
      order: 4,
      type: "trim",
      enabled: true,
      params: {},
    },
  ]);

  // When paragraph marker is stripped, it leaves a space before the verse number
  // The verse number pattern ^\\d+ won't match because it starts with space
  // After collapseWhitespace and trim, the verse number remains
  const input = "¶ 1 In the beginning";
  const result = applyTransformProfile(input, profile);
  // The pattern ^\\d+\\s* only matches at very start, so "1 " won't be stripped
  // Result is " 1 In the beginning" -> "1 In the beginning" after collapse+trim
  assert.equal(result, "1 In the beginning");
});

test("canonical and model output produce matching text for identical content", () => {
  // Canonical profile
  const canonicalProfile = createProfile([
    {
      order: 1,
      type: "stripMarkupTags",
      enabled: true,
      params: { tagNames: ["wj", "add"] },
    },
    {
      order: 2,
      type: "replaceMap",
      enabled: true,
      params: {
        map: {
          "\u2018": "'",
          "\u2019": "'",
          "\u201C": '"',
          "\u201D": '"',
        },
      },
    },
    {
      order: 3,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
    {
      order: 4,
      type: "trim",
      enabled: true,
      params: {},
    },
  ]);

  // Model output profile
  const modelProfile = createProfile([
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      params: {
        map: {
          "\u2018": "'",
          "\u2019": "'",
          "\u201C": '"',
          "\u201D": '"',
        },
      },
    },
    {
      order: 2,
      type: "collapseWhitespace",
      enabled: true,
      params: {},
    },
    {
      order: 3,
      type: "trim",
      enabled: true,
      params: {},
    },
  ]);

  // Canonical source with markup and straight quotes
  const canonicalInput = "  <wj>The LORD's</wj> word  ";
  // Model output with curly quotes
  const modelInput = "  The LORD\u2019s word  ";

  const canonicalResult = applyTransformProfile(canonicalInput, canonicalProfile);
  const modelResult = applyTransformProfile(modelInput, modelProfile);

  assert.equal(canonicalResult, "The LORD's word");
  assert.equal(modelResult, "The LORD's word");
  assert.equal(canonicalResult, modelResult); // Hash should match!
});
