/**
 * Re-run Canonical ETL Script
 *
 * Regenerates canonicalChapters and canonicalVerses using the updated
 * transform profiles. This is necessary after updating the KJV_CANONICAL_V1
 * profile to include Unicode normalization.
 *
 * Process:
 * 1. Optionally clears existing canonicalChapters and canonicalVerses
 * 2. Transforms all raw chapters using transformProfileId: 1
 * 3. Transforms all verses using transformProfileId: 1
 * 4. Reports counts and timing
 *
 * Usage:
 *   npx tsx scripts/rerun-canonical-etl.ts           # Transform (upsert mode)
 *   npx tsx scripts/rerun-canonical-etl.ts --clear   # Clear and re-transform all
 *   npx tsx scripts/rerun-canonical-etl.ts --dry-run # Show counts without changes
 */

import * as fs from "node:fs";
import * as path from "node:path";
import mongoose from "mongoose";

// Load .env.local file manually
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex !== -1) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

import { connectToDatabase } from "../src/lib/mongodb";
import { transformChapters, transformVerses } from "../src/lib/etl";
import {
  CanonicalChapterModel,
  CanonicalRawChapterModel,
  CanonicalVerseModel,
  TransformProfileModel,
} from "../src/lib/models";

const CANONICAL_PROFILE_ID = 1; // KJV_CANONICAL_V1

async function main() {
  const shouldClear = process.argv.includes("--clear");
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=".repeat(80));
  console.log("RE-RUN CANONICAL ETL");
  console.log("=".repeat(80));
  console.log(`\n  Mode: ${isDryRun ? "DRY RUN" : shouldClear ? "CLEAR AND REBUILD" : "UPSERT"}`);
  console.log(`  Transform Profile ID: ${CANONICAL_PROFILE_ID}`);

  await connectToDatabase();
  const startTime = Date.now();

  // Verify the transform profile exists
  const profile = await TransformProfileModel.findOne({
    profileId: CANONICAL_PROFILE_ID,
    isActive: true,
  }).lean();

  if (!profile) {
    console.error(`\n  ERROR: Transform profile ${CANONICAL_PROFILE_ID} not found or inactive!`);
    process.exit(1);
  }

  console.log(`\n  Transform Profile: ${profile.name} (v${profile.version})`);
  console.log(`  Steps: ${profile.steps.length}`);

  // Count source data
  const rawChapterCount = await CanonicalRawChapterModel.countDocuments();
  const existingChapterCount = await CanonicalChapterModel.countDocuments();
  const existingVerseCount = await CanonicalVerseModel.countDocuments();

  console.log("\n" + "-".repeat(80));
  console.log("CURRENT STATE");
  console.log("-".repeat(80));
  console.log(`  Raw chapters (source): ${rawChapterCount}`);
  console.log(`  Canonical chapters: ${existingChapterCount}`);
  console.log(`  Canonical verses: ${existingVerseCount}`);

  if (isDryRun) {
    console.log("\n" + "-".repeat(80));
    console.log("DRY RUN - No changes made");
    console.log("-".repeat(80));
    console.log(`  Would process ${rawChapterCount} chapters`);
    console.log(`  Would generate verses for all chapters`);
    await mongoose.disconnect();
    return;
  }

  // =========================================================================
  // Step 1: Optionally clear existing data
  // =========================================================================
  if (shouldClear) {
    console.log("\n" + "-".repeat(80));
    console.log("CLEARING EXISTING DATA");
    console.log("-".repeat(80));

    const chapterDeleteResult = await CanonicalChapterModel.deleteMany({});
    console.log(`  Deleted ${chapterDeleteResult.deletedCount} canonical chapters`);

    const verseDeleteResult = await CanonicalVerseModel.deleteMany({});
    console.log(`  Deleted ${verseDeleteResult.deletedCount} canonical verses`);
  }

  // =========================================================================
  // Step 2: Transform chapters
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log("TRANSFORMING CHAPTERS");
  console.log("-".repeat(80));

  const chapterStartTime = Date.now();
  const chapterResult = await transformChapters({
    transformProfileId: CANONICAL_PROFILE_ID,
    batchId: `rerun-canonical-etl-${Date.now()}`,
  });

  const chapterDuration = Date.now() - chapterStartTime;

  if (!chapterResult.ok) {
    console.error(`  ERROR: ${chapterResult.error}`);
    process.exit(1);
  }

  console.log(`  Processed: ${chapterResult.data.processed} chapters`);
  console.log(`  Duration: ${(chapterDuration / 1000).toFixed(2)}s`);
  console.log(`  Rate: ${(chapterResult.data.processed / (chapterDuration / 1000)).toFixed(1)} chapters/sec`);

  // =========================================================================
  // Step 3: Transform verses
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log("TRANSFORMING VERSES");
  console.log("-".repeat(80));

  const verseStartTime = Date.now();
  const verseResult = await transformVerses({
    transformProfileId: CANONICAL_PROFILE_ID,
    batchId: `rerun-canonical-etl-${Date.now()}`,
    forceAllVerses: shouldClear, // Force all if we cleared
  });

  const verseDuration = Date.now() - verseStartTime;

  if (!verseResult.ok) {
    console.error(`  ERROR: ${verseResult.error}`);
    process.exit(1);
  }

  console.log(`  Processed: ${verseResult.data.processed} verses`);
  console.log(`  Duration: ${(verseDuration / 1000).toFixed(2)}s`);
  console.log(`  Rate: ${(verseResult.data.processed / (verseDuration / 1000)).toFixed(1)} verses/sec`);

  // =========================================================================
  // Summary
  // =========================================================================
  const totalDuration = Date.now() - startTime;

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  // Get final counts
  const finalChapterCount = await CanonicalChapterModel.countDocuments();
  const finalVerseCount = await CanonicalVerseModel.countDocuments();

  console.log(`\n  Chapters: ${finalChapterCount}`);
  console.log(`  Verses: ${finalVerseCount}`);
  console.log(`  Total duration: ${(totalDuration / 1000).toFixed(2)}s`);

  // Sample verification - show first verse to verify transform
  const sampleVerse = await CanonicalVerseModel.findOne({
    verseNumber: 1,
    chapterNumber: 1,
    bookId: 1, // Genesis 1:1
  }).lean();

  if (sampleVerse) {
    console.log("\n" + "-".repeat(80));
    console.log("SAMPLE VERIFICATION - Genesis 1:1");
    console.log("-".repeat(80));
    console.log(`  Reference: ${sampleVerse.reference}`);
    console.log(`  textRaw (first 80 chars): ${sampleVerse.textRaw.slice(0, 80)}...`);
    console.log(`  textProcessed: ${sampleVerse.textProcessed}`);
    console.log(`  hashProcessed: ${sampleVerse.hashProcessed}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("ETL COMPLETE");
  console.log("=".repeat(80));

  await mongoose.disconnect();
  console.log("\n[Done] Disconnected from MongoDB.");
}

main().catch((error) => {
  console.error("[Fatal Error]", error);
  process.exit(1);
});
