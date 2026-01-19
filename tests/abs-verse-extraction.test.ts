import assert from "node:assert/strict";
import test from "node:test";

import { extractAbsVerses } from "../src/lib/abs";
import { buildReference, parseVerseNumber } from "../src/lib/etl";

test("extractAbsVerses returns ordered verses with offsets", () => {
  const intro = "Intro ";
  const spacer = " ";
  const verse1Text = "In the beginning " + "God" + spacer;
  const verse2Text = "created.";

  const payload = {
    content: [
      { type: "text", text: intro },
      {
        attrs: { verseId: "Gen 1:1" },
        items: [
          { type: "text", text: "In the beginning " },
          { type: "text", text: "God" },
        ],
      },
      { type: "text", text: spacer },
      {
        attrs: { verseId: "Gen 1:2" },
        items: [{ type: "text", text: verse2Text }],
      },
    ],
  };

  const verses = extractAbsVerses(payload);
  assert.equal(verses.length, 2);
  assert.equal(verses[0]?.verseId, "Gen 1:1");
  assert.equal(verses[0]?.textRaw, verse1Text);
  assert.equal(verses[1]?.verseId, "Gen 1:2");
  assert.equal(verses[1]?.textRaw, verse2Text);

  const expectedStart1 = intro.length;
  const expectedEnd1 = expectedStart1 + verse1Text.length;
  const expectedStart2 = expectedEnd1;
  const expectedEnd2 = expectedStart2 + verse2Text.length;

  assert.equal(verses[0]?.startOffset, expectedStart1);
  assert.equal(verses[0]?.endOffset, expectedEnd1);
  assert.equal(verses[1]?.startOffset, expectedStart2);
  assert.equal(verses[1]?.endOffset, expectedEnd2);
});

test("extractAbsVerses preserves special markers", () => {
  const payload = {
    content: [
      {
        attrs: { verseId: "PSA 23:1" },
        items: [
          { type: "text", text: "¶ The LORD" },
          { type: "text", text: " is my shepherd" },
        ],
      },
    ],
  };

  const verses = extractAbsVerses(payload);
  assert.equal(verses.length, 1);
  assert.equal(verses[0]?.textRaw, "¶ The LORD is my shepherd");
});

test("parseVerseNumber handles missing numeric suffix", () => {
  assert.equal(parseVerseNumber("PSA 23:1"), 1);
  assert.equal(parseVerseNumber("PSA 23:a"), null);
});

test("buildReference uses fallback when reference is empty", () => {
  assert.equal(buildReference("GEN 1", 1, 1, 2), "GEN 1:2");
  assert.equal(buildReference("", 1, 1, 2), "1 1:2");
});
