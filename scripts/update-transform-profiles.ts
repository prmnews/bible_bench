/**
 * Update Transform Profiles Script
 *
 * Updates KJV_CANONICAL_V1 (profileId: 1) and MODEL_OUTPUT_V1 (profileId: 2)
 * with Unicode normalization steps to ensure consistent hash matching between
 * canonical text and LLM outputs.
 *
 * Unicode normalization converts:
 * - Curly quotes (' ' " ") to straight quotes (' ")
 * - Em-dash (—) and en-dash (–) to hyphen (-)
 *
 * Usage:
 *   npx tsx scripts/update-transform-profiles.ts
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
import { TransformProfileModel } from "../src/lib/models";

// Unicode normalization replaceMap - converts curly quotes/dashes to straight equivalents
// Using Unicode escape sequences to avoid parser issues with literal curly quotes
const UNICODE_NORMALIZATION_MAP: Record<string, string> = {
  "\u2018": "'", // LEFT SINGLE QUOTATION MARK -> straight quote
  "\u2019": "'", // RIGHT SINGLE QUOTATION MARK -> straight quote
  "\u201C": '"', // LEFT DOUBLE QUOTATION MARK -> straight quote
  "\u201D": '"', // RIGHT DOUBLE QUOTATION MARK -> straight quote
  "\u2014": "-", // EM DASH -> hyphen
  "\u2013": "-", // EN DASH -> hyphen
};

async function main() {
  console.log("=".repeat(80));
  console.log("UPDATE TRANSFORM PROFILES");
  console.log("=".repeat(80));
  console.log("\nAdding Unicode normalization steps to:");
  console.log("  - KJV_CANONICAL_V1 (profileId: 1)");
  console.log("  - MODEL_OUTPUT_V1 (profileId: 2)");

  await connectToDatabase();

  // =========================================================================
  // 1. Update KJV_CANONICAL_V1 (profileId: 1)
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log("Updating KJV_CANONICAL_V1 (profileId: 1)...");

  const canonicalProfile = await TransformProfileModel.findOne({
    profileId: 1,
  }).lean();

  if (!canonicalProfile) {
    console.error("  ERROR: KJV_CANONICAL_V1 profile not found!");
    process.exit(1);
  }

  console.log(`  Current version: ${canonicalProfile.version}`);
  console.log(`  Current steps: ${canonicalProfile.steps.length}`);

  // Define the updated steps for KJV_CANONICAL_V1
  const canonicalSteps = [
    {
      order: 1,
      type: "stripMarkupTags",
      enabled: true,
      params: {
        tagNames: ["wj", "add", "verse-span", "para", "char", "verse", "chapter"],
      },
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
      params: { patterns: ["^\\d+\\s*"] },
    },
    {
      order: 4,
      type: "replaceMap",
      enabled: true,
      severity: "cosmetic",
      description: "Normalize Unicode quotes/apostrophes to ASCII equivalents",
      params: { map: UNICODE_NORMALIZATION_MAP },
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
  ];

  const canonicalUpdateResult = await TransformProfileModel.updateOne(
    { profileId: 1 },
    {
      $set: {
        steps: canonicalSteps,
        version: (canonicalProfile.version || 1) + 1,
      },
    }
  );

  if (canonicalUpdateResult.modifiedCount > 0) {
    console.log(`  [UPDATED] KJV_CANONICAL_V1`);
    console.log(`    New version: ${(canonicalProfile.version || 1) + 1}`);
    console.log(`    New steps: ${canonicalSteps.length}`);
  } else {
    console.log(`  [NO CHANGE] KJV_CANONICAL_V1 was already up to date`);
  }

  // =========================================================================
  // 2. Update MODEL_OUTPUT_V1 (profileId: 2)
  // =========================================================================
  console.log("\n" + "-".repeat(80));
  console.log("Updating MODEL_OUTPUT_V1 (profileId: 2)...");

  const modelProfile = await TransformProfileModel.findOne({
    profileId: 2,
  }).lean();

  if (!modelProfile) {
    console.error("  ERROR: MODEL_OUTPUT_V1 profile not found!");
    process.exit(1);
  }

  console.log(`  Current version: ${modelProfile.version}`);
  console.log(`  Current steps: ${modelProfile.steps.length}`);

  // Define the updated steps for MODEL_OUTPUT_V1
  const modelSteps = [
    {
      order: 1,
      type: "replaceMap",
      enabled: true,
      severity: "cosmetic",
      description: "Normalize Unicode quotes/apostrophes to ASCII equivalents",
      params: { map: UNICODE_NORMALIZATION_MAP },
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
  ];

  const modelUpdateResult = await TransformProfileModel.updateOne(
    { profileId: 2 },
    {
      $set: {
        steps: modelSteps,
        version: (modelProfile.version || 1) + 1,
      },
    }
  );

  if (modelUpdateResult.modifiedCount > 0) {
    console.log(`  [UPDATED] MODEL_OUTPUT_V1`);
    console.log(`    New version: ${(modelProfile.version || 1) + 1}`);
    console.log(`    New steps: ${modelSteps.length}`);
  } else {
    console.log(`  [NO CHANGE] MODEL_OUTPUT_V1 was already up to date`);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  // Show final state of both profiles
  const updatedCanonical = await TransformProfileModel.findOne({
    profileId: 1,
  }).lean();
  const updatedModel = await TransformProfileModel.findOne({
    profileId: 2,
  }).lean();

  console.log("\n  KJV_CANONICAL_V1 (profileId: 1):");
  console.log(`    Version: ${updatedCanonical?.version}`);
  console.log(`    Steps:`);
  for (const step of updatedCanonical?.steps || []) {
    console.log(`      ${step.order}. ${step.type}${step.description ? ` - ${step.description}` : ""}`);
  }

  console.log("\n  MODEL_OUTPUT_V1 (profileId: 2):");
  console.log(`    Version: ${updatedModel?.version}`);
  console.log(`    Steps:`);
  for (const step of updatedModel?.steps || []) {
    console.log(`      ${step.order}. ${step.type}${step.description ? ` - ${step.description}` : ""}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("IMPORTANT: You must now re-run the canonical ETL to regenerate");
  console.log("           canonicalChapters and canonicalVerses with the new transforms.");
  console.log("           Run: npx tsx scripts/rerun-canonical-etl.ts");
  console.log("=".repeat(80));

  await mongoose.disconnect();
  console.log("\n[Done] Disconnected from MongoDB.");
}

main().catch((error) => {
  console.error("[Fatal Error]", error);
  process.exit(1);
});
