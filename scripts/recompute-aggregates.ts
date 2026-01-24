import mongoose from "mongoose";

import { recomputeAllAggregatesBulk } from "../src/lib/aggregation";
import { applySchemaValidators } from "../src/lib/models";
import { connectToDatabase } from "../src/lib/mongodb";

/**
 * Recompute all aggregation collections from llmVerseResults.
 * This is a bulk operation that atomically replaces all aggregation data.
 *
 * Usage:
 *   pnpm tsx scripts/recompute-aggregates.ts
 *   pnpm tsx scripts/recompute-aggregates.ts --drop  # Drop and recreate collections first
 */
async function main() {
  const shouldDrop = process.argv.includes("--drop");

  console.log("[recompute-aggregates] Starting bulk aggregation...");

  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not initialized");
  }

  // Optionally drop old aggregation collections (they may have old schema with runId)
  if (shouldDrop) {
    console.log("[recompute-aggregates] Dropping old aggregation collections...");

    const collectionsToDrop = [
      "aggregationChapters",
      "aggregationBooks",
      "aggregationBibles",
    ];

    for (const name of collectionsToDrop) {
      try {
        await db.dropCollection(name);
        console.log(`  - Dropped: ${name}`);
      } catch (error) {
        // Collection may not exist
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("ns not found")) {
          console.warn(`  - Warning dropping ${name}: ${message}`);
        }
      }
    }

    // Apply new schema validators
    console.log("[recompute-aggregates] Applying schema validators...");
    const validatorResults = await applySchemaValidators();
    const aggResults = validatorResults.filter((r) =>
      r.name.startsWith("aggregation")
    );
    for (const result of aggResults) {
      console.log(
        `  - ${result.name}: ${result.action} ${result.ok ? "OK" : "FAILED"}`
      );
      if (!result.ok && result.error) {
        console.error(`    Error: ${result.error}`);
      }
    }
  }

  // Run bulk aggregation
  const result = await recomputeAllAggregatesBulk();

  console.log("[recompute-aggregates] Results:");
  console.log(`  - Chapters: ${result.chaptersProcessed}`);
  console.log(`  - Books: ${result.booksProcessed}`);
  console.log(`  - Bibles: ${result.biblesProcessed}`);

  if (result.errors.length > 0) {
    console.warn("[recompute-aggregates] Errors:");
    for (const error of result.errors) {
      console.warn(`  - ${error}`);
    }
  } else {
    console.log("[recompute-aggregates] Completed successfully.");
  }
}

main()
  .catch((error) => {
    console.error("[recompute-aggregates] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
