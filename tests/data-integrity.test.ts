/**
 * Data Integrity Test Harness
 *
 * Validates cross-collection relationships and data consistency:
 * - Foreign key relationships
 * - Unique constraints
 * - Data ranges and values
 * - Referential integrity
 *
 * Usage:
 *   pnpm test:db
 *
 * Environment:
 *   Uses .env.local via Node's --env-file flag
 */

import assert from "node:assert";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DBNAME = process.env.MONGODB_DBNAME ?? "bible-bench";

const OUTPUT_DIR = path.join(process.cwd(), "tests", "samples");

type IntegrityCheck = {
  name: string;
  status: "pass" | "fail" | "skip";
  message: string;
  details?: unknown;
};

describe("Data Integrity", () => {
  let db: mongoose.mongo.Db;
  const checks: IntegrityCheck[] = [];

  before(async () => {
    assert.ok(MONGODB_URI, "MONGODB_URI must be set in .env.local");
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DBNAME });
    db = mongoose.connection.db!;

    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  after(async () => {
    // Write integrity report
    const report = {
      timestamp: new Date().toISOString(),
      totalChecks: checks.length,
      passed: checks.filter((c) => c.status === "pass").length,
      failed: checks.filter((c) => c.status === "fail").length,
      skipped: checks.filter((c) => c.status === "skip").length,
      checks,
    };
    writeFileSync(
      path.join(OUTPUT_DIR, "_integrity_report.json"),
      JSON.stringify(report, null, 2)
    );

    console.log("\n🔗 Integrity Check Summary:");
    for (const check of checks) {
      const icon = check.status === "pass" ? "✅" : check.status === "fail" ? "❌" : "⚠️";
      console.log(`  ${icon} ${check.name}: ${check.message}`);
    }

    await mongoose.disconnect();
  });

  describe("Document Counts", () => {
    it("should have expected collection counts", async () => {
      const collections = [
        "dimLanguages",
        "dimBibles",
        "dimBooks",
        "rawChapters",
        "chapters",
        "verses",
        "transformProfiles",
      ];

      const counts: Record<string, number> = {};
      for (const name of collections) {
        counts[name] = await db.collection(name).countDocuments();
      }

      checks.push({
        name: "Document Counts",
        status: "pass",
        message: `dimBooks=${counts.dimBooks}, rawChapters=${counts.rawChapters}, chapters=${counts.chapters}, verses=${counts.verses}`,
        details: counts,
      });

      // Basic sanity checks
      assert.ok(counts.dimLanguages >= 1, "Should have at least 1 language");
      assert.ok(counts.dimBibles >= 1, "Should have at least 1 bible");
      assert.ok(counts.dimBooks >= 66, "Should have at least 66 books (KJV)");
    });
  });

  describe("Foreign Key Relationships", () => {
    it("should have valid languageId references in dimBibles", async () => {
      const bibles = await db.collection("dimBibles").find({}).toArray();
      const languageIds = new Set(
        (await db.collection("dimLanguages").find({}).toArray()).map((l) => l.languageId)
      );

      const orphans = bibles.filter((b) => !languageIds.has(b.languageId));

      checks.push({
        name: "Bible → Language FK",
        status: orphans.length === 0 ? "pass" : "fail",
        message: orphans.length === 0 ? "All bibles have valid languageId" : `${orphans.length} orphaned bibles`,
        details: orphans.length > 0 ? orphans.map((b) => b.bibleId) : undefined,
      });

      assert.strictEqual(orphans.length, 0, "All bibles should reference valid languages");
    });

    it("should have valid bibleId references in dimBooks", async () => {
      const books = await db.collection("dimBooks").find({}).toArray();
      const bibleIds = new Set(
        (await db.collection("dimBibles").find({}).toArray()).map((b) => b.bibleId)
      );

      const orphans = books.filter((b) => !bibleIds.has(b.bibleId));

      checks.push({
        name: "Book → Bible FK",
        status: orphans.length === 0 ? "pass" : "fail",
        message: orphans.length === 0 ? "All books have valid bibleId" : `${orphans.length} orphaned books`,
      });

      assert.strictEqual(orphans.length, 0, "All books should reference valid bibles");
    });

    it("should have valid bookId references in rawChapters", async () => {
      const rawChapters = await db.collection("rawChapters").find({}).limit(1000).toArray();
      const bookIds = new Set(
        (await db.collection("dimBooks").find({}).toArray()).map((b) => b.bookId)
      );

      const orphans = rawChapters.filter((c) => !bookIds.has(c.bookId));

      checks.push({
        name: "RawChapter → Book FK",
        status: orphans.length === 0 ? "pass" : "fail",
        message: orphans.length === 0 ? "All raw chapters have valid bookId" : `${orphans.length} orphaned chapters`,
      });

      assert.strictEqual(orphans.length, 0, "All raw chapters should reference valid books");
    });

    it("should have valid rawChapterId references in chapters", async () => {
      const chapters = await db.collection("chapters").find({}).limit(1000).toArray();
      const rawChapterIds = new Set(
        (await db.collection("rawChapters").find({}).toArray()).map((c) => c.rawChapterId)
      );

      const orphans = chapters.filter((c) => !rawChapterIds.has(c.rawChapterId));

      checks.push({
        name: "Chapter → RawChapter FK",
        status: orphans.length === 0 ? "pass" : "fail",
        message: orphans.length === 0 ? "All chapters have valid rawChapterId" : `${orphans.length} orphaned chapters`,
      });

      assert.strictEqual(orphans.length, 0, "All chapters should reference valid raw chapters");
    });

    it("should have valid chapterId references in verses", async () => {
      const verses = await db.collection("verses").find({}).limit(5000).toArray();
      const chapterIds = new Set(
        (await db.collection("chapters").find({}).toArray()).map((c) => c.chapterId)
      );

      const orphans = verses.filter((v) => !chapterIds.has(v.chapterId));

      checks.push({
        name: "Verse → Chapter FK",
        status: orphans.length === 0 ? "pass" : "fail",
        message: orphans.length === 0 ? "All verses have valid chapterId" : `${orphans.length} orphaned verses`,
      });

      assert.strictEqual(orphans.length, 0, "All verses should reference valid chapters");
    });
  });

  describe("Unique Constraints", () => {
    it("should have unique languageId values", async () => {
      const languages = await db.collection("dimLanguages").find({}).toArray();
      const ids = languages.map((l) => l.languageId);
      const uniqueIds = new Set(ids);

      checks.push({
        name: "Unique languageId",
        status: ids.length === uniqueIds.size ? "pass" : "fail",
        message: ids.length === uniqueIds.size ? "All languageIds are unique" : `${ids.length - uniqueIds.size} duplicates`,
      });

      assert.strictEqual(ids.length, uniqueIds.size, "languageId should be unique");
    });

    it("should have unique bookId values", async () => {
      const books = await db.collection("dimBooks").find({}).toArray();
      const ids = books.map((b) => b.bookId);
      const uniqueIds = new Set(ids);

      checks.push({
        name: "Unique bookId",
        status: ids.length === uniqueIds.size ? "pass" : "fail",
        message: ids.length === uniqueIds.size ? "All bookIds are unique" : `${ids.length - uniqueIds.size} duplicates`,
      });

      assert.strictEqual(ids.length, uniqueIds.size, "bookId should be unique");
    });

    it("should have unique chapterId values", async () => {
      const chapters = await db.collection("chapters").find({}).toArray();
      const ids = chapters.map((c) => c.chapterId);
      const uniqueIds = new Set(ids);

      checks.push({
        name: "Unique chapterId",
        status: ids.length === uniqueIds.size ? "pass" : "fail",
        message: ids.length === uniqueIds.size ? "All chapterIds are unique" : `${ids.length - uniqueIds.size} duplicates`,
      });

      assert.strictEqual(ids.length, uniqueIds.size, "chapterId should be unique");
    });

    it("should have unique verseId values", async () => {
      const verses = await db.collection("verses").find({}).toArray();
      const ids = verses.map((v) => v.verseId);
      const uniqueIds = new Set(ids);

      checks.push({
        name: "Unique verseId",
        status: ids.length === uniqueIds.size ? "pass" : "fail",
        message: ids.length === uniqueIds.size ? "All verseIds are unique" : `${ids.length - uniqueIds.size} duplicates`,
      });

      assert.strictEqual(ids.length, uniqueIds.size, "verseId should be unique");
    });
  });

  describe("Data Value Validation", () => {
    it("should have valid book indices (1-66 for KJV)", async () => {
      const books = await db.collection("dimBooks").find({}).toArray();
      const invalidBooks = books.filter((b) => b.bookIndex < 1 || b.bookIndex > 66);

      checks.push({
        name: "Book Index Range",
        status: invalidBooks.length === 0 ? "pass" : "fail",
        message: invalidBooks.length === 0 ? "All book indices in valid range" : `${invalidBooks.length} invalid`,
      });

      assert.strictEqual(invalidBooks.length, 0, "All book indices should be 1-66");
    });

    it("should have valid chapter numbers", async () => {
      const chapters = await db.collection("chapters").find({}).limit(1000).toArray();
      const invalidChapters = chapters.filter((c) => c.chapterNumber < 1 || c.chapterNumber > 150);

      checks.push({
        name: "Chapter Number Range",
        status: invalidChapters.length === 0 ? "pass" : "fail",
        message: invalidChapters.length === 0 ? "All chapter numbers in valid range" : `${invalidChapters.length} invalid`,
      });

      assert.strictEqual(invalidChapters.length, 0, "All chapter numbers should be 1-150");
    });

    it("should have valid verse numbers", async () => {
      const verses = await db.collection("verses").find({}).limit(5000).toArray();
      const invalidVerses = verses.filter((v) => v.verseNumber < 1 || v.verseNumber > 200);

      checks.push({
        name: "Verse Number Range",
        status: invalidVerses.length === 0 ? "pass" : "fail",
        message: invalidVerses.length === 0 ? "All verse numbers in valid range" : `${invalidVerses.length} invalid`,
      });

      assert.strictEqual(invalidVerses.length, 0, "All verse numbers should be 1-200");
    });

    it("should have non-empty text in chapters", async () => {
      const chapters = await db.collection("chapters").find({}).limit(1000).toArray();
      const emptyChapters = chapters.filter(
        (c) => !c.textRaw || c.textRaw.trim().length === 0 || !c.textProcessed || c.textProcessed.trim().length === 0
      );

      checks.push({
        name: "Chapter Text Content",
        status: emptyChapters.length === 0 ? "pass" : "fail",
        message: emptyChapters.length === 0 ? "All chapters have text content" : `${emptyChapters.length} empty`,
      });

      assert.strictEqual(emptyChapters.length, 0, "All chapters should have text content");
    });

    it("should have non-empty text in verses", async () => {
      const verses = await db.collection("verses").find({}).limit(5000).toArray();
      const emptyVerses = verses.filter(
        (v) => !v.textRaw || v.textRaw.trim().length === 0 || !v.textProcessed || v.textProcessed.trim().length === 0
      );

      checks.push({
        name: "Verse Text Content",
        status: emptyVerses.length === 0 ? "pass" : "fail",
        message: emptyVerses.length === 0 ? "All verses have text content" : `${emptyVerses.length} empty`,
      });

      assert.strictEqual(emptyVerses.length, 0, "All verses should have text content");
    });

    it("should have valid hashes (64 char hex)", async () => {
      const chapters = await db.collection("chapters").find({}).limit(100).toArray();
      const hashPattern = /^[a-f0-9]{64}$/;
      const invalidHashes = chapters.filter(
        (c) => !hashPattern.test(c.hashRaw) || !hashPattern.test(c.hashProcessed)
      );

      checks.push({
        name: "Hash Format",
        status: invalidHashes.length === 0 ? "pass" : "fail",
        message: invalidHashes.length === 0 ? "All hashes are valid SHA-256" : `${invalidHashes.length} invalid hashes`,
      });

      assert.strictEqual(invalidHashes.length, 0, "All hashes should be 64-char hex (SHA-256)");
    });
  });

  describe("Reference Format Validation", () => {
    it("should have valid reference format in chapters", async () => {
      const chapters = await db.collection("chapters").find({}).limit(100).toArray();
      // Reference format: "Book Chapter" e.g., "Genesis 1", "1 John 3"
      const refPattern = /^[\w\s]+\s+\d+$/;
      const invalidRefs = chapters.filter((c) => !refPattern.test(c.reference));

      checks.push({
        name: "Chapter Reference Format",
        status: invalidRefs.length === 0 ? "pass" : "fail",
        message: invalidRefs.length === 0 ? "All chapter references valid" : `${invalidRefs.length} invalid`,
        details: invalidRefs.length > 0 ? invalidRefs.slice(0, 5).map((c) => c.reference) : undefined,
      });

      assert.strictEqual(invalidRefs.length, 0, "All chapter references should match expected format");
    });

    it("should have valid reference format in verses", async () => {
      const verses = await db.collection("verses").find({}).limit(500).toArray();
      // Reference format: "Book Chapter:Verse" e.g., "Genesis 1:1", "1 John 3:16"
      const refPattern = /^[\w\s]+\s+\d+:\d+$/;
      const invalidRefs = verses.filter((v) => !refPattern.test(v.reference));

      checks.push({
        name: "Verse Reference Format",
        status: invalidRefs.length === 0 ? "pass" : "fail",
        message: invalidRefs.length === 0 ? "All verse references valid" : `${invalidRefs.length} invalid`,
        details: invalidRefs.length > 0 ? invalidRefs.slice(0, 5).map((v) => v.reference) : undefined,
      });

      assert.strictEqual(invalidRefs.length, 0, "All verse references should match expected format");
    });
  });

  describe("Count Consistency", () => {
    it("should have matching rawChapter and chapter counts", async () => {
      const rawCount = await db.collection("rawChapters").countDocuments();
      const chapterCount = await db.collection("chapters").countDocuments();

      checks.push({
        name: "Raw ↔ Chapter Count",
        status: rawCount === chapterCount ? "pass" : "fail",
        message: rawCount === chapterCount ? `Both have ${rawCount} documents` : `Raw: ${rawCount}, Chapters: ${chapterCount}`,
      });

      assert.strictEqual(rawCount, chapterCount, "rawChapters and chapters should have same count");
    });

    it("should have 66 books for KJV", async () => {
      const bookCount = await db.collection("dimBooks").countDocuments({ bibleId: 1001 });

      checks.push({
        name: "KJV Book Count",
        status: bookCount === 66 ? "pass" : "fail",
        message: bookCount === 66 ? "66 books present" : `${bookCount} books (expected 66)`,
      });

      assert.strictEqual(bookCount, 66, "KJV should have exactly 66 books");
    });

    it("should have 1189 chapters for KJV", async () => {
      const chapterCount = await db.collection("chapters").countDocuments({ bibleId: 1001 });

      checks.push({
        name: "KJV Chapter Count",
        status: chapterCount === 1189 ? "pass" : "fail",
        message: chapterCount === 1189 ? "1189 chapters present" : `${chapterCount} chapters (expected 1189)`,
      });

      assert.strictEqual(chapterCount, 1189, "KJV should have exactly 1189 chapters");
    });

    it("should have approximately 31102 verses for KJV", async () => {
      const verseCount = await db.collection("verses").countDocuments({ bibleId: 1001 });
      // KJV has 31,102 verses but some sources differ slightly
      const isClose = verseCount >= 31000 && verseCount <= 31200;

      checks.push({
        name: "KJV Verse Count",
        status: isClose ? "pass" : "fail",
        message: isClose ? `${verseCount} verses (within expected range)` : `${verseCount} verses (expected ~31102)`,
      });

      assert.ok(isClose, `KJV should have approximately 31102 verses, got ${verseCount}`);
    });
  });
});
