/**
 * Scrub Model API Keys Script
 *
 * Removes apiConfigEncrypted.apiKey from all model documents.
 *
 * Usage:
 *   npx tsx scripts/scrub-model-api-keys.ts [--dry-run]
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
import { ModelModel } from "../src/lib/models";

const DRY_RUN =
  process.argv.includes("--dry-run") ||
  ["1", "true", "yes"].includes((process.env.DRY_RUN ?? "").toLowerCase());

async function main() {
  console.log("=".repeat(80));
  console.log("SCRUB MODEL API KEYS");
  console.log("=".repeat(80));
  console.log(`[mode] ${DRY_RUN ? "DRY RUN" : "LIVE UPDATE"}`);

  await connectToDatabase();

  const filter = { "apiConfigEncrypted.apiKey": { $exists: true } };
  const count = await ModelModel.countDocuments(filter);

  console.log(`\n[scan] Models with apiConfigEncrypted.apiKey: ${count}`);

  if (count === 0) {
    console.log("[done] No keys found to scrub.");
    return;
  }

  if (DRY_RUN) {
    console.log("[dry-run] Skipping update. Re-run without --dry-run to scrub keys.");
    return;
  }

  const result = await ModelModel.updateMany(filter, {
    $unset: { "apiConfigEncrypted.apiKey": "" },
  });

  console.log("\n[update] Completed key scrub.");
  console.log(`  Matched: ${result.matchedCount}`);
  console.log(`  Modified: ${result.modifiedCount}`);

  const remaining = await ModelModel.countDocuments(filter);
  console.log(`\n[verify] Remaining keys: ${remaining}`);
}

main()
  .catch((error) => {
    console.error("[fatal] Unhandled error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("\n[done] Disconnected from MongoDB.");
  });
