/**
 * Seed Transform Profiles Script
 *
 * Seeds additional transform profiles from data/seed-transforms.json into MongoDB.
 * These profiles include UNICODE_NORMALIZATION_V1 and PUNCTUATION_NORMALIZATION_V1
 * with apostrophe replacement and other cosmetic transforms.
 *
 * Usage:
 *   npx tsx scripts/seed-transform-profiles.ts
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

type TransformStep = {
  order: number;
  type: string;
  enabled: boolean;
  severity?: string;
  description?: string;
  params: Record<string, unknown>;
};

type TransformProfile = {
  profileId: number;
  name: string;
  scope: string;
  version: number;
  bibleId?: number;
  isDefault: boolean;
  description: string;
  steps: TransformStep[];
  isActive: boolean;
};

async function main() {
  console.log("=".repeat(80));
  console.log("SEED TRANSFORM PROFILES");
  console.log("=".repeat(80));

  // Read seed transforms from file
  const seedPath = path.resolve(process.cwd(), "data/seed-transforms.json");
  if (!fs.existsSync(seedPath)) {
    console.error(`Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  const seedContent = fs.readFileSync(seedPath, "utf-8");
  const seedProfiles = JSON.parse(seedContent) as TransformProfile[];

  console.log(`\nLoaded ${seedProfiles.length} profiles from seed file:\n`);
  for (const profile of seedProfiles) {
    console.log(`  - ${profile.name} (profileId: ${profile.profileId})`);
    console.log(`    Scope: ${profile.scope}, Steps: ${profile.steps.length}`);
  }

  await connectToDatabase();

  let created = 0;
  let updated = 0;
  const skipped = 0;

  for (const profile of seedProfiles) {
    // Check if profile already exists
    const existing = await TransformProfileModel.findOne({
      profileId: profile.profileId,
    }).lean();

    if (existing) {
      // Update if exists
      await TransformProfileModel.updateOne(
        { profileId: profile.profileId },
        {
          $set: {
            name: profile.name,
            scope: profile.scope,
            version: profile.version,
            bibleId: profile.bibleId,
            isDefault: profile.isDefault,
            description: profile.description,
            steps: profile.steps,
            isActive: profile.isActive,
          },
        }
      );
      console.log(`\n  [UPDATED] ${profile.name}`);
      updated++;
    } else {
      // Create if doesn't exist
      await TransformProfileModel.create({
        profileId: profile.profileId,
        name: profile.name,
        scope: profile.scope,
        version: profile.version,
        bibleId: profile.bibleId,
        isDefault: profile.isDefault,
        description: profile.description,
        steps: profile.steps,
        isActive: profile.isActive,
        audit: {
          createdAt: new Date(),
          createdBy: "seed-script",
        },
      });
      console.log(`\n  [CREATED] ${profile.name}`);
      created++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);

  // List all active model_output profiles
  const allProfiles = await TransformProfileModel.find({
    scope: "model_output",
    isActive: true,
  })
    .sort({ profileId: 1 })
    .lean();

  console.log(`\n  Active model_output profiles in database:`);
  for (const p of allProfiles) {
    console.log(`    - ${p.name} (profileId: ${p.profileId})`);
  }

  await mongoose.disconnect();
  console.log("\n[Done] Disconnected from MongoDB.");
}

main().catch((error) => {
  console.error("[Fatal Error]", error);
  process.exit(1);
});
