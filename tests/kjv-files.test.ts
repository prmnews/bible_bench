import assert from "node:assert/strict";
import test from "node:test";

import { parseKjvFilename } from "../src/lib/kjv-files";

// =============================================================================
// Valid filename tests
// =============================================================================

test("parseKjvFilename parses Genesis chapter 1", () => {
  const result = parseKjvFilename("01-Genesis-GEN.1.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 1);
  assert.equal(result.bookName, "Genesis");
  assert.equal(result.bookCode, "GEN");
  assert.equal(result.chapterNumber, 1);
  assert.equal(result.bookId, 10);
  assert.equal(result.rawChapterId, 1001);
  assert.equal(result.reference, "Genesis 1");
});

test("parseKjvFilename parses Genesis chapter 50", () => {
  const result = parseKjvFilename("01-Genesis-GEN.50.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 1);
  assert.equal(result.chapterNumber, 50);
  assert.equal(result.rawChapterId, 1050);
});

test("parseKjvFilename parses Exodus", () => {
  const result = parseKjvFilename("02-Exodus-EXO.16.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 2);
  assert.equal(result.bookName, "Exodus");
  assert.equal(result.bookCode, "EXO");
  assert.equal(result.chapterNumber, 16);
  assert.equal(result.bookId, 20);
  assert.equal(result.rawChapterId, 2016);
});

test("parseKjvFilename parses Psalms", () => {
  const result = parseKjvFilename("19-Psalms-PSA.119.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 19);
  assert.equal(result.bookName, "Psalms");
  assert.equal(result.bookCode, "PSA");
  assert.equal(result.chapterNumber, 119);
  assert.equal(result.bookId, 190);
  assert.equal(result.rawChapterId, 19119);
});

test("parseKjvFilename parses book with space in name (1 Samuel)", () => {
  const result = parseKjvFilename("09-1 Samuel-1SA.20.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 9);
  assert.equal(result.bookName, "1 Samuel");
  assert.equal(result.bookCode, "1SA");
  assert.equal(result.chapterNumber, 20);
});

test("parseKjvFilename parses 2 Kings", () => {
  const result = parseKjvFilename("12-2 Kings-2KI.20.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 12);
  assert.equal(result.bookName, "2 Kings");
  assert.equal(result.bookCode, "2KI");
  assert.equal(result.chapterNumber, 20);
});

test("parseKjvFilename parses 1 Chronicles", () => {
  const result = parseKjvFilename("13-1 Chronicles-1CH.15.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 13);
  assert.equal(result.bookName, "1 Chronicles");
  assert.equal(result.bookCode, "1CH");
});

test("parseKjvFilename parses Song of Solomon", () => {
  const result = parseKjvFilename("22-Song of Solomon-SNG.8.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 22);
  assert.equal(result.bookName, "Song of Solomon");
  assert.equal(result.bookCode, "SNG");
  assert.equal(result.chapterNumber, 8);
});

test("parseKjvFilename parses Revelation", () => {
  const result = parseKjvFilename("66-Revelation-REV.22.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 66);
  assert.equal(result.bookName, "Revelation");
  assert.equal(result.bookCode, "REV");
  assert.equal(result.chapterNumber, 22);
  assert.equal(result.bookId, 660);
});

test("parseKjvFilename parses 2 John (single chapter book)", () => {
  const result = parseKjvFilename("63-2 John-2JN.1.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 63);
  assert.equal(result.bookName, "2 John");
  assert.equal(result.bookCode, "2JN");
  assert.equal(result.chapterNumber, 1);
});

test("parseKjvFilename parses Philemon", () => {
  const result = parseKjvFilename("57-Philemon-PHM.1.json");

  assert.ok(result);
  assert.equal(result.bookNumber, 57);
  assert.equal(result.bookName, "Philemon");
  assert.equal(result.bookCode, "PHM");
  assert.equal(result.chapterNumber, 1);
});

// =============================================================================
// Invalid filename tests
// =============================================================================

test("parseKjvFilename returns null for non-json file", () => {
  const result = parseKjvFilename("01-Genesis-GEN.1.txt");
  assert.equal(result, null);
});

test("parseKjvFilename returns null for missing book number", () => {
  const result = parseKjvFilename("Genesis-GEN.1.json");
  assert.equal(result, null);
});

test("parseKjvFilename returns null for missing chapter number", () => {
  const result = parseKjvFilename("01-Genesis-GEN.json");
  assert.equal(result, null);
});

test("parseKjvFilename returns null for invalid format", () => {
  const result = parseKjvFilename("random-filename.json");
  assert.equal(result, null);
});

test("parseKjvFilename returns null for empty string", () => {
  const result = parseKjvFilename("");
  assert.equal(result, null);
});

test("parseKjvFilename returns null for directory path", () => {
  const result = parseKjvFilename("bibles/kjv-english/");
  assert.equal(result, null);
});

test("parseKjvFilename returns null for lowercase book code", () => {
  // Book code must be uppercase per the regex
  const result = parseKjvFilename("01-Genesis-gen.1.json");
  assert.equal(result, null);
});

// =============================================================================
// Edge cases
// =============================================================================

test("parseKjvFilename computes correct rawChapterId for chapter 1", () => {
  const result = parseKjvFilename("01-Genesis-GEN.1.json");
  assert.ok(result);
  // bookId = 10, rawChapterId = 10 * 100 + 1 = 1001
  assert.equal(result.rawChapterId, 1001);
});

test("parseKjvFilename computes correct rawChapterId for multi-digit chapter", () => {
  const result = parseKjvFilename("19-Psalms-PSA.150.json");
  assert.ok(result);
  // bookId = 190, rawChapterId = 190 * 100 + 150 = 19150
  assert.equal(result.rawChapterId, 19150);
});

test("parseKjvFilename builds correct reference string", () => {
  const result = parseKjvFilename("40-Matthew-MAT.28.json");
  assert.ok(result);
  assert.equal(result.reference, "Matthew 28");
});
