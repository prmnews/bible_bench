/**
 * Setup Model Profile Map Script
 *
 * Creates modelProfileMap entries for all models in the database,
 * mapping them to the MODEL_OUTPUT_V1 transform profile (profileId: 2).
 *
 * This ensures all model outputs are normalized using the same transform
 * profile for consistent comparison against canonical text.
 *
 * Usage:
 *   npx tsx scripts/setup-model-profile-map.ts           # Create mappings
 *   npx tsx scripts/setup-model-profile-map.ts --dry-run # Preview without changes
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
import {
  ModelModel,
  ModelProfileMapModel,
  TransformProfileModel,
} from "../src/lib/models";

const MODEL_OUTPUT_PROFILE_ID = 2; // MODEL_OUTPUT_V1

type MappingResult = {
  modelId: number;
  displayName: string;
  action: "created" | "updated" | "skipped";
  previousProfileId?: number;
};

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=".repeat(80));
  console.log("SETUP MODEL PROFILE MAP");
  console.log("=".repeat(80));
  console.log(`\n  Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}`);
  console.log(`  Target Profile ID: ${MODEL_OUTPUT_PROFILE_ID}`);

  await connectToDatabase();

  // Verify the transform profile exists
  const profile = await TransformProfileModel.findOne({
    profileId: MODEL_OUTPUT_PROFILE_ID,
    isActive: true,
  }).lean();

  if (!profile) {
    console.error(`\n  ERROR: Transform profile ${MODEL_OUTPUT_PROFILE_ID} not found or inactive!`);
    console.error("  Please run 'npx tsx scripts/update-transform-profiles.ts' first.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n  Profile: ${profile.name} (v${profile.version})`);
  console.log(`  Steps: ${profile.steps.length}`);

  // Get all models
  const models = await ModelModel.find({}).sort({ modelId: 1 }).lean();

  if (models.length === 0) {
    console.log("\n  No models found in database.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\n  Found ${models.length} models to map.`);

  // Get existing mappings
  const existingMappings = await ModelProfileMapModel.find({}).lean();
  const mappingByModelId = new Map(
    existingMappings.map((m) => [m.modelId, m.modelProfileId])
  );

  console.log(`  Existing mappings: ${existingMappings.length}`);

  // =========================================================================
  // Create/Update mappings
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log(isDryRun ? "DRY RUN - Would create/update mappings:" : "CREATING/UPDATING MAPPINGS");
  console.log("-".repeat(80));

  const results: MappingResult[] = [];
  const now = new Date();

  for (const model of models) {
    const existingProfileId = mappingByModelId.get(model.modelId);

    if (existingProfileId === MODEL_OUTPUT_PROFILE_ID) {
      // Already mapped to the correct profile
      results.push({
        modelId: model.modelId,
        displayName: model.displayName,
        action: "skipped",
        previousProfileId: existingProfileId,
      });
      console.log(`  ⊘ [${model.modelId}] ${model.displayName} - already mapped to profile ${MODEL_OUTPUT_PROFILE_ID}`);
      continue;
    }

    const action = existingProfileId !== undefined ? "updated" : "created";

    if (!isDryRun) {
      await ModelProfileMapModel.updateOne(
        { modelId: model.modelId },
        {
          $set: {
            modelId: model.modelId,
            modelProfileId: MODEL_OUTPUT_PROFILE_ID,
            audit: {
              createdAt: now,
              createdBy: "setup-model-profile-map",
            },
          },
        },
        { upsert: true }
      );
    }

    results.push({
      modelId: model.modelId,
      displayName: model.displayName,
      action,
      previousProfileId: existingProfileId,
    });

    if (action === "created") {
      console.log(`  ✓ [${model.modelId}] ${model.displayName} - created mapping to profile ${MODEL_OUTPUT_PROFILE_ID}`);
    } else {
      console.log(`  ↻ [${model.modelId}] ${model.displayName} - updated from profile ${existingProfileId} to ${MODEL_OUTPUT_PROFILE_ID}`);
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const skipped = results.filter((r) => r.action === "skipped").length;

  console.log(`\n  Total models: ${models.length}`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (already correct): ${skipped}`);

  if (isDryRun) {
    console.log("\n  [Dry run complete - no changes made]");
  } else {
    // Verify final state
    const finalMappings = await ModelProfileMapModel.countDocuments({
      modelProfileId: MODEL_OUTPUT_PROFILE_ID,
    });
    console.log(`\n  Models now mapped to profile ${MODEL_OUTPUT_PROFILE_ID}: ${finalMappings}`);
  }

  await mongoose.disconnect();
  console.log("\n[Done] Disconnected from MongoDB.");
}

main().catch((error) => {
  console.error("[Fatal Error]", error);
  process.exit(1);
});
