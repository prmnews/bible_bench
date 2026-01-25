/**
 * List Models Script
 *
 * Queries and displays all models in the database with their profile mappings.
 * Used to verify which models exist and their current transform profile assignments.
 *
 * Usage:
 *   npx tsx scripts/list-models.ts
 *   npx tsx scripts/list-models.ts --json   # Output as JSON
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

type ModelWithMapping = {
  modelId: number;
  provider: string;
  displayName: string;
  version: string;
  isActive: boolean;
  routingMethod: string;
  profileMapping: {
    modelProfileId: number;
    profileName: string | null;
  } | null;
};

async function main() {
  const outputJson = process.argv.includes("--json");

  if (!outputJson) {
    console.log("=".repeat(80));
    console.log("LIST MODELS");
    console.log("=".repeat(80));
  }

  await connectToDatabase();

  // Get all models
  const models = await ModelModel.find({}).sort({ modelId: 1 }).lean();

  if (models.length === 0) {
    if (outputJson) {
      console.log(JSON.stringify({ models: [], summary: { total: 0, active: 0, withMapping: 0 } }));
    } else {
      console.log("\n  No models found in database.");
    }
    await mongoose.disconnect();
    return;
  }

  // Get all profile mappings
  const mappings = await ModelProfileMapModel.find({}).lean();
  const mappingByModelId = new Map(
    mappings.map((m) => [m.modelId, m.modelProfileId])
  );

  // Get all transform profiles for name lookup
  const profiles = await TransformProfileModel.find({}).lean();
  const profileById = new Map(
    profiles.map((p) => [p.profileId, p.name])
  );

  // Build output data
  const modelsWithMapping: ModelWithMapping[] = models.map((model) => {
    const profileId = mappingByModelId.get(model.modelId);
    return {
      modelId: model.modelId,
      provider: model.provider,
      displayName: model.displayName,
      version: model.version,
      isActive: model.isActive,
      routingMethod: model.routingMethod,
      profileMapping: profileId
        ? {
            modelProfileId: profileId,
            profileName: profileById.get(profileId) || null,
          }
        : null,
    };
  });

  // Summary stats
  const activeCount = modelsWithMapping.filter((m) => m.isActive).length;
  const withMappingCount = modelsWithMapping.filter((m) => m.profileMapping !== null).length;
  const withoutMappingCount = modelsWithMapping.length - withMappingCount;

  if (outputJson) {
    console.log(
      JSON.stringify(
        {
          models: modelsWithMapping,
          summary: {
            total: modelsWithMapping.length,
            active: activeCount,
            withMapping: withMappingCount,
            withoutMapping: withoutMappingCount,
          },
        },
        null,
        2
      )
    );
  } else {
    console.log(`\n  Found ${modelsWithMapping.length} models:\n`);

    // Group by provider
    const byProvider = new Map<string, ModelWithMapping[]>();
    for (const model of modelsWithMapping) {
      const existing = byProvider.get(model.provider) || [];
      existing.push(model);
      byProvider.set(model.provider, existing);
    }

    for (const [provider, providerModels] of Array.from(byProvider.entries()).sort()) {
      console.log(`  ${provider.toUpperCase()}`);
      console.log("  " + "-".repeat(76));

      for (const model of providerModels) {
        const status = model.isActive ? "✓" : "✗";
        const mapping = model.profileMapping
          ? `→ profileId: ${model.profileMapping.modelProfileId} (${model.profileMapping.profileName})`
          : "→ NO MAPPING";

        console.log(
          `    ${status} [${model.modelId}] ${model.displayName} (${model.version})`
        );
        console.log(`        Routing: ${model.routingMethod}`);
        console.log(`        ${mapping}`);
      }

      console.log();
    }

    // Summary
    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log(`  Total models: ${modelsWithMapping.length}`);
    console.log(`  Active: ${activeCount}`);
    console.log(`  With profile mapping: ${withMappingCount}`);
    console.log(`  Without profile mapping: ${withoutMappingCount}`);

    if (withoutMappingCount > 0) {
      console.log("\n" + "-".repeat(80));
      console.log("MODELS WITHOUT PROFILE MAPPING:");
      console.log("-".repeat(80));
      for (const model of modelsWithMapping.filter((m) => !m.profileMapping)) {
        console.log(`  - [${model.modelId}] ${model.displayName}`);
      }
      console.log("\n  To set up mappings, run: npx tsx scripts/setup-model-profile-map.ts");
    }
  }

  await mongoose.disconnect();

  if (!outputJson) {
    console.log("\n[Done] Disconnected from MongoDB.");
  }
}

main().catch((error) => {
  console.error("[Fatal Error]", error);
  process.exit(1);
});
