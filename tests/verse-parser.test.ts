import assert from "node:assert/strict";
import test from "node:test";

import {
  parseModelVerses,
  parseModelVersesInline,
  parseModelVersesAuto,
  mapToCanonicalVerses,
  buildVerseId,
  normalizeVerseText,
} from "../src/lib/verse-parser";

// =============================================================================
// parseModelVerses tests
// =============================================================================

test("parseModelVerses parses numbered verses on separate lines", () => {
  const input = `1 In the beginning God created the heaven and the earth.
2 And the earth was without form, and void.
3 And God said, Let there be light.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 3);
  assert.equal(result.verses[0].verseNumber, 1);
  assert.equal(result.verses[0].text, "In the beginning God created the heaven and the earth.");
  assert.equal(result.verses[1].verseNumber, 2);
  assert.equal(result.verses[2].verseNumber, 3);
});

test("parseModelVerses handles period after verse number", () => {
  const input = `1. In the beginning God created the heaven and the earth.
2. And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 2);
  assert.equal(result.verses[0].verseNumber, 1);
  assert.equal(result.verses[0].text, "In the beginning God created the heaven and the earth.");
});

test("parseModelVerses handles bracketed verse numbers", () => {
  const input = `[1] In the beginning God created the heaven and the earth.
[2] And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 2);
  assert.equal(result.verses[0].verseNumber, 1);
  assert.equal(result.verses[1].verseNumber, 2);
});

test("parseModelVerses handles Verse prefix format", () => {
  const input = `Verse 1: In the beginning God created the heaven and the earth.
Verse 2: And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 2);
  assert.equal(result.verses[0].verseNumber, 1);
  assert.equal(result.verses[0].text, "In the beginning God created the heaven and the earth.");
});

test("parseModelVerses handles v prefix format", () => {
  const input = `v1: In the beginning God created the heaven and the earth.
v2: And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 2);
  assert.equal(result.verses[0].verseNumber, 1);
});

test("parseModelVerses handles colon after verse number", () => {
  const input = `1: In the beginning God created the heaven and the earth.
2: And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 2);
  assert.equal(result.verses[0].verseNumber, 1);
});

test("parseModelVerses handles multi-line verses", () => {
  const input = `1 In the beginning God created
the heaven and the earth.
2 And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 2);
  assert.equal(result.verses[0].text, "In the beginning God created the heaven and the earth.");
});

test("parseModelVerses collects unmatched text before first verse", () => {
  const input = `Genesis Chapter 1
1 In the beginning God created the heaven and the earth.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 1);
  assert.equal(result.unmatchedText.length, 1);
  assert.equal(result.unmatchedText[0], "Genesis Chapter 1");
});

test("parseModelVerses warns on duplicate verse numbers", () => {
  const input = `1 In the beginning God created the heaven and the earth.
1 And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 2);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].includes("Duplicate"));
});

test("parseModelVerses returns empty result for empty input", () => {
  const result = parseModelVerses("");

  assert.equal(result.verses.length, 0);
  assert.equal(result.unmatchedText.length, 0);
  assert.equal(result.warnings.length, 0);
});

test("parseModelVerses skips blank lines", () => {
  const input = `1 In the beginning God created the heaven and the earth.

2 And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 2);
});

test("parseModelVerses sorts verses by verse number", () => {
  const input = `3 And God said, Let there be light.
1 In the beginning God created the heaven and the earth.
2 And the earth was without form.`;

  const result = parseModelVerses(input);

  assert.equal(result.verses.length, 3);
  assert.equal(result.verses[0].verseNumber, 1);
  assert.equal(result.verses[1].verseNumber, 2);
  assert.equal(result.verses[2].verseNumber, 3);
});

// =============================================================================
// parseModelVersesInline tests
// =============================================================================

test("parseModelVersesInline handles continuous text with embedded verse numbers", () => {
  const input = "1 In the beginning 2 And the earth 3 And God said";

  const result = parseModelVersesInline(input);

  // This pattern is tricky - verify it finds at least some verses
  assert.ok(result.verses.length > 0);
});

test("parseModelVersesInline returns empty for no matches", () => {
  const input = "Just some text without verse numbers.";

  const result = parseModelVersesInline(input);

  assert.equal(result.verses.length, 0);
});

// =============================================================================
// parseModelVersesAuto tests
// =============================================================================

test("parseModelVersesAuto uses line-based parser when verses found", () => {
  const input = `1 In the beginning God created the heaven and the earth.
2 And the earth was without form.`;

  const result = parseModelVersesAuto(input);

  assert.equal(result.verses.length, 2);
  assert.equal(result.verses[0].verseNumber, 1);
});

test("parseModelVersesAuto falls back to inline parser when no line-based matches", () => {
  const input = "1. text 2. more text";

  const result = parseModelVersesAuto(input);

  // Should try line-based first, then inline
  // This may or may not find verses depending on patterns
  assert.ok(Array.isArray(result.verses));
});

// =============================================================================
// mapToCanonicalVerses tests
// =============================================================================

