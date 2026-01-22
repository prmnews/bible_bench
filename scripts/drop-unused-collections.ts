import mongoose from "mongoose";

import { connectToDatabase } from "../src/lib/mongodb";

const COLLECTIONS = ["canonicalTestVerses", "etlRuns"] as const;

async function dropCollections() {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not initialized.");
  }

  const existing = await db.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existing.map((collection) => collection.name));

  for (const name of COLLECTIONS) {
    if (!existingNames.has(name)) {
      console.log(`[drop-unused-collections] Skip (missing): ${name}`);
      continue;
    }

    try {
      await db.dropCollection(name);
      console.log(`[drop-unused-collections] Dropped: ${name}`);
    } catch (error) {
      console.error(`[drop-unused-collections] Failed: ${name}`);
      console.error(error);
    }
  }
}

dropCollections()
  .catch((error) => {
    console.error("[drop-unused-collections] Error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
