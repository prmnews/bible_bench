import mongoose from "mongoose";

import { computeAllAggregates } from "../src/lib/aggregation";
import { connectToDatabase } from "../src/lib/mongodb";

function getRunId(): string | null {
  const envRunId = process.env.RUN_ID;
  if (envRunId && envRunId.trim().length > 0) {
    return envRunId.trim();
  }

  const arg = process.argv.find((value) => value.startsWith("--runId="));
  if (arg) {
    return arg.slice("--runId=".length).trim() || null;
  }

  return null;
}

async function main() {
  const runId = getRunId();
  if (!runId) {
    console.error("Missing runId. Provide RUN_ID or --runId=...");
    process.exitCode = 1;
    return;
  }

  await connectToDatabase();
  const result = await computeAllAggregates(runId);
  console.log("[recompute-aggregates] runId:", runId);
  console.log("[recompute-aggregates] chapters:", result.chaptersProcessed);
  console.log("[recompute-aggregates] books:", result.booksProcessed);
  console.log("[recompute-aggregates] bibles:", result.biblesProcessed);

  if (result.errors.length > 0) {
    console.warn("[recompute-aggregates] errors:");
    for (const error of result.errors) {
      console.warn(`- ${error}`);
    }
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