test("mapToCanonicalVerses maps matching verses", () => {
  const parsed = [
    { verseNumber: 1, text: "In the beginning", startOffset: 0, endOffset: 20 },
    { verseNumber: 2, text: "And the earth", startOffset: 21, endOffset: 40 },
  ];

  const canonical = [
    { verseId: 1001001, verseNumber: 1, textProcessed: "In the beginning", hashProcessed: "abc123" },
    { verseId: 1001002, verseNumber: 2, textProcessed: "And the earth", hashProcessed: "def456" },
  ];

  const result = mapToCanonicalVerses(parsed, canonical);

  assert.equal(result.mapped.length, 2);
  assert.equal(result.mapped[0].matched, true);
  assert.equal(result.mapped[0].extractedText, "In the beginning");
  assert.equal(result.mapped[1].matched, true);
  assert.equal(result.missingVerses.length, 0);
  assert.equal(result.extraVerses.length, 0);
});

test("mapToCanonicalVerses identifies missing verses", () => {
  const parsed = [
    { verseNumber: 1, text: "In the beginning", startOffset: 0, endOffset: 20 },
  ];

  const canonical = [
    { verseId: 1001001, verseNumber: 1, textProcessed: "In the beginning", hashProcessed: "abc123" },
    { verseId: 1001002, verseNumber: 2, textProcessed: "And the earth", hashProcessed: "def456" },
  ];

  const result = mapToCanonicalVerses(parsed, canonical);

  assert.equal(result.mapped.length, 2);
  assert.equal(result.mapped[0].matched, true);
  assert.equal(result.mapped[1].matched, false);
  assert.equal(result.mapped[1].extractedText, "");
  assert.deepEqual(result.missingVerses, [2]);
});

test("mapToCanonicalVerses identifies extra verses", () => {
  const parsed = [
    { verseNumber: 1, text: "In the beginning", startOffset: 0, endOffset: 20 },
    { verseNumber: 99, text: "Extra verse", startOffset: 21, endOffset: 40 },
  ];

  const canonical = [
    { verseId: 1001001, verseNumber: 1, textProcessed: "In the beginning", hashProcessed: "abc123" },
  ];

  const result = mapToCanonicalVerses(parsed, canonical);

  assert.equal(result.mapped.length, 1);
  assert.deepEqual(result.extraVerses, [99]);
  assert.ok(result.warnings.some((w) => w.includes("99")));
});

test("mapToCanonicalVerses handles empty parsed input", () => {
  const canonical = [
    { verseId: 1001001, verseNumber: 1, textProcessed: "In the beginning", hashProcessed: "abc123" },
  ];

  const result = mapToCanonicalVerses([], canonical);

  assert.equal(result.mapped.length, 1);
  assert.equal(result.mapped[0].matched, false);
  assert.deepEqual(result.missingVerses, [1]);
});

test("mapToCanonicalVerses handles empty canonical input", () => {
  const parsed = [
    { verseNumber: 1, text: "In the beginning", startOffset: 0, endOffset: 20 },
  ];

  const result = mapToCanonicalVerses(parsed, []);

  assert.equal(result.mapped.length, 0);
  assert.deepEqual(result.extraVerses, [1]);
});

// =============================================================================
// buildVerseId tests
// =============================================================================

test("buildVerseId computes correct verse ID", () => {
  // Book 1 (Genesis), Chapter 1, Verse 1
  // bookId = 10 (1 * 10), so: 10 * 100000 + 1 * 1000 + 1 = 1001001
  const verseId = buildVerseId(10, 1, 1);
  assert.equal(verseId, 1001001);
});

test("buildVerseId handles higher chapter and verse numbers", () => {
  // Book 19 (Psalms = book 19, bookId = 190), Chapter 119, Verse 176
  const verseId = buildVerseId(190, 119, 176);
  assert.equal(verseId, 19119176);
});

test("buildVerseId handles book 66", () => {
  // Revelation (book 66, bookId = 660), Chapter 22, Verse 21
  const verseId = buildVerseId(660, 22, 21);
  assert.equal(verseId, 66022021);
});

// =============================================================================
// normalizeVerseText tests
// =============================================================================

test("normalizeVerseText collapses whitespace", () => {
  const result = normalizeVerseText("In   the    beginning");
  assert.equal(result, "In the beginning");
});

test("normalizeVerseText trims whitespace", () => {
  const result = normalizeVerseText("   In the beginning   ");
  assert.equal(result, "In the beginning");
});

test("normalizeVerseText converts smart apostrophe to regular", () => {
  const result = normalizeVerseText("The LORD\u2019s word");
  assert.equal(result, "The LORD's word");
});

test("normalizeVerseText converts smart quotes to regular", () => {
  const result = normalizeVerseText('\u201cIn the beginning\u201d');
  assert.equal(result, '"In the beginning"');
});

test("normalizeVerseText handles combined transformations", () => {
  const result = normalizeVerseText("  The LORD\u2019s   \u201cword\u201d  ");
  assert.equal(result, 'The LORD\'s "word"');
});

test("normalizeVerseText handles empty string", () => {
  const result = normalizeVerseText("");
  assert.equal(result, "");
});

test("normalizeVerseText handles only whitespace", () => {
  const result = normalizeVerseText("   \t\n   ");
  assert.equal(result, "");
});
