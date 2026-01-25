/**
 * Smoke Test Script - Genesis 1
 *
 * Runs Genesis 1 (chapter 1) on 1-2 models to validate:
 * - Canonical verses have correct textProcessed (no curly quotes)
 * - Model output transforms apply correctly
 * - Hash matches occur for identical text
 *
 * Usage:
 *   npx tsx scripts/smoke-test-genesis1.ts
 *   npx tsx scripts/smoke-test-genesis1.ts --model-id 5   # Test specific model
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
import { startModelRun } from "../src/lib/model-runs";
import {
  CanonicalChapterModel,
  CanonicalVerseModel,
  LlmVerseResultModel,
  ModelModel,
} from "../src/lib/models";

const CAMPAIGN_TAG = "smoke-test";
const GENESIS_1_REFERENCE = "Genesis 1";
const DEFAULT_MODEL_IDS = [10]; // Gemini 2.5 Flash Lite by default (fast/cheap for testing)

function parseModelIdArg(): number[] {
  const idx = process.argv.indexOf("--model-id");
  if (idx !== -1 && process.argv[idx + 1]) {
    const modelId = Number(process.argv[idx + 1]);
    if (Number.isFinite(modelId)) {
      return [modelId];
    }
  }
  return DEFAULT_MODEL_IDS;
}

async function main() {
  console.log("=".repeat(80));
  console.log("SMOKE TEST - GENESIS 1");
  console.log("=".repeat(80));

  await connectToDatabase();

  // =========================================================================
  // Step 1: Verify canonical data exists
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log("STEP 1: VERIFY CANONICAL DATA");
  console.log("-".repeat(80));

  const chapter = await CanonicalChapterModel.findOne({
    reference: GENESIS_1_REFERENCE,
  }).lean();

  if (!chapter) {
    console.error(`\n  ERROR: "${GENESIS_1_REFERENCE}" not found in canonicalChapters!`);
    console.error("  Please run: npx tsx scripts/rerun-canonical-etl.ts --clear");
    await mongoose.disconnect();
    process.exit(1);
  }

  const CHAPTER_ID = chapter.chapterId;

  console.log(`\n  Chapter found: ${chapter.reference}`);
  console.log(`  textRaw length: ${chapter.textRaw.length} chars`);
  console.log(`  textProcessed length: ${chapter.textProcessed.length} chars`);

  const verses = await CanonicalVerseModel.find({
    chapterId: CHAPTER_ID,
  })
    .sort({ verseNumber: 1 })
    .lean();

  console.log(`  Canonical verses: ${verses.length}`);

  // Sample verification - check Genesis 1:1
  const genesis1_1 = verses.find((v) => v.verseNumber === 1);
  if (genesis1_1) {
    console.log("\n  Sample verse (Genesis 1:1):");
    console.log(`    textProcessed: "${genesis1_1.textProcessed}"`);
    console.log(`    hashProcessed: ${genesis1_1.hashProcessed}`);

    // Check for curly quotes (these should NOT be present after Unicode normalization)
    const hasCurlyQuotes = /[''""]/.test(genesis1_1.textProcessed);
    if (hasCurlyQuotes) {
      console.log("    ⚠️  WARNING: Curly quotes detected in canonical text!");
    } else {
      console.log("    ✓ No curly quotes in canonical text");
    }
  }

  // =========================================================================
  // Step 2: Get models to test
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log("STEP 2: SELECT MODELS");
  console.log("-".repeat(80));

  const modelIds = parseModelIdArg();
  const models = await ModelModel.find({
    modelId: { $in: modelIds },
    isActive: true,
  }).lean();

  if (models.length === 0) {
    console.error(`\n  ERROR: No active models found with IDs: ${modelIds.join(", ")}`);
    console.error("  Available models:");
    const allModels = await ModelModel.find({ isActive: true }, { modelId: 1, displayName: 1 }).lean();
    for (const m of allModels) {
      console.error(`    - [${m.modelId}] ${m.displayName}`);
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n  Testing ${models.length} model(s):`);
  for (const model of models) {
    console.log(`    - [${model.modelId}] ${model.displayName} (${model.provider})`);
  }

  // =========================================================================
  // Step 3: Run model chapter evaluation
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log("STEP 3: RUN MODEL EVALUATIONS");
  console.log("-".repeat(80));

  for (const model of models) {
    console.log(`\n  Running ${model.displayName}...`);
    const startTime = Date.now();

    const result = await startModelRun({
      campaignTag: CAMPAIGN_TAG,
      modelId: model.modelId,
      runType: "MODEL_CHAPTER",
      scope: "chapter",
      scopeIds: { chapterId: CHAPTER_ID },
    });

    const duration = Date.now() - startTime;

    if (!result.ok) {
      console.error(`    ✗ FAILED: ${result.error}`);
      continue;
    }

    console.log(`    Status: ${result.data.status}`);
    console.log(`    Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`    Metrics: ${result.data.metrics.success}/${result.data.metrics.total} succeeded`);

    if (result.data.metrics.failed > 0) {
      console.log(`    ⚠️  ${result.data.metrics.failed} items failed`);
    }
  }

  // =========================================================================
  // Step 4: Verify results
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log("STEP 4: VERIFY RESULTS");
  console.log("-".repeat(80));

  for (const model of models) {
    console.log(`\n  ${model.displayName} results:`);

    const results = await LlmVerseResultModel.find({
      campaignTag: CAMPAIGN_TAG,
      modelId: model.modelId,
      chapterId: CHAPTER_ID,
    })
      .sort({ verseId: 1 })
      .lean();

    if (results.length === 0) {
      console.log("    No results found.");
      continue;
    }

    const hashMatches = results.filter((r) => r.hashMatch).length;
    const avgFidelity = results.reduce((sum, r) => sum + r.fidelityScore, 0) / results.length;
    const perfectMatches = results.filter((r) => r.fidelityScore === 1.0).length;

    console.log(`    Total verses: ${results.length}`);
    console.log(`    Hash matches: ${hashMatches} (${((hashMatches / results.length) * 100).toFixed(1)}%)`);
    console.log(`    Perfect fidelity (1.0): ${perfectMatches} (${((perfectMatches / results.length) * 100).toFixed(1)}%)`);
    console.log(`    Average fidelity: ${(avgFidelity * 100).toFixed(2)}%`);

    // Sample verse check
    const verse1Result = results.find((r) => {
      const v = verses.find((cv) => cv.verseId === r.verseId);
      return v?.verseNumber === 1;
    });

    if (verse1Result) {
      const verse1Canonical = verses.find((v) => v.verseNumber === 1);
      console.log("\n    Genesis 1:1 comparison:");
      console.log(`      Canonical: "${verse1Canonical?.textProcessed}"`);
      console.log(`      Model:     "${verse1Result.responseProcessed}"`);
      console.log(`      Hash match: ${verse1Result.hashMatch ? "✓" : "✗"}`);
      console.log(`      Fidelity: ${(verse1Result.fidelityScore * 100).toFixed(2)}%`);

      if (!verse1Result.hashMatch && verse1Result.diff) {
        const diff = verse1Result.diff as Record<string, unknown>;
        if (diff.operations || diff.levenshtein) {
          console.log(`      Levenshtein distance: ${diff.levenshtein ?? "N/A"}`);
        }
      }
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("SMOKE TEST COMPLETE");
  console.log("=".repeat(80));

  await mongoose.disconnect();
  console.log("\n[Done] Disconnected from MongoDB.");
}

main().catch((error) => {
  console.error("[Fatal Error]", error);
  process.exit(1);
});
